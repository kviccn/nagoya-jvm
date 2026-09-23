# day4 指令集与解释器

> 对应原书第 5 章，JVMS §6。本章结束时：~140 条指令可执行，解释器跑通高斯求和。

## 本章目标

```bash
npm run day4
# main() pc=  0 iconst_0  | locals=[0,0,0] stack=[]
# main() pc=  1 istore_1  | locals=[0,0,0] stack=[0]
# ...
# main() pc= 22 return    | locals=[0,5050,5050] stack=[]
# 执行完毕。请在上面指令跟踪中确认 istore 的最终值 sum=5050。
```

## 背景知识

### 解释器是什么

CPU 执行机器码，JVM 执行字节码——本质都是**取指 → 译码 → 执行**的循环。
软件模拟这个循环就是解释器：

```
loop:
  pc = frame.nextPc           # 取下一条指令地址
  opcode = code[pc]           # 取指
  inst = table[opcode]        # 译码（查分派表）
  inst.fetchOperands(reader)  # 读操作数（指令码后的 0~n 字节）
  frame.nextPc = reader.pc    # 维护"下一条"地址
  inst.execute(frame)         # 执行（可能改写 nextPc = 跳转）
```

### 指令的形态（§6.5）

字节码指令 = **1 字节 opcode + 0~n 字节操作数**。按操作数形态分四类：

| 形态 | 例子 | 操作数含义 |
|------|------|-----------|
| 无操作数 | `iload_0`(0x1a)、`iadd`(0x60)、`return`(0xb1) | 全部信息在 opcode 里 |
| u8 索引 | `iload`(0x15)、`ldc`(0x12) | 局部变量表/常量池索引 |
| u16 索引 | `getstatic`(0xb2)、`invokevirtual`(0xb6) | 常量池索引 |
| i16 偏移 | `goto`(0xa7)、`if_icmpge`(0xa2) | 相对当前指令的跳转偏移 |

特例：`tableswitch/lookupswitch`（4 字节对齐 + 变长跳转表）、`wide`（前缀指令）、
`invokeinterface`（u16 + u8 + u8）、`ldc2_w`……格式在反汇编器的 FORMAT 表里都有。

## 源码讲解

### 主循环：`src/day4/interpreter.js`

```js
export function step(thread) {
  if (thread.isStackEmpty()) return true;

  const frame = thread.currentFrame();
  const pc = frame.nextPc;
  thread.pc = pc;              // 记录当前指令地址（branch/异常查找的基准）

  reader.reset(frame.method.code, pc);
  const opcode = reader.readUint8();
  const inst = getInstruction(opcode);
  inst.fetchOperands(reader);
  frame.nextPc = reader.pc;    // 下一条地址（跳转指令会在 execute 里改写）

  if (tracer) tracer(frame, pc, opcode);
  inst.execute(frame);

  return thread.isStackEmpty();
}

export function runThread(thread) {
  while (!step(thread)) { /* 全部工作都在 step 里 */ }
}
```

架构上最重要的决策是 **step/runThread 分离**：

- `step()` 执行**一条**指令——这是[在线解释器](/playground)的驱动单元，
  浏览器用 `setInterval` 按可调速度反复调它，实现运行/暂停/单步
- `runThread()` 是 Node CLI 的循环壳
- 循环条件是"帧栈非空"而不是"方法返回"——day6 方法调用只是压新帧，
  day9 异常展开只是弹帧，**主循环零改动**覆盖这两个后续特性

`setTracer(fn)` 是另一个为可视化预留的钩子：注入后在每条指令执行前回调
`(frame, pc, opcode)`；未注入时零开销（一次 null 判断）。CLI 的 `-v`
就是安装了一个打印 `locals=[...] stack=[...]` 的默认 tracer。

### 指令基类：`src/day4/instructions/base.js`

```js
export class NoOperandsInstruction {
  fetchOperands() {}
}
export class Index16Instruction {           // getstatic、invokevirtual 等
  fetchOperands(reader) { this.index = reader.readUint16(); }
}
export class BranchInstruction {            // goto、if 系列
  fetchOperands(reader) { this.offset = reader.readInt16(); }
  execute(frame) { frame.branch(this.offset); }   // 默认行为：直接跳
}
```

`BytecodeReader` 负责从 `code[]` 读操作数，其中 `skipPadding()` 服务
tableswitch 的 4 字节对齐（见下文"关键细节"）。

### 指令实现示例：`src/day4/instructions/math.js`

同类指令用高阶函数批量生成——以 int 二元运算为例：

```js
function intBinary(fn) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = s.popInt();       // 先弹的是右操作数！
      const v1 = s.popInt();
      s.pushInt(fn(v1, v2));
    }
  };
}

export const iadd = intBinary((a, b) => a + b);
export const imul = intBinary((a, b) => Math.imul(a, b));  // 32 位乘法溢出语义
export const idiv = intBinary((a, b) => (a / b) | 0);      // day9 升级为抛异常
```

三个细节：

1. **弹栈顺序**：栈是先入后出，`v2` 先弹。`isub` 里写反就得到 `b - a`。
2. **`Math.imul`**：JS 的 `a * b` 是 f64 乘法，大数溢出结果与 Java 的 32 位
   回绕不同；`Math.imul` 正是为模拟 32 位整数乘法而生。
3. **`idiv` 的 `(a / b) | 0`**：Java 整数除法向零取整，JS `/` 是浮点除法，
   `| 0` 截断成 int 恰好是向零取整（`7/2=3`、`-7/2=-3`，与 Java 一致）。
   除零呢？day4 先不管，day9 会把它升级成抛 `ArithmeticException`。

### 指令分派表：`src/day4/instructions/factory.js`

```js
const instructionTable = new Map([
  [0x00, singleton(constants.Nop)],
  [0x1a, singleton(loads.iload_0)],
  [0x60, singleton(math.iadd)],
  // ... 140+ 条
]);

export function register(opcode, inst) {
  instructionTable.set(opcode, inst);   // 后注册者覆盖——后续 day 靠它升级指令
}
```

两个设计决策：

- **单例**：绝大多数指令无状态（操作数都存在指令实例上这一点例外——
  见下方"关键细节"第 3 条），全局共享一份实例，热循环零分配。
- **`register()` 可覆盖**：day5 注册 ldc/new/getstatic，day7 **覆盖** ldc
  支持字符串，day9 覆盖 idiv 支持除零异常。指令表从"静态查表"变成
  "可渐进升级的分派中心"，这是逐 day 累计式开发能成立的关键机制。

### return 指令：`src/day4/instructions/control.js`

return 系列是本章与 day6 的桥梁——**弹帧，并把返回值压回调用者操作数栈**：

```js
// return（0xb1）：无返回值，直接弹帧
class Return extends NoOperandsInstruction {
  execute(frame) { frame.thread.popFrame(); }
}
// ireturn（0xac）：弹帧 + 返回值搬运
class IReturn extends NoOperandsInstruction {
  execute(frame) {
    const thread = frame.thread;
    const currentFrame = thread.popFrame();
    const invokerFrame = thread.currentFrame();   // 弹帧后栈顶就是调用者
    invokerFrame.operandStack.pushInt(currentFrame.operandStack.popInt());
  }
}
```

day4 测试只有 main 一个帧，return 后栈空循环结束；day6 有调用关系后，
同一段代码自然完成返回值回传。**帧模型统一了"程序结束"和"方法返回"**。

## 关键细节

1. **tableswitch 的 4 字节对齐**：padding 从**方法代码起始**（不是指令起始）
   计算，`default` 偏移必须落在 4 的倍数位置。反汇编器里这段逻辑和
   `BytecodeReader.skipPadding()` 互为印证。
2. **fcmpg vs fcmpl**：浮点比较遇 NaN 时，`fcmpg` 压 1、`fcmpl` 压 -1（g/l 后缀）。
   这是 Java 让 `NaN != NaN` 且排序稳定的设计。
3. **指令实例不是完全无状态**：带操作数的指令把 `index/offset` 存在实例字段上。
   单例 + 字段意味着**同一 opcode 并发执行会串数据**——我们的 VM 单线程，
   成立；真实 JVM 的多线程解释器不能这么干。
4. **`wide` 前缀**：局部变量表超过 255 槽时，`wide iload <u16>` 扩展索引位宽；
   `wide iinc` 的常量也从 i8 扩到 i16。

## 动手实验

1. `node src/day4/main.js -cp build/classes day4.GaussTest` 通读完整跟踪，
   找一张纸同步手算局部变量表，验证每个 `istore_1`。
2. 给 `GaussTest` 加一个 long 求和变量重新编译，用 `-v` 观察 `lstore/ladd`
   占两槽的行为（locals 打印里会出现 `5050n`）。
3. 用 `-v` 跑起来后回答：`iinc 1 1`（对应 `i++`）执行了多少次？
   它和 `iload/iconst/iadd/istore` 四连指令相比省了什么？
