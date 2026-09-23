// 书第5章 / §6.5 —— load 系列：局部变量表 → 操作数栈（0x15~0x2d）
import { NoOperandsInstruction, Index8Instruction } from './base.js';

function load(frame, kind, i) {
  const lv = frame.localVars;
  const s = frame.operandStack;
  switch (kind) {
    case 'long': return s.pushLong(lv.getLong(i));
    case 'double': return s.pushDouble(lv.getDouble(i));
    case 'float': return s.pushFloat(lv.getFloat(i));
    case 'ref': return s.pushRef(lv.getRef(i));
    default: return s.pushInt(lv.getInt(i));
  }
}

function makeLoad(kind) {
  return class extends Index8Instruction {
    execute(frame) { load(frame, kind, this.index); }
  };
}

// _<n> 版本（无操作数，索引固定在指令里）
function makeLoadN(kind, n) {
  return class extends NoOperandsInstruction {
    execute(frame) { load(frame, kind, n); }
  };
}

export const iload = makeLoad('int');
export const lload = makeLoad('long');
export const fload = makeLoad('float');
export const dload = makeLoad('double');
export const aload = makeLoad('ref');

export const iload_0 = makeLoadN('int', 0);
export const iload_1 = makeLoadN('int', 1);
export const iload_2 = makeLoadN('int', 2);
export const iload_3 = makeLoadN('int', 3);
export const lload_0 = makeLoadN('long', 0);
export const lload_1 = makeLoadN('long', 1);
export const lload_2 = makeLoadN('long', 2);
export const lload_3 = makeLoadN('long', 3);
export const fload_0 = makeLoadN('float', 0);
export const fload_1 = makeLoadN('float', 1);
export const fload_2 = makeLoadN('float', 2);
export const fload_3 = makeLoadN('float', 3);
export const dload_0 = makeLoadN('double', 0);
export const dload_1 = makeLoadN('double', 1);
export const dload_2 = makeLoadN('double', 2);
export const dload_3 = makeLoadN('double', 3);
export const aload_0 = makeLoadN('ref', 0);
export const aload_1 = makeLoadN('ref', 1);
export const aload_2 = makeLoadN('ref', 2);
export const aload_3 = makeLoadN('ref', 3);
