// 书第5章 / §6.5 —— 类型转换指令（0x85~0x93）
import { NoOperandsInstruction } from './base.js';

function conv(popFn, pushFn, fn) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      pushFn(s, fn(popFn(s)));
    }
  };
}

export const i2b = conv((s) => s.popInt(), (s, v) => s.pushInt(v), (v) => (v << 24) >> 24);
export const i2c = conv((s) => s.popInt(), (s, v) => s.pushInt(v), (v) => v & 0xffff);
export const i2s = conv((s) => s.popInt(), (s, v) => s.pushInt(v), (v) => (v << 16) >> 16);
export const i2l = conv((s) => s.popInt(), (s, v) => s.pushLong(v), (v) => BigInt(v));
export const i2f = conv((s) => s.popInt(), (s, v) => s.pushFloat(v), (v) => v);
export const i2d = conv((s) => s.popInt(), (s, v) => s.pushDouble(v), (v) => v);

export const l2i = conv((s) => s.popLong(), (s, v) => s.pushInt(v), (v) => Number(BigInt.asIntN(32, v)));
export const l2f = conv((s) => s.popLong(), (s, v) => s.pushFloat(v), (v) => Number(v));
export const l2d = conv((s) => s.popLong(), (s, v) => s.pushDouble(v), (v) => Number(v));

export const f2i = conv((s) => s.popFloat(), (s, v) => s.pushInt(v), f2longLikeInt);
export const f2l = conv((s) => s.popFloat(), (s, v) => s.pushLong(v), f2longLike);
export const f2d = conv((s) => s.popFloat(), (s, v) => s.pushDouble(v), (v) => v);

export const d2i = conv((s) => s.popDouble(), (s, v) => s.pushInt(v), f2longLikeInt);
export const d2l = conv((s) => s.popDouble(), (s, v) => s.pushLong(v), f2longLike);
export const d2f = conv((s) => s.popDouble(), (s, v) => s.pushFloat(v), (v) => v);

// JVMS §2.8.3：float/double → int/long 的窄化规则（NaN→0，溢出→MAX/MIN，向零取整）
function f2longLikeInt(v) {
  if (Number.isNaN(v)) return 0;
  if (v >= 2147483647) return 2147483647;
  if (v <= -2147483648) return -2147483648;
  return v | 0;
}

function f2longLike(v) {
  if (Number.isNaN(v)) return 0n;
  if (v >= Number(9223372036854775807n)) return 9223372036854775807n;
  if (v <= Number(-9223372036854775808n)) return -9223372036854775808n;
  return BigInt(Math.trunc(v));
}
