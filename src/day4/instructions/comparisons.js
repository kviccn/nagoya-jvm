// 书第5章 / §6.5 —— 比较与跳转指令（0x94~0xa8）
import { NoOperandsInstruction, BranchInstruction, BytecodeReader } from './base.js';

// lcmp / fcmp / dcmp：比较后压入 -1/0/1
export class Lcmp extends NoOperandsInstruction {
  execute(frame) {
    const s = frame.operandStack;
    const v2 = s.popLong();
    const v1 = s.popLong();
    s.pushInt(v1 > v2 ? 1 : v1 === v2 ? 0 : -1);
  }
}

// NaN 语义：fcmpg/dcmpg 遇 NaN 压 1，fcmpl/dcmpl 遇 NaN 压 -1
function makeFcmp(gFlag, isDouble) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = isDouble ? s.popDouble() : s.popFloat();
      const v1 = isDouble ? s.popDouble() : s.popFloat();
      if (v1 > v2) s.pushInt(1);
      else if (v1 === v2) s.pushInt(0);
      else if (v1 < v2) s.pushInt(-1);
      else s.pushInt(gFlag ? 1 : -1); // NaN
    }
  };
}
export const fcmpg = makeFcmp(true, false);
export const fcmpl = makeFcmp(false, false);
export const dcmpg = makeFcmp(true, true);
export const dcmpl = makeFcmp(false, true);

// if<cond>：与 0 比较
function makeIf(cond) {
  return class extends BranchInstruction {
    execute(frame) {
      const v = frame.operandStack.popInt();
      if (cond(v)) frame.branch(this.offset);
    }
  };
}
export const ifeq = makeIf((v) => v === 0);
export const ifne = makeIf((v) => v !== 0);
export const iflt = makeIf((v) => v < 0);
export const ifge = makeIf((v) => v >= 0);
export const ifgt = makeIf((v) => v > 0);
export const ifle = makeIf((v) => v <= 0);

// if_icmp<cond>：弹两个 int 比较（注意先弹的是 value2）
function makeIfIcmp(cond) {
  return class extends BranchInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = s.popInt();
      const v1 = s.popInt();
      if (cond(v1, v2)) frame.branch(this.offset);
    }
  };
}
export const if_icmpeq = makeIfIcmp((a, b) => a === b);
export const if_icmpne = makeIfIcmp((a, b) => a !== b);
export const if_icmplt = makeIfIcmp((a, b) => a < b);
export const if_icmpge = makeIfIcmp((a, b) => a >= b);
export const if_icmpgt = makeIfIcmp((a, b) => a > b);
export const if_icmple = makeIfIcmp((a, b) => a <= b);

// if_acmp<cond>：引用比较
function makeIfAcmp(cond) {
  return class extends BranchInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = s.popRef();
      const v1 = s.popRef();
      if (cond(v1, v2)) frame.branch(this.offset);
    }
  };
}
export const if_acmpeq = makeIfAcmp((a, b) => a === b);
export const if_acmpne = makeIfAcmp((a, b) => a !== b);

export class Goto extends BranchInstruction {}

// tableswitch：对齐后读 default/low/high + 跳转偏移表
export class TableSwitch {
  fetchOperands(reader) {
    reader.skipPadding();
    this.defaultOffset = reader.readInt32();
    this.low = reader.readInt32();
    this.high = reader.readInt32();
    const count = this.high - this.low + 1;
    this.jumpOffsets = [];
    for (let i = 0; i < count; i++) this.jumpOffsets.push(reader.readInt32());
  }
  execute(frame) {
    const index = frame.operandStack.popInt();
    let offset;
    if (index >= this.low && index <= this.high) {
      offset = this.jumpOffsets[index - this.low];
    } else {
      offset = this.defaultOffset;
    }
    frame.branch(offset);
  }
}

// lookupswitch：对齐后读 default/npairs + (match, offset) 对
export class LookupSwitch {
  fetchOperands(reader) {
    reader.skipPadding();
    this.defaultOffset = reader.readInt32();
    const npairs = reader.readInt32();
    this.matchOffsets = new Map();
    for (let i = 0; i < npairs; i++) {
      this.matchOffsets.set(reader.readInt32(), reader.readInt32());
    }
  }
  execute(frame) {
    const key = frame.operandStack.popInt();
    const offset = this.matchOffsets.get(key) ?? this.defaultOffset;
    frame.branch(offset);
  }
}
