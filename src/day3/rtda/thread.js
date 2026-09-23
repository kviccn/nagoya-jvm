// 书第4章 / JVMS §2.5.1 —— 线程：pc 寄存器 + 虚拟机栈
import { Stack } from './stack.js';
import { Frame } from './frame.js';

export class Thread {
  constructor() {
    this.pc = 0;          // 当前正在执行的指令地址（循环每轮更新）
    this.stack = new Stack();
  }

  pushFrame(frame) { this.stack.push(frame); }
  popFrame() { return this.stack.pop(); }
  currentFrame() { return this.stack.top(); }
  isStackEmpty() { return this.stack.isEmpty(); }
  getFrames() { return this.stack.getFrames(); }

  // 便捷：为方法创建帧（day5 heap.Method / day4 伪方法通用）
  newFrame(method) {
    const frame = new Frame(this, method.maxLocals, method.maxStack);
    frame.method = method;
    return frame;
  }
}
