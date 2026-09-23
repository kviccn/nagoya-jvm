// 书第5章 / §6.5 —— 常量系列指令（0x01~0x14，ldc 系列在 day5/day7）
import { NoOperandsInstruction } from './base.js';

function constPush(pushFn, value) {
  return class extends NoOperandsInstruction {
    execute(frame) { pushFn(frame.operandStack, value); }
  };
}

export class Nop extends NoOperandsInstruction {
  execute() {}
}

export const aconst_null = constPush((s) => s.pushRef(null));
export const iconst_m1 = constPush((s) => s.pushInt(-1), -1);
export const iconst_0 = constPush((s) => s.pushInt(0));
export const iconst_1 = constPush((s) => s.pushInt(1));
export const iconst_2 = constPush((s) => s.pushInt(2));
export const iconst_3 = constPush((s) => s.pushInt(3));
export const iconst_4 = constPush((s) => s.pushInt(4));
export const iconst_5 = constPush((s) => s.pushInt(5));
export const lconst_0 = constPush((s) => s.pushLong(0n));
export const lconst_1 = constPush((s) => s.pushLong(1n));
export const fconst_0 = constPush((s) => s.pushFloat(0));
export const fconst_1 = constPush((s) => s.pushFloat(1));
export const fconst_2 = constPush((s) => s.pushFloat(2));
export const dconst_0 = constPush((s) => s.pushDouble(0));
export const dconst_1 = constPush((s) => s.pushDouble(1));

export class Bipush extends NoOperandsInstruction {
  fetchOperands(reader) { this.val = reader.readInt8(); }
  execute(frame) { frame.operandStack.pushInt(this.val); }
}

export class Sipush extends NoOperandsInstruction {
  fetchOperands(reader) { this.val = reader.readInt16(); }
  execute(frame) { frame.operandStack.pushInt(this.val); }
}
