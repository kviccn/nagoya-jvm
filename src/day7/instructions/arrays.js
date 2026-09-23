// 书第8章 / §6.5 —— 数组指令（0x2e~0x35, 0x4f~0x56, 0xbc~0xbe, 0xc5）+ ldc 字符串升级
import { NoOperandsInstruction, Index8Instruction, Index16Instruction } from '../../day4/instructions/base.js';
import { register } from '../../day4/instructions/factory.js';
import { newArray, arrayLength, checkArrayBounds } from '../heap/array.js';
import { getArrayClassName } from '../../day5/heap/class.js';
import { jString } from '../heap/stringPool.js';

function cpOf(frame) { return frame.method.class.constantPool; }

// ---- ldc / ldc_w 升级：支持字符串字面量（覆盖 day5 的注册） ----
function ldc(frame, index) {
  const stack = frame.operandStack;
  const c = cpOf(frame).getConstant(index);
  switch (c.type) {
    case 'int': return stack.pushInt(c.value);
    case 'float': return stack.pushFloat(c.value);
    case 'long': return stack.pushLong(c.value);
    case 'double': return stack.pushDouble(c.value);
    case 'string': return stack.pushRef(jString(frame.method.class.loader, c.value));
    default: throw new Error(`ldc: 不支持的常量类型 ${c.type}`);
  }
}
class Ldc extends Index8Instruction {
  execute(frame) { ldc(frame, this.index); }
}
class LdcW extends Index16Instruction {
  execute(frame) { ldc(frame, this.index); }
}

// ---- newarray：基本类型数组，操作数是 atype（§6.5 newarray） ----
const ATYPES = {
  4: '[Z', 5: '[C', 6: '[F', 7: '[D', 8: '[B', 9: '[S', 10: '[I', 11: '[J',
};

class NewArray {
  fetchOperands(reader) { this.atype = reader.readUint8(); }
  execute(frame) {
    const count = frame.operandStack.popInt();
    if (count < 0) throw new Error(`NegativeArraySizeException: ${count}`);
    const arrClass = frame.method.class.loader.loadClass(ATYPES[this.atype]);
    frame.operandStack.pushRef(newArray(arrClass, count));
  }
}

// ---- anewarray：引用类型数组，操作数是常量池类引用 ----
class ANewArray extends Index16Instruction {
  execute(frame) {
    const componentClass = cpOf(frame).getConstant(this.index).resolvedClass();
    const count = frame.operandStack.popInt();
    if (count < 0) throw new Error(`NegativeArraySizeException: ${count}`);
    const arrClass = frame.method.class.loader.loadClass(getArrayClassName(componentClass.name));
    frame.operandStack.pushRef(newArray(arrClass, count));
  }
}

class ArrayLength extends NoOperandsInstruction {
  execute(frame) {
    const arrRef = frame.operandStack.popRef();
    if (arrRef === null) throw new Error('NullPointerException');
    frame.operandStack.pushInt(arrayLength(arrRef));
  }
}

// ---- xaload / xastore ----
function makeALoad(kind) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const index = s.popInt();
      const arrRef = s.popRef();
      if (arrRef === null) throw new Error('NullPointerException');
      checkArrayBounds(arrRef, index);
      const v = arrRef.data[index];
      if (kind === 'long') s.pushLong(v);
      else if (kind === 'double') s.pushDouble(v);
      else if (kind === 'float') s.pushFloat(v);
      else if (kind === 'ref') s.pushRef(v);
      else s.pushInt(v); // byte/char/short/boolean 都以 int 入栈
    }
  };
}

function makeAStore(kind) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      let v, index, arrRef;
      if (kind === 'long') { v = s.popLong(); index = s.popInt(); arrRef = s.popRef(); }
      else if (kind === 'double') { v = s.popDouble(); index = s.popInt(); arrRef = s.popRef(); }
      else if (kind === 'float') { v = s.popFloat(); index = s.popInt(); arrRef = s.popRef(); }
      else if (kind === 'ref') { v = s.popRef(); index = s.popInt(); arrRef = s.popRef(); }
      else { v = s.popInt(); index = s.popInt(); arrRef = s.popRef(); }
      if (arrRef === null) throw new Error('NullPointerException');
      checkArrayBounds(arrRef, index);
      arrRef.data[index] = v;
    }
  };
}

// ---- multianewarray：多维数组 ----
class MultiANewArray extends Index16Instruction {
  fetchOperands(reader) {
    super.fetchOperands(reader);
    this.dimensions = reader.readUint8();
  }
  execute(frame) {
    const arrClass = cpOf(frame).getConstant(this.index).resolvedClass();
    const counts = new Array(this.dimensions);
    for (let i = this.dimensions - 1; i >= 0; i--) {
      counts[i] = frame.operandStack.popInt();
    }
    frame.operandStack.pushRef(newMultiArray(arrClass, counts));
  }
}

function newMultiArray(arrClass, counts) {
  const arr = newArray(arrClass, counts[0]);
  if (counts.length > 1) {
    const componentArrClass = arrClass.componentClass();
    for (let i = 0; i < arr.data.length; i++) {
      arr.data[i] = newMultiArray(componentArrClass, counts.slice(1));
    }
  }
  return arr;
}

// 注册（覆盖 day5 的 ldc）
register(0x12, new Ldc());
register(0x13, new LdcW());
const inst = (Cls) => new Cls();
register(0x2e, inst(makeALoad('int')));
register(0x2f, inst(makeALoad('long')));
register(0x30, inst(makeALoad('float')));
register(0x31, inst(makeALoad('double')));
register(0x32, inst(makeALoad('ref')));
register(0x33, inst(makeALoad('byte')));
register(0x34, inst(makeALoad('char')));
register(0x35, inst(makeALoad('short')));
register(0x4f, inst(makeAStore('int')));
register(0x50, inst(makeAStore('long')));
register(0x51, inst(makeAStore('float')));
register(0x52, inst(makeAStore('double')));
register(0x53, inst(makeAStore('ref')));
register(0x54, inst(makeAStore('byte')));
register(0x55, inst(makeAStore('char')));
register(0x56, inst(makeAStore('short')));
register(0xbc, new NewArray());
register(0xbd, new ANewArray());
register(0xbe, new ArrayLength());
register(0xc5, new MultiANewArray());
