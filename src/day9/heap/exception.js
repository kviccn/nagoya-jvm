// 书第10章 / §2.10 —— 异常的抛出与传播：查异常表 → 逐帧展开 → 未捕获则终止
// 由 athrow 指令或 VM 内部（除零、数组越界、NPE）触发

// 未捕获异常（JS 侧）：携带堆中异常对象，由 main.js 打印调用链
export class UncaughtJvmException extends Error {
  constructor(exObj) {
    super(`未捕获的异常: ${exObj.class.name}`);
    this.exObj = exObj;
  }
}

// 创建异常对象并记录当前调用栈（等价于 fillInStackTrace）
export function newException(thread, loader, className) {
  const exClass = loader.loadClass(className);
  const exObj = exClass.newObject();
  attachStackTrace(thread, exObj);
  return exObj;
}

// 把当前线程的调用栈（栈顶在前）挂到异常对象的 extra 扩展位
export function attachStackTrace(thread, exObj) {
  if (exObj.extra !== null) return; // 重抛的异常保留原栈
  exObj.extra = {
    stackTrace: thread.getFrames().map((f) => {
      const m = f.method;
      return `${m.class.name}.${m.name}${m.descriptor}`;
    }),
  };
}

// 核心：为 exObj 寻找 handler；找不到就逐帧展开（§2.10 异常抛出语义）
export function handleThrow(frame, exObj) {
  const thread = frame.thread;
  attachStackTrace(thread, exObj);
  while (true) {
    const f = thread.currentFrame();
    // f.nextPc - 1：当前指令（或调用指令）的地址，用它判断是否在 try 范围内
    const handlerPc = f.method.findExceptionHandler(exObj.class, f.nextPc - 1);
    if (handlerPc > 0) {
      f.operandStack.clear();       // §2.6.2：进入 handler 时操作数栈只剩异常引用
      f.operandStack.pushRef(exObj);
      f.nextPc = handlerPc;
      return; // 解释器循环从 handler 继续执行
    }
    thread.popFrame(); // 本帧没有 handler，展开到调用者
    if (thread.isStackEmpty()) {
      throw new UncaughtJvmException(exObj);
    }
  }
}

// VM 内部抛异常的便捷入口（除零、越界、NPE……）
export function throwNew(frame, className) {
  const exObj = newException(frame.thread, frame.method.class.loader, className);
  handleThrow(frame, exObj);
}

// 打印异常调用链（uncaught 时由 main 调用，printStackTrace native 也用）
// 走 day8 的可注入 sink，web 端会渲染到终端面板
import { sinkError } from '../../day8/native/output.js';

export function printStackTrace(exObj) {
  sinkError(`Exception in thread "main" ${exObj.class.name.replaceAll('/', '.')}`);
  for (const line of exObj.extra?.stackTrace ?? []) {
    sinkError(`\tat ${line}`);
  }
}
