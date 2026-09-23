// 书第5章 / JVMS §6.5 —— 指令基类与字节码读取器
export class BytecodeReader {
  constructor() {
    this.code = null;
    this.pc = 0;
  }

  reset(code, pc) {
    this.code = code;
    this.pc = pc;
  }

  readUint8() { return this.code[this.pc++]; }
  readInt8() { const v = this.code[this.pc++]; return v > 127 ? v - 256 : v; }

  readUint16() {
    const v = (this.code[this.pc] << 8) | this.code[this.pc + 1];
    this.pc += 2;
    return v >>> 0;
  }

  readInt16() {
    const v = this.readUint16();
    return v > 32767 ? v - 65536 : v;
  }

  readInt32() {
    const v = (this.code[this.pc] << 24) | (this.code[this.pc + 1] << 16)
      | (this.code[this.pc + 2] << 8) | this.code[this.pc + 3];
    this.pc += 4;
    return v | 0;
  }

  // tableswitch/lookupswitch：操作数按 4 字节对齐（相对方法代码起始）
  skipPadding() {
    while (this.pc % 4 !== 0) this.pc++;
  }
}

// ---- 指令基类：fetchOperands 读操作数，execute 执行 ----
export class NoOperandsInstruction {
  fetchOperands() {}
  execute() { throw new Error('not implemented'); }
}

// 带一个 u8 操作数（多为局部变量表索引或常量池索引）
export class Index8Instruction {
  fetchOperands(reader) { this.index = reader.readUint8(); }
}

// 带一个 u16 操作数（常量池索引）
export class Index16Instruction {
  fetchOperands(reader) { this.index = reader.readUint16(); }
}

// 跳转指令：i16 偏移量（相对当前指令 pc）
export class BranchInstruction {
  fetchOperands(reader) { this.offset = reader.readInt16(); }
  execute(frame) { frame.branch(this.offset); }
}

// 辅助：统一生成"加载/存储"类指令
export function makeLoad(popFn, setFn) {
  return class extends NoOperandsInstruction {
    fetchOperands(reader) { this.index = undefined; }
    execute(frame) {
      const v = popFn(frame.operandStack);
      setFn(frame.localVars, this.index, v);
    }
  };
}
