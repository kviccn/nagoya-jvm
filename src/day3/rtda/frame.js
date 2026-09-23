// 书第4章 / JVMS §2.6 —— 栈帧：局部变量表 + 操作数栈 + 当前方法/类
import { Slots } from './slot.js';
import { OperandStack } from './operandStack.js';

export class Frame {
  constructor(thread, maxLocals, maxStack) {
    this.thread = thread;
    this.localVars = new Slots(maxLocals);
    this.operandStack = new OperandStack(maxStack);
    this.method = null;   // day4 挂伪方法对象，day5 起挂 heap.Method
    this.nextPc = 0;      // 下一条指令的 pc（解释器维护）
    this.lower = null;    // 链表指针（Stack 用数组实现，此字段仅示意）
  }

  // 跳转指令用：以当前方法代码起始为基准的绝对 pc
  branch(offset) {
    const pc = this.thread.pc; // 当前指令的 pc
    this.nextPc = pc + offset;
  }

  // 书第7章 InitClass 配合：撤销 nextPc，让当前指令在 <clinit> 返回后重新执行
  revertNextPC() {
    this.nextPc = this.thread.pc;
  }
}
