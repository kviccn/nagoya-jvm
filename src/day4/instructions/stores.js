// 书第5章 / §6.5 —— store 系列：操作数栈 → 局部变量表（0x36~0x4e）
import { NoOperandsInstruction, Index8Instruction } from './base.js';

function popByKind(frame, kind) {
  const s = frame.operandStack;
  switch (kind) {
    case 'long': return s.popLong();
    case 'double': return s.popDouble();
    case 'float': return s.popFloat();
    case 'ref': return s.popRef();
    default: return s.popInt();
  }
}

function setByKind(localVars, kind, i, v) {
  switch (kind) {
    case 'long': return localVars.setLong(i, v);
    case 'double': return localVars.setDouble(i, v);
    case 'float': return localVars.setFloat(i, v);
    case 'ref': return localVars.setRef(i, v);
    default: return localVars.setInt(i, v);
  }
}

function makeStore(kind) {
  return class extends Index8Instruction {
    execute(frame) {
      setByKind(frame.localVars, kind, this.index, popByKind(frame, kind));
    }
  };
}

function makeStoreN(kind, n) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      setByKind(frame.localVars, kind, n, popByKind(frame, kind));
    }
  };
}

export const istore = makeStore('int');
export const lstore = makeStore('long');
export const fstore = makeStore('float');
export const dstore = makeStore('double');
export const astore = makeStore('ref');

export const istore_0 = makeStoreN('int', 0);
export const istore_1 = makeStoreN('int', 1);
export const istore_2 = makeStoreN('int', 2);
export const istore_3 = makeStoreN('int', 3);
export const lstore_0 = makeStoreN('long', 0);
export const lstore_1 = makeStoreN('long', 1);
export const lstore_2 = makeStoreN('long', 2);
export const lstore_3 = makeStoreN('long', 3);
export const fstore_0 = makeStoreN('float', 0);
export const fstore_1 = makeStoreN('float', 1);
export const fstore_2 = makeStoreN('float', 2);
export const fstore_3 = makeStoreN('float', 3);
export const dstore_0 = makeStoreN('double', 0);
export const dstore_1 = makeStoreN('double', 1);
export const dstore_2 = makeStoreN('double', 2);
export const dstore_3 = makeStoreN('double', 3);
export const astore_0 = makeStoreN('ref', 0);
export const astore_1 = makeStoreN('ref', 1);
export const astore_2 = makeStoreN('ref', 2);
export const astore_3 = makeStoreN('ref', 3);
