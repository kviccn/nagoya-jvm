// 书第6章 —— 堆中的对象：普通对象 data 是 Slots（字段槽），day7 数组 data 是 JS 数组
export class JObject {
  constructor(jClass, data) {
    this.class = jClass;   // 对象属于哪个类
    this.data = data;      // Slots | Array
    this.extra = null;     // VM 私有扩展位（day8 StringBuilder 缓冲、day9 异常栈）
  }

  isInstanceOf(jClass) {
    return jClass.isAssignableFrom(this.class);
  }

  fields() { return this.data; }

  // 按名字+描述符读写实例字段（native 方法和 VM 内部用）
  getRefVar(name, descriptor) {
    const field = this.class.getField(name, descriptor, false);
    return this.data.getRef(field.slotId);
  }

  setRefVar(name, descriptor, ref) {
    const field = this.class.getField(name, descriptor, false);
    this.data.setRef(field.slotId, ref);
  }

  getIntVar(name, descriptor) {
    const field = this.class.getField(name, descriptor, false);
    return this.data.getInt(field.slotId);
  }

  setIntVar(name, descriptor, val) {
    const field = this.class.getField(name, descriptor, false);
    this.data.setInt(field.slotId, val);
  }
}
