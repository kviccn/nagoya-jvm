// 书第6章 / §5.4.3 —— 运行时常量池：符号引用（类/字段/方法）与字面量
import { cpRef } from '../../day2/classfile/constantPool.js';
import { lookupMethodInClass } from './method.js';

// ---- 符号引用基类（§5.4.3.1 类解析） ----
class SymRef {
  constructor(cp) {
    this.cp = cp;             // 所属的运行时常量池
    this.className = null;    // 被引用的类名
    this.resolvedClassCache = null;
  }

  resolvedClass() {
    if (!this.resolvedClassCache) {
      const d = this.cp.class;
      const c = d.loader.loadClass(this.className);
      if (!c.isAccessibleTo(d)) {
        throw new Error(`IllegalAccessError: ${d.name} -> ${c.name}`);
      }
      this.resolvedClassCache = c;
    }
    return this.resolvedClassCache;
  }
}

export class ClassRef extends SymRef {
  constructor(cp, className) {
    super(cp);
    this.className = className;
  }
}

export class FieldRef extends SymRef {
  constructor(cp, className, name, descriptor) {
    super(cp);
    this.className = className;
    this.name = name;
    this.descriptor = descriptor;
    this.resolvedFieldCache = null;
  }

  resolvedField() {
    if (!this.resolvedFieldCache) {
      const c = this.resolvedClass();
      const field = c.getField(this.name, this.descriptor);
      if (!field) throw new Error(`NoSuchFieldError: ${this.className}.${this.name}`);
      if (!field.isAccessibleTo(this.cp.class)) {
        throw new Error(`IllegalAccessError: ${this.className}.${this.name}`);
      }
      this.resolvedFieldCache = field;
    }
    return this.resolvedFieldCache;
  }
}

export class MethodRef extends SymRef {
  constructor(cp, className, name, descriptor) {
    super(cp);
    this.className = className;
    this.name = name;
    this.descriptor = descriptor;
    this.resolvedMethodCache = null;
  }

  resolvedMethod() {
    if (!this.resolvedMethodCache) {
      const c = this.resolvedClass();
      if (c.isInterface()) throw new Error(`IncompatibleClassChangeError: ${this.className}`);
      const method = lookupMethodInClass(c, this.name, this.descriptor);
      if (!method) throw new Error(`NoSuchMethodError: ${this.className}.${this.name}${this.descriptor}`);
      if (!method.isAccessibleTo(this.cp.class)) {
        throw new Error(`IllegalAccessError: ${this.className}.${this.name}`);
      }
      this.resolvedMethodCache = method;
    }
    return this.resolvedMethodCache;
  }
}

export class InterfaceMethodRef extends SymRef {
  constructor(cp, className, name, descriptor) {
    super(cp);
    this.className = className;
    this.name = name;
    this.descriptor = descriptor;
    this.resolvedMethodCache = null;
  }

  resolvedMethod() {
    if (!this.resolvedMethodCache) {
      const c = this.resolvedClass();
      if (!c.isInterface()) throw new Error(`IncompatibleClassChangeError: ${this.className}`);
      const method = lookupMethodInClass(c, this.name, this.descriptor);
      if (!method) throw new Error(`NoSuchMethodError: ${this.className}.${this.name}`);
      this.resolvedMethodCache = method;
    }
    return this.resolvedMethodCache;
  }
}

// ---- 运行时常量池：把 day2 解析出的原始常量池包装成运行期结构 ----
export class RuntimeConstantPool {
  constructor(jClass, rawCp) {
    this.class = jClass;
    this.rawCp = rawCp;
    this.consts = new Array(rawCp.length); // 解析结果缓存
  }

  getConstant(index) {
    if (this.consts[index] === undefined) {
      this.consts[index] = this.convert(index);
    }
    return this.consts[index];
  }

  convert(index) {
    const e = this.rawCp[index];
    switch (e.tag) {
      case 3: return { type: 'int', value: e.value };
      case 4: return { type: 'float', value: e.value };
      case 5: return { type: 'long', value: e.value };
      case 6: return { type: 'double', value: e.value };
      case 8: return { type: 'string', value: this.rawCp[e.nameIndex].value }; // day7 转成字符串对象
      case 7: return new ClassRef(this, this.rawCp[e.nameIndex].value);
      case 9: {
        const r = cpRef(this.rawCp, index);
        return new FieldRef(this, r.className, r.name, r.descriptor);
      }
      case 10: {
        const r = cpRef(this.rawCp, index);
        return new MethodRef(this, r.className, r.name, r.descriptor);
      }
      case 11: {
        const r = cpRef(this.rawCp, index);
        return new InterfaceMethodRef(this, r.className, r.name, r.descriptor);
      }
      default:
        throw new Error(`运行时常量池暂不支持 tag ${e.tag} (#${index})`);
    }
  }
}
