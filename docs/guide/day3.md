# day3 运行时数据区

> 对应原书第 4 章，JVMS §2.5/§2.6。本章结束时：局部变量表、操作数栈、帧栈全部就绪，
> 能用它们手工模拟一次计算。

## 本章目标

```bash
npm run day3
# localVars: 5,100,0
# int@0 = 5 / long@1 = 100n
# ...
# currentFrame is frame: true
```

## 背景知识

### JVM 的运行时数据区（§2.5）

```
┌─────────────────────────────────────────────┐
│  线程私有（每个线程一份）                      │
│  ┌──────────┐  ┌─────────────────────────┐  │
│  │ pc 寄存器 │  │ JVM 栈（帧 Stack）       │  │
│  │          │  │  ┌─────┐←─ 栈顶=当前帧   │  │
│  │          │  │  │Frame│ 局部变量表      │  │
│  │          │  │  ├─────┤ 操作数栈        │  │
│  │          │  │  │Frame│ ...            │  │
│  │          │  │  └─────┘                │  │
│  └──────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────┤
│  线程共享                                     │
│  方法区（类/常量池/静态变量）   堆（对象）      │  ← day5 才实现
└─────────────────────────────────────────────┘
```

本章实现虚线左边的一切：**Slot → 局部变量表/操作数栈 → 帧 → 帧栈 → 线程**。

### 用 JS 表达 Java 数值——本章最重要的决策

| Java 类型 | 位宽 | JS 表示 | 为什么 |
|-----------|------|---------|--------|
| int | 32 | number + `v \| 0` | 位运算强制截断成 32 位有符号 |
| long | 64 | **BigInt** | JS number 只有 53 位精度，装不下 i64 |
| float | 32 | number + `Math.fround` | fround 把 f64 舍入成最近的 f32 |
| double | 64 | number | JS number 原生就是 IEEE754 f64 |
| byte/short/char/boolean | ≤32 | 同 int | JVM 规范：这些类型在栈上就按 int 处理 |

这套映射贯穿后面所有章节：`imul` 用 `Math.imul` 保持 32 位溢出语义、
`ladd` 直接 `a + b`（BigInt 运算）、`f2i` 要处理 NaN/溢出边界（§2.8.3）。

## 源码讲解

### Slot：`src/day3/rtda/slot.js`

槽位是局部变量表和操作数栈的共同基本单元（§2.6.1）。设计成一个
`{ num, ref }` 双字段对象：值类型放 `num`，引用放 `ref`，二者互斥：

```js
export class Slot {
  constructor(num = 0, ref = null) {
    this.num = num;
    this.ref = ref;
  }
}
```

`Slots` 是一组连续槽位，**局部变量表、类的静态变量、对象的实例字段共用这一个类**——
这是原书 Go 版设计的精髓，一处实现三处复用：

```js
setInt(i, v) { this.slots[i].num = v | 0; }          // 强制 32 位
getLong(i) { return BigInt(this.slots[i].num); }
// long/double 占两个槽位（§2.6.1）：写入时把下一槽置成占位
setLong(i, v) { this.slots[i].num = BigInt(v); this.slots[i + 1] = new Slot(); }
```

为什么 long 占位很重要：`lstore 1` 之后槽位 1、2 都被占用，
`iload 2` 读到的是占位槽——javac 保证不会生成这种指令，但 VM 的布局必须忠实。

### 操作数栈：`src/day3/rtda/operandStack.js`

经典栈结构 + 类型化 push/pop。注意它**不是** JS 数组直接 push，
而是预分配 `maxStack` 个槽位 + `size` 游标——和真实 JVM 按 maxStack 分配一致：

```js
pushInt(v) { const s = this.slots[this.size++]; s.num = v | 0; s.ref = null; }
popInt()  { return this.slots[--this.size].num | 0; }
pushLong(v) { const s = this.slots[this.size]; s.num = BigInt(v); s.ref = null; this.size += 2; }
```

有两个为后续章节准备的特殊方法：

```js
// 供 invokevirtual 在不弹栈的情况下偷看 this（参数还压在 this 上面）
getRefFromTop(n) { return this.slots[this.size - 1 - n].ref; }

// day9 异常处理：进入 catch 时操作数栈必须清空再压入异常引用（§2.6.2）
clear() { this.size = 0; for (const s of this.slots) { s.num = 0; s.ref = null; } }
```

### 帧：`src/day3/rtda/frame.js`

```js
export class Frame {
  constructor(thread, maxLocals, maxStack) {
    this.thread = thread;
    this.localVars = new Slots(maxLocals);
    this.operandStack = new OperandStack(maxStack);
    this.method = null;   // day4 挂伪方法，day5 起挂 heap.Method
    this.nextPc = 0;      // 下一条指令的 pc，解释器维护
  }

  // 跳转指令用：offset 相对"当前指令"的 pc
  branch(offset) {
    const pc = this.thread.pc;
    this.nextPc = pc + offset;
  }

  // day5 类初始化用：撤销 nextPc，让当前指令在 <clinit> 返回后重新执行
  revertNextPC() {
    this.nextPc = this.thread.pc;
  }
}
```

**帧 = 局部变量表 + 操作数栈 + 运行时常量池引用（经 method）+ 返回地址（经帧栈隐式表达）**。
`thread.pc` 与 `frame.nextPc` 的分工是理解解释器的关键：

- `thread.pc`：当前**正在执行**的指令地址（branch/异常表查找的基准）
- `frame.nextPc`：**下一条**将执行的指令地址（取指后立刻更新，
  跳转指令在 execute 里改写它）

### 帧栈与线程：`src/day3/rtda/stack.js`、`thread.js`

帧栈容量固定（默认 1024，对应 JVM 的 -Xss 概念），溢出抛 StackOverflowError。
用 JS 数组实现（`Frame.lower` 链表字段只是原书 Go 版设计的示意，未实际使用）：

```js
export class Stack {
  constructor(capacity = DEFAULT_CAPACITY) { this.capacity = capacity; this.frames = []; }
  push(frame) {
    if (this.frames.length >= this.capacity) throw new Error('StackOverflowError');
    this.frames.push(frame);
  }
  // pop / top / isEmpty
  getFrames() { return [...this.frames].reverse(); }  // 栈顶在前（day9 调用链打印用）
}
```

`getFrames()` 返回的逆序副本很重要：异常调用链、在线解释器的帧栈面板都是
"栈顶在上"的视角，而数组天然是栈底在前。

`Thread` = pc + Stack + `newFrame(method)` 工厂。day6 的递归爆栈、
day9 的调用链打印都依赖这个结构。

::: danger 教科书级 bug 现场
本项目开发时遇到过一个典型 bug：`pushSlot/popSlot` 最初**直接共享 Slot 对象引用**：

```js
// ❌ 错误版本
pushSlot(slot) { this.slots[this.size++] = slot; }   // 引用共享！
```

`dup` 指令 pop 再 push 两次同一个 Slot 对象后，栈上两个"副本"指向同一对象；
随后 `popRef` 清空 ref 字段时，**另一个副本的 ref 也被清掉了**——
`{1,2,3}` 数组初始化立刻 NPE。修复：**按值复制槽位**（`new Slot(slot.num, slot.ref)`）。

这个 bug 解释了 JVM 规范为什么把 dup 系列指令的语义都描述为"值（value）"
而不是对象——category 1/2 的计算（§2.11.1）全部建立在"槽位是值"之上。
:::

## 动手实验

1. 用本章的数据结构手工模拟 `1 + 2 * 3`：
   `iconst_1 → iconst_2 → iconst_3 → imul → iadd → istore_0`，
   在每一步打印操作数栈（`npm run day3` 的输出就是类似的演示）。
2. 把 `Stack` 的 `maxSize` 改成 3，跑一个 4 层递归（day6 之后），
   观察 StackOverflowError。
3. 思考：数组实现栈和原书 Go 版的 `lower` 链表实现，各自优缺点是什么？
   （提示：内存局部性、getFrames 遍历成本、随机访问第 n 帧）
