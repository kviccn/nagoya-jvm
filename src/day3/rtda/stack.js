// 书第4章 / JVMS §2.5.2 —— Java 虚拟机栈（固定容量，帧的 LIFO 栈）
const DEFAULT_CAPACITY = 1024;

export class Stack {
  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity;
    this.frames = [];
  }

  push(frame) {
    if (this.frames.length >= this.capacity) {
      throw new Error('StackOverflowError');
    }
    this.frames.push(frame);
  }

  pop() {
    const f = this.frames.pop();
    if (f === undefined) throw new Error('jvm stack is empty!');
    return f;
  }

  top() {
    const f = this.frames[this.frames.length - 1];
    if (f === undefined) throw new Error('jvm stack is empty!');
    return f;
  }

  isEmpty() { return this.frames.length === 0; }

  clear() { this.frames = []; }

  // 从栈顶到栈底遍历（day9 打印调用链用）
  getFrames() {
    return [...this.frames].reverse();
  }
}
