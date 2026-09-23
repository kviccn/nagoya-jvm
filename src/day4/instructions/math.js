// 书第5章 / §6.5 —— 算术指令（0x60~0x84）
// int 用 JS number（| 0 保证 32 位），long 用 BigInt，float 用 Math.fround
import { NoOperandsInstruction } from './base.js';

function intBinary(fn) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = s.popInt();
      const v1 = s.popInt();
      s.pushInt(fn(v1, v2));
    }
  };
}

function longBinary(fn) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = s.popLong();
      const v1 = s.popLong();
      s.pushLong(fn(v1, v2));
    }
  };
}

function floatBinary(fn) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = s.popFloat();
      const v1 = s.popFloat();
      s.pushFloat(fn(v1, v2));
    }
  };
}

function doubleBinary(fn) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = s.popDouble();
      const v1 = s.popDouble();
      s.pushDouble(fn(v1, v2));
    }
  };
}

// add/sub/mul/div/rem
export const iadd = intBinary((a, b) => a + b);
export const ladd = longBinary((a, b) => a + b);
export const fadd = floatBinary((a, b) => a + b);
export const dadd = doubleBinary((a, b) => a + b);
export const isub = intBinary((a, b) => a - b);
export const lsub = longBinary((a, b) => a - b);
export const fsub = floatBinary((a, b) => a - b);
export const dsub = doubleBinary((a, b) => a - b);
export const imul = intBinary((a, b) => Math.imul(a, b)); // 32 位乘法溢出语义
export const lmul = longBinary((a, b) => BigInt.asIntN(64, a * b));
export const fmul = floatBinary((a, b) => a * b);
export const dmul = doubleBinary((a, b) => a * b);
export const idiv = intBinary((a, b) => (a / b) | 0); // day9 会升级为抛 ArithmeticException
export const ldiv = longBinary((a, b) => a / b);
export const fdiv = floatBinary((a, b) => a / b);
export const ddiv = doubleBinary((a, b) => a / b);
export const irem = intBinary((a, b) => a % b);
export const lrem = longBinary((a, b) => a % b);
export const frem = floatBinary((a, b) => a % b);
export const drem = doubleBinary((a, b) => a % b);

// neg
function unary(popFn, pushFn, fn) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      pushFn(s, fn(popFn(s)));
    }
  };
}
export const ineg = unary((s) => s.popInt(), (s, v) => s.pushInt(v), (v) => -v);
export const lneg = unary((s) => s.popLong(), (s, v) => s.pushLong(v), (v) => -v);
export const fneg = unary((s) => s.popFloat(), (s, v) => s.pushFloat(v), (v) => -v);
export const dneg = unary((s) => s.popDouble(), (s, v) => s.pushDouble(v), (v) => -v);

// 移位（int 移位距离取低 5 位，long 取低 6 位，§6.5 注）
export const ishl = intBinary((a, b) => a << (b & 0x1f));
export const lshl = longBinary((a, b) => a << (b & 0x3fn));
export const ishr = intBinary((a, b) => a >> (b & 0x1f));
export const lshr = longBinary((a, b) => a >> (b & 0x3fn));
export const iushr = intBinary((a, b) => a >>> (b & 0x1f));
export const lushr = longBinary((a, b) => BigInt.asIntN(64, BigInt.asUintN(64, a) >> (b & 0x3fn)));

// 位运算
export const iand = intBinary((a, b) => a & b);
export const land = longBinary((a, b) => a & b);
export const ior = intBinary((a, b) => a | b);
export const lor = longBinary((a, b) => a | b);
export const ixor = intBinary((a, b) => a ^ b);
export const lxor = longBinary((a, b) => a ^ b);

// iinc：局部变量自增
export class Iinc extends NoOperandsInstruction {
  fetchOperands(reader) {
    this.index = reader.readUint8();
    this.constVal = reader.readInt8();
  }
  execute(frame) {
    const lv = frame.localVars;
    lv.setInt(this.index, (lv.getInt(this.index) + this.constVal) | 0);
  }
}
