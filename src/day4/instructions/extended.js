// 书第5章 / §6.5 —— 扩展指令：wide（0xc4）、goto_w（0xc8）、ifnull/ifnonnull（0xc6/0xc7）
import { NoOperandsInstruction, BranchInstruction, BytecodeReader } from './base.js';
import { iload, lload, fload, dload, aload } from './loads.js';
import { istore, lstore, fstore, dstore, astore } from './stores.js';
import { Iinc } from './math.js';

// ifnull / ifnonnull
export class IfNull extends BranchInstruction {
  execute(frame) {
    if (frame.operandStack.popRef() === null) frame.branch(this.offset);
  }
}
export class IfNonNull extends BranchInstruction {
  execute(frame) {
    if (frame.operandStack.popRef() !== null) frame.branch(this.offset);
  }
}

// goto_w：32 位偏移
export class GotoW {
  fetchOperands(reader) { this.offset = reader.readInt32(); }
  execute(frame) { frame.branch(this.offset); }
}

// wide：把局部变量表索引/自增常量扩展为 16 位
const MODIFIED = {
  0x15: iload, 0x16: lload, 0x17: fload, 0x18: dload, 0x19: aload,
  0x36: istore, 0x37: lstore, 0x38: fstore, 0x39: dstore, 0x3a: astore,
};

export class Wide {
  fetchOperands(reader) {
    const opcode = reader.readUint8();
    if (opcode === 0x84) { // wide iinc：u16 index + i16 const
      this.inst = new Iinc();
      this.inst.index = reader.readUint16();
      this.inst.constVal = reader.readInt16();
      this.inst.fetchOperands = () => {};
    } else {
      const Cls = MODIFIED[opcode];
      if (!Cls) throw new Error(`Unsupported opcode after wide: 0x${opcode.toString(16)}`);
      this.inst = new Cls();
      this.inst.index = reader.readUint16();
      this.inst.fetchOperands = () => {};
    }
  }
  execute(frame) { this.inst.execute(frame); }
}
