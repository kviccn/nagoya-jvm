// 书第5章 / §6.5 —— 操作数栈操作指令（0x57~0x5f）
import { NoOperandsInstruction } from './base.js';

// pop：弹出一个槽位
export class Pop extends NoOperandsInstruction {
  execute(frame) { frame.operandStack.popSlot(); }
}

// pop2：弹出两个槽位（long/double 用）
export class Pop2 extends NoOperandsInstruction {
  execute(frame) {
    frame.operandStack.popSlot();
    frame.operandStack.popSlot();
  }
}

// dup：复制栈顶一个槽位
export class Dup extends NoOperandsInstruction {
  execute(frame) {
    const s = frame.operandStack;
    s.pushSlot(s.slots[s.size - 1]); // 复制栈顶槽位
  }
}

// dup_x1：..., v2, v1 → ..., v1, v2, v1
export class DupX1 extends NoOperandsInstruction {
  execute(frame) {
    const s = frame.operandStack;
    const v1 = s.popSlot();
    const v2 = s.popSlot();
    s.pushSlot(v1);
    s.pushSlot(v2);
    s.pushSlot(v1);
  }
}

// dup_x2：..., v3, v2, v1 → ..., v1, v3, v2, v1
export class DupX2 extends NoOperandsInstruction {
  execute(frame) {
    const s = frame.operandStack;
    const v1 = s.popSlot();
    const v2 = s.popSlot();
    const v3 = s.popSlot();
    s.pushSlot(v1);
    s.pushSlot(v3);
    s.pushSlot(v2);
    s.pushSlot(v1);
  }
}

// dup2：复制栈顶两个槽位
export class Dup2 extends NoOperandsInstruction {
  execute(frame) {
    const s = frame.operandStack;
    const v1 = s.popSlot();
    const v2 = s.popSlot();
    s.pushSlot(v2);
    s.pushSlot(v1);
    s.pushSlot(v2);
    s.pushSlot(v1);
  }
}

// dup2_x1：..., v3, {v2, v1} → ..., {v2, v1}, v3, {v2, v1}
export class Dup2X1 extends NoOperandsInstruction {
  execute(frame) {
    const s = frame.operandStack;
    const v1 = s.popSlot();
    const v2 = s.popSlot();
    const v3 = s.popSlot();
    s.pushSlot(v2);
    s.pushSlot(v1);
    s.pushSlot(v3);
    s.pushSlot(v2);
    s.pushSlot(v1);
  }
}

// dup2_x2
export class Dup2X2 extends NoOperandsInstruction {
  execute(frame) {
    const s = frame.operandStack;
    const v1 = s.popSlot();
    const v2 = s.popSlot();
    const v3 = s.popSlot();
    const v4 = s.popSlot();
    s.pushSlot(v2);
    s.pushSlot(v1);
    s.pushSlot(v4);
    s.pushSlot(v3);
    s.pushSlot(v2);
    s.pushSlot(v1);
  }
}

// swap：交换栈顶两个槽位
export class Swap extends NoOperandsInstruction {
  execute(frame) {
    const s = frame.operandStack;
    const v1 = s.popSlot();
    const v2 = s.popSlot();
    s.pushSlot(v1);
    s.pushSlot(v2);
  }
}
