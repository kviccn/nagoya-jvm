# day9 异常处理

> 对应原书第 10 章，JVMS §2.10。本章结束时：try/catch/finally 可用，
> 未捕获异常打印调用链并以 exit 1 终止。

## 本章目标

```bash
npm run day9   # day9.ExceptionTest
# RESULT = 1101   （catch 到 ArithmeticException 后 RESULT += 1101）

node src/day9/main.js -cp build/classes day9.UncaughtTest
# Exception in thread "main" java.lang.ArithmeticException
# 	at day9.UncaughtTest.bar()V
# 	at day9.UncaughtTest.foo()V
# 	at day9.UncaughtTest.main([Ljava/lang/String;)V
# （进程 exit code = 1）
```

## 背景知识

### 异常表：try/catch 在字节码里的样子

源码层面：

```java
try {
    int r = 10 / x;            // 可能除零
} catch (ArithmeticException e) {
    r = -1;
} finally {
    cleanup();
}
```

字节码层面**没有 try 语句**——只有 Code 属性里的一张异常表（§4.7.3）：

```
Exception table:
   from    to  target  type
     0     4      8    Class java/lang/ArithmeticException
     0    12     16    any          ← finally 的 catch-all
```

语义：**当 pc ∈ [from, to) 且抛出的异常类型匹配 type 时，跳到 target 执行**。
`type=any（catchType=0）` 表示匹配一切——**finally 就是靠 catch-all 实现的**，
javac 同时会把 finally 代码内联到 try/catch 的正常路径上（所以字节码里
finally 的代码通常出现多份）。

### 异常的传播（§2.10）

athrow 执行时：

1. 在当前帧查异常表 → 命中：清空操作数栈、压入异常引用、跳到 handlerPc
2. 未命中：**弹帧**，到调用者帧继续查（异常沿调用链向上传播）
3. 帧栈空了还没找到 handler = 未捕获异常 → 打印调用链，线程终止

## 源码讲解

### 核心：`src/day9/heap/exception.js`

```js
export function handleThrow(frame, exObj) {
  const thread = frame.thread;
  attachStackTrace(thread, exObj);
  while (true) {
    const f = thread.currentFrame();
    // f.nextPc - 1：当前指令（或调用点）的地址，用它判断是否在 try 范围内
    const handlerPc = f.method.findExceptionHandler(exObj.class, f.nextPc - 1);
    if (handlerPc > 0) {
      f.operandStack.clear();        // §2.6.2：进入 handler 时栈上只剩异常引用
      f.operandStack.pushRef(exObj);
      f.nextPc = handlerPc;
      return;                        // 解释器循环自然从 handler 继续
    }
    thread.popFrame();               // 本帧没有 handler，展开到调用者
    if (thread.isStackEmpty()) {
      throw new UncaughtJvmException(exObj);
    }
  }
}
```

三个细节：

1. **为什么用 `nextPc - 1` 查表**：取指后 nextPc 已指向"下一条"，
   而异常表的范围是按"抛出异常的指令地址"算的——减 1 回到当前指令。
   传播到调用者帧时，调用者帧的 nextPc 停在 invoke 之后，
   `-1` 恰好落在 invoke 指令范围内（invoke 指令长度 ≥ 1），也在 try 范围内。
2. **清空操作数栈再压异常**：§2.6.2 规定进入 handler 时操作数栈恰好只有
   一个异常引用——day3 预置的 `clear()` 在这里兑现。
3. **逐帧展开是纯 while 循环**：return 指令弹帧、异常展开弹帧，
   主循环对两种弹帧一视同仁——帧模型第三次兑现红利。

### 调用链记录

```js
export function attachStackTrace(thread, exObj) {
  if (exObj.extra !== null) return;             // 重抛的异常保留原栈
  exObj.extra = {
    stackTrace: thread.getFrames().map((f) => {
      const m = f.method;
      return `${m.class.name}.${m.name}${m.descriptor}`;
    }),
  };
}
```

异常对象**创建时**（或被抛出时）记录当前帧栈——等价于真实 JVM 的
`fillInStackTrace`。`extra` 扩展位再次出场（day8 的 StringBuilder buf 也是它）。
`if (exObj.extra !== null) return` 保证 `catch 后 rethrow` 保留原始调用点。

### handler 查找：`src/day5/heap/method.js`

```js
findExceptionHandler(exClass, pc) {
  for (const e of this.exceptionTable) {
    if (pc < e.startPc || pc >= e.endPc) continue;       // 范围不匹配
    if (e.catchType === 0) return e.handlerPc;           // finally（catch 所有）
    const catchClass = this.class.constantPool.getConstant(e.catchType).resolvedClass();
    if (catchClass === exClass || catchClass.isSuperClassOf(exClass)) {
      return e.handlerPc;                                // 类型匹配（含父类匹配）
    }
  }
  return -1;
}
```

两个规则：**异常表按顺序查找，首个匹配者胜出**（所以 catch 子类要写在父类前面，
javac 会强制）；类型匹配用 `isSuperClassOf`——catch Exception 能接到
RuntimeException（day5 的继承关系判断第四次被复用）。

### VM 内部异常的升级：`src/day9/instructions/athrow.js`

day4 的 `idiv` 除零直接抛 JS Error，Java 代码 catch 不住。本章升级为
**创建堆中异常对象，走和 athrow 完全相同的传播流程**：

```js
function makeIDiv(isRem) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = s.popInt();
      const v1 = s.popInt();
      if (v2 === 0) return throwNew(frame, 'java/lang/ArithmeticException');  // ★
      s.pushInt(isRem ? v1 % v2 : (v1 / v2) | 0);
    }
  };
}
register(0x6c, makeIDiv(false));   // 覆盖 day4 的 idiv
```

`throwNew` = `newException`（建对象 + 记调用链）+ `handleThrow`。
同样升级的指令：idiv/irem/ldiv/lrem（除零）、xaload/xastore（NPE/越界）、
arraylength（NPE）、athrow null（NPE）。升级后 `catch (ArithmeticException e)`
真的能接到除零——ExceptionTest 的 1101 就是这么来的。

### 未捕获异常的终点

`UncaughtJvmException` 是个携带堆中异常对象的 JS Error，
一路穿过解释器循环到 main.js：

```js
// src/day9/main.js
try {
  runThread(thread);
} catch (e) {
  if (e instanceof UncaughtJvmException) {
    printStackTrace(e.exObj);     // 走 day8 的 sink（web 端渲染到终端面板）
    process.exit(1);              // 真实 JVM 未捕获异常也是非零退出
  }
  throw e;
}
```

**JS 异常只用来表达"JVM 线程终止"这一个语义**，Java 层的 try/catch
全程不经过 JS 的 try/catch——两套异常机制层次清晰。

## 关键细节

1. **athrow null 抛 NPE**（§6.5 athrow）：`athrow` 栈顶是 null 时不是 UB，
   规范明确规定抛 NullPointerException。
2. **finally 的 catch-all 条目也匹配异常**：所以 finally 块在异常路径上也会执行，
   执行完靠末尾的 `athrow`（javac 生成）重新抛出——`extra !== null` 的判断
   保证了重抛时调用链不被覆盖。
3. **桩 JDK 的异常继承链**：`Throwable ← Exception ← RuntimeException ←
   ArithmeticException`，catch Exception 匹配靠的就是这个链 +
   `isSuperClassOf`。

## 动手实验

1. 给 ExceptionTest 加嵌套 try：内层 catch RuntimeException，外层 catch Exception，
   内层抛 ArithmeticException——预测并验证谁接到（异常表从上到下首个匹配者胜出）。
2. 在 finally 里写 `return;`，观察异常被"吞掉"——用 `javap -c` 看 javac
   在 finally 的 catch-all 路径上生成了什么（athrow 被 return 替代了）。
3. 把 UncaughtTest 的异常改成 `throw new Exception()`（受检异常），
   javac 会报什么错？想想受检异常是**编译器**的特性还是 JVM 的特性
   （答案：字节码层面没有受检异常的概念，纯粹是 javac 的检查）。
