// 书第4章 / JVMS §2.6.1 —— Slot：局部变量表和操作数栈的基本单元
// num 存 int/float（JS number，float 用 Math.fround 截断）或 long（BigInt），ref 存引用
export class Slot {
  constructor(num = 0, ref = null) {
    this.num = num;
    this.ref = ref;
  }
}

// Slots：一组连续槽位 —— 局部变量表、类的静态变量、对象的实例字段共用此结构
export class Slots {
  constructor(size) {
    this.slots = Array.from({ length: size }, () => new Slot());
  }

  setInt(i, v) { this.slots[i].num = v | 0; }
  getInt(i) { return this.slots[i].num | 0; }

  setFloat(i, v) { this.slots[i].num = Math.fround(v); }
  getFloat(i) { return Math.fround(this.slots[i].num); }

  // long/double 占两个槽位（§2.6.1）
  setLong(i, v) { this.slots[i].num = BigInt(v); this.slots[i + 1] = new Slot(); }
  getLong(i) { return BigInt(this.slots[i].num); }

  setDouble(i, v) { this.slots[i].num = v; this.slots[i + 1] = new Slot(); }
  getDouble(i) { return this.slots[i].num; }

  setRef(i, r) { this.slots[i].ref = r; }
  getRef(i) { return this.slots[i].ref; }

  setSlot(i, slot) { this.slots[i] = slot; }
  getSlot(i) { return this.slots[i]; }

  toString() {
    return this.slots.map((s) => (s.ref !== null ? `ref` : `${s.num}`)).join(',');
  }
}
