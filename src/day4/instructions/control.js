// 书第5章 / §6.5 —— return 系列（0xac~0xb1）：弹返回值、弹帧、把结果压回调用者栈
import { NoOperandsInstruction } from './base.js';

function makeReturn(popFn) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const thread = frame.thread;
      const currentFrame = thread.popFrame();
      if (thread.isStackEmpty()) return; // main 方法返回，解释器循环结束
      const invokerFrame = thread.currentFrame();
      if (popFn) {
        const retVal = popFn(currentFrame.operandStack);
        pushTo(invokerFrame.operandStack, popFn, retVal);
      }
    }
  };
}

function pushTo(s, popFn, v) {
  if (popFn === popLong) s.pushLong(v);
  else if (popFn === popDouble) s.pushDouble(v);
  else if (popFn === popFloat) s.pushFloat(v);
  else if (popFn === popRef) s.pushRef(v);
  else s.pushInt(v);
}

const popInt = (s) => s.popInt();
const popLong = (s) => s.popLong();
const popFloat = (s) => s.popFloat();
const popDouble = (s) => s.popDouble();
const popRef = (s) => s.popRef();

export const ireturn = makeReturn(popInt);
export const lreturn = makeReturn(popLong);
export const freturn = makeReturn(popFloat);
export const dreturn = makeReturn(popDouble);
export const areturn = makeReturn(popRef);
export const _return = makeReturn(null);
