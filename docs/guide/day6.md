# day6 方法调用和返回

> 对应原书第 7 章，JVMS §5.4.3.3。本章结束时：递归、构造器、多态全部跑通。

## 本章目标

```bash
npm run day6   # = node src/day6/main.js -cp build/classes day6.FibonacciTest
# RESULT = 55        （fib(10)，共执行 1593 条指令）

node src/day6/main.js -cp build/classes day6.VirtualDispatchTest
# RESULT = 204       （虚方法动态分派：Cat 继承 Animal 不重写 speak）
```

## 背景知识

### 四种调用指令（§6.5）

| 指令 | opcode | 分派方式 | 编译器什么时候生成 |
|------|--------|---------|-------------------|
| invokestatic | 0xb8 | 静态绑定 | `Math.max(a,b)` |
| invokespecial | 0xb7 | 静态绑定 | 构造器 `<init>`、`private` 方法、`super.x()` |
| invokevirtual | 0xb6 | **动态分派** | 普通实例方法（多态的载体） |
| invokeinterface | 0xb9 | 动态分派 | 通过接口类型调用 |

"静态绑定 vs 动态分派"的区别：静态绑定在**解析期**就确定了目标方法；
动态分派要到**运行时**看 `this` 的实际类型再定。多态 = invokevirtual + 动态分派。

### 一次调用发生了什么

```
调用者帧                           被调者帧
┌────────────────┐   参数传递      ┌────────────────┐
│ 操作数栈        │  ───────────→  │ 局部变量表      │
│  ...this arg1  │   pop n 个槽    │  0:this 1:arg1 │
│                │                │ 操作数栈（空）   │
└────────────────┘                └────────────────┘
       ↑  return 时：返回值压回调用者操作数栈（day4 已实现）
```

**方法的参数在字节码层面就是局部变量表的前几个槽**——`this` 占 0 号槽
（静态方法没有 this），参数依次排布，long/double 参数占两槽。

## 源码讲解

### 调用核心：`src/day6/instructions/invoke.js`

```js
export function invokeMethod(invokerFrame, method) {
  const thread = invokerFrame.thread;
  const newFrame = thread.newFrame(method);
  thread.pushFrame(newFrame);

  // 参数传递：调用者操作数栈顶 argSlotCount 个槽 → 被调者局部变量表（§2.6.1）
  for (let i = method.argSlotCount - 1; i >= 0; i--) {
    newFrame.localVars.setSlot(i, invokerFrame.operandStack.popSlot());
  }
  // native 分支见 day8
}
```

短短几行，就是 JVM 方法调用的全部核心。**注意 `popSlot/setSlot` 按值复制槽位**
——day3 那个引用共享 bug 如果还在，这里传参会直接翻车。

`argSlotCount` 在 day5 的 `Method` 构造时由方法描述符算出：

```js
// src/day5/heap/method.js
calcArgSlotCount() {
  const { paramTypes } = parseMethodDescriptor(this.descriptor);
  this.argSlotCount = paramTypes.reduce((n, t) => n + slotCountOf(t), 0);
  if (!this.isStatic()) this.argSlotCount++;   // this 引用占一个槽
}
```

### 动态分派：invokevirtual

```js
export class InvokeVirtual extends Index16Instruction {
  execute(frame) {
    const methodRef = cpOf(frame).getConstant(this.index);
    const resolvedMethod = methodRef.resolvedMethod();       // ① 按声明类型解析
    // ...
    // ② 不弹栈先偷看 this（参数还压在 this 上面）
    const ref = frame.operandStack.getRefFromTop(resolvedMethod.argSlotCount - 1);
    if (ref === null) throw new Error('NullPointerException');
    if (resolvedMethod.isFinal() || resolvedMethod.class.isFinal()) {
      return invokeMethod(frame, resolvedMethod);            // final 无需分派
    }
    // ③ §5.4.3.3：从对象的实际类开始重新查找方法
    const method = lookupMethodInClass(ref.class, methodRef.name, methodRef.descriptor);
    if (!method) throw new Error(`AbstractMethodError: ${methodRef.name}`);
    invokeMethod(frame, method);
  }
}
```

三步分解：

1. **解析**：按常量池里记录的声明类型找到方法（如 `Animal.speak`）
2. **偷看 this**：`getRefFromTop(argSlotCount - 1)`——参数在栈顶，
   this 在所有参数**下面**，所以下标是 `argSlotCount - 1`。
   这也是 day3 预置 `getRefFromTop` 的原因。
3. **重查找**：从 `ref.class`（实际类型，如 `Cat`）开始沿继承链找同名同描述符方法。
   Cat 重写了就用 Cat 的，没重写就回落到 Animal 的——**方法重写（override）
   的全部实现就是这一次查找起点的改变**。

`lookupMethodInClass`（day5 method.js）沿 `superClass` 链线性查找——
真实 JVM 用 vtable（虚方法表）把它优化成 O(1) 数组索引，语义相同。

### invokespecial 与 invokestatic

- `InvokeSpecial`：解析完直接调，**不做动态分派**。这就是 `super.x()` 能
  绕过子类重写的原因，也是构造器链路（每个 `<init>` 第一句必调父类 `<init>`）
  的载体。
- `InvokeStatic`：多了 `<clinit>` 检查（和 day5 的 getstatic 同款的
  revertNextPC + initClass 模式）——静态方法属于类，类没初始化不能调。

### native 方法帧（为 day8 铺路）

```js
// src/day5/heap/method.js 构造器里
if (this.isNative()) {
  // native 方法没有 Code 属性：局部变量表容纳参数，操作数栈给返回值留足空间
  this.maxLocals = this.argSlotCount;
  this.maxStack = Math.max(this.maxStack, 4);
}
```

native 方法没有字节码，`maxStack=0` 会让 day3 的栈容量检查直接拒绝压帧——
`maxStack=4` 这个"魔法数字"是原书的经典 hack，本教程保留并加了注释。

### 注册表

```js
register(0xb6, new InvokeVirtual());
register(0xb7, new InvokeSpecial());
register(0xb8, new InvokeStatic());
register(0xb9, new InvokeInterface());
```

import 这个模块的副作用就是往 day4 分派表注册 4 条指令——day6 的 main.js
因此只需 `import '../day6/instructions/invoke.js'` 一行，VM 就"学会"了方法调用。

## 关键细节

1. **invokeinterface 的两个历史字节**：操作数里 `count`（参数槽数）和一个
   恒为 0 的字节都是历史遗留（当年给 iTable 预留），规范要求读取但忽略。
2. **返回值回传在 return 指令里**（day4 control.js），不在 invoke 里——
   职责划分：invoke 管"去"，return 管"回"。
3. **递归就是普通的压帧**：fib(10) 的 1593 条指令里没有任何"递归特殊处理"，
   栈溢出防护靠 day3 的 1024 帧上限（把 fib 参数调大就能看到 StackOverflowError）。

## 动手实验

1. 给 `VirtualDispatchTest` 加 `class Dog extends Animal { }`（不重写 speak），
   验证动态分派沿继承链回落到 `Animal.speak()`——`lookupMethodInClass`
   的 for 循环就是干这个的。
2. 用 `-v` 跑 FibonacciTest，观察 `fib` 帧压入/弹出的节奏，
   数一下任何时刻栈里最多有几个 fib 帧（答案：10）。
3. 故意把 `fib` 的递归终止条件删掉，观察 StackOverflowError——
   这就是真实 JVM `-Xss` 的行为。
