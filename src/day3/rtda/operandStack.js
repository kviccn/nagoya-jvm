// 书第4章 / JVMS §2.6.2 —— 操作数栈
import { Slot } from './slot.js';

export class OperandStack {
  constructor(maxStack) {
    this.size = 0;
    this.slots = Array.from({ length: maxStack }, () => new Slot());
  }

  // 按值复制槽位（不能共享 Slot 对象，否则 dup 后 pop 会互相污染）
  pushSlot(slot) {
    this.slots[this.size] = new Slot(slot.num, slot.ref);
    this.size++;
  }
  popSlot() {
    const s = this.slots[--this.size];
    const copy = new Slot(s.num, s.ref);
    this.slots[this.size] = new Slot();
    return copy;
  }

  pushInt(v) { const s = this.slots[this.size++]; s.num = v | 0; s.ref = null; }
  popInt() { return this.slots[--this.size].num | 0; }

  pushFloat(v) { const s = this.slots[this.size++]; s.num = Math.fround(v); s.ref = null; }
  popFloat() { return Math.fround(this.slots[--this.size].num); }

  // long/double 压两个槽
  pushLong(v) { const s = this.slots[this.size]; s.num = BigInt(v); s.ref = null; this.size += 2; }
  popLong() { this.size -= 2; return BigInt(this.slots[this.size].num); }

  pushDouble(v) { const s = this.slots[this.size]; s.num = v; s.ref = null; this.size += 2; }
  popDouble() { this.size -= 2; return this.slots[this.size].num; }

  pushRef(r) { const s = this.slots[this.size++]; s.ref = r; s.num = 0; }
  popRef() { const r = this.slots[--this.size].ref; this.slots[this.size].ref = null; return r; }

  // 供 invokevirtual 等指令在不弹栈的情况下拿到 this
  getRefFromTop(n) { return this.slots[this.size - 1 - n].ref; }

  clear() {
    this.size = 0;
    for (const s of this.slots) { s.num = 0; s.ref = null; }
  }

  toString() {
    return Array.from({ length: this.size }, (_, i) => {
      const s = this.slots[i];
      return s.ref !== null ? 'ref' : `${s.num}`;
    }).join(',');
  }
}
