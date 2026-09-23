// 书第6章 / §5.4 —— 方法区中的类
import { ACC, className, superClassName } from '../../day2/classfile/classFile.js';
import { cpClassName } from '../../day2/classfile/constantPool.js';
import { Field } from './field.js';
import { Method } from './method.js';
import { RuntimeConstantPool } from './runtimeConstantPool.js';
import { Slots } from '../../day3/rtda/slot.js';
import { JObject } from './object.js';

export class JClass {
  constructor() {
    this.accessFlags = 0;
    this.name = '';             // this_class 内名，如 "java/lang/Object"
    this.superClassName = null;
    this.interfaceNames = [];
    this.constantPool = null;   // 运行时常量池
    this.fields = [];
    this.methods = [];
    this.loader = null;         // 加载本类的类加载器
    this.superClass = null;
    this.interfaces = [];
    this.instanceSlotCount = 0; // 实例字段槽位数（含继承）
    this.staticSlotCount = 0;
    this.staticVars = null;     // 静态变量（Slots）
    this.initStarted = false;   // <clinit> 是否已开始（§5.5 初始化时机）
    this.jClass = null;         // day8：java.lang.Class 镜像对象
  }

  static fromClassFile(cf, loader) {
    const c = new JClass();
    c.accessFlags = cf.accessFlags;
    c.name = className(cf);
    c.superClassName = superClassName(cf);
    c.interfaceNames = cf.interfaces.map((i) => cpClassName(cf.constantPool, i));
    c.constantPool = new RuntimeConstantPool(c, cf.constantPool);
    c.fields = cf.fields.map((f) => new Field(f, c));
    c.methods = cf.methods.map((m) => new Method(m, c));
    c.loader = loader;
    return c;
  }

  // ---- 标志位 ----
  isPublic() { return (this.accessFlags & ACC.PUBLIC) !== 0; }
  isFinal() { return (this.accessFlags & ACC.FINAL) !== 0; }
  isInterface() { return (this.accessFlags & ACC.INTERFACE) !== 0; }
  isAbstract() { return (this.accessFlags & ACC.ABSTRACT) !== 0; }
  isArray() { return this.name.startsWith('['); }
  isPrimitive() { return !this.name.includes('/') && !this.isArray() && !this.name.includes('.'); }

  getPackageName() {
    const i = this.name.lastIndexOf('/');
    return i >= 0 ? this.name.slice(0, i) : '';
  }

  // 类级别访问控制：other 能否访问本类
  isAccessibleTo(other) {
    return this.isPublic() || this.getPackageName() === other.getPackageName();
  }

  newObject() {
    return new JObject(this, new Slots(this.instanceSlotCount));
  }

  // ---- 成员查找 ----
  getStaticMethod(name, descriptor) {
    return this.getMethod(name, descriptor, true);
  }

  getMethod(name, descriptor, isStatic = null) {
    return this.methods.find((m) =>
      m.name === name && m.descriptor === descriptor &&
      (isStatic === null || m.isStatic() === isStatic)) ?? null;
  }

  getMainMethod() {
    return this.getStaticMethod('main', '([Ljava/lang/String;)V');
  }

  getClinitMethod() {
    return this.methods.find((m) => m.name === '<clinit>' && m.descriptor === '()V') ?? null;
  }

  // §5.4.3.2 字段解析：本类 → 直接/间接超接口 → 超类
  getField(name, descriptor, isStatic = null) {
    const own = this.fields.find((f) =>
      f.name === name && f.descriptor === descriptor &&
      (isStatic === null || f.isStatic() === isStatic));
    if (own) return own;
    for (const iface of this.interfaces) {
      const f = iface.getField(name, descriptor, isStatic);
      if (f) return f;
    }
    return this.superClass ? this.superClass.getField(name, descriptor, isStatic) : null;
  }

  // ---- 继承关系 ----
  isSubClassOf(other) {
    for (let c = this.superClass; c; c = c.superClass) {
      if (c === other) return true;
    }
    return false;
  }

  isSuperClassOf(other) { return other.isSubClassOf(this); }

  isImplements(iface) {
    for (let c = this; c; c = c.superClass) {
      for (const i of c.interfaces) {
        if (i === iface || i.isSubInterfaceOf(iface)) return true;
      }
    }
    return false;
  }

  isSubInterfaceOf(iface) {
    for (const superInterface of this.interfaces) {
      if (superInterface === iface || superInterface.isSubInterfaceOf(iface)) return true;
    }
    return false;
  }

  isSuperInterfaceOf(other) { return other.isSubInterfaceOf(this); }

  // §5.4.6 类型转换检查 / instanceof 语义
  isAssignableFrom(other) {
    const t = this;
    const s = other;
    if (s === t) return true;
    if (!s.isArray()) {
      if (!s.isInterface()) {
        if (!t.isInterface()) return s.isSubClassOf(t);
        return s.isImplements(t);
      }
      // s 是接口
      if (!t.isInterface()) return t.name === 'java/lang/Object';
      return t.isSuperInterfaceOf(s);
    }
    // s 是数组
    if (!t.isArray()) {
      return t.name === 'java/lang/Object'
        || t.name === 'java/lang/Cloneable'
        || t.name === 'java/io/Serializable';
    }
    const sc = s.componentClass();
    const tc = t.componentClass();
    return sc === tc || tc.isAssignableFrom(sc);
  }

  // day7 数组类使用："[[I" → "[I"
  componentClass() {
    const componentClassName = getComponentClassName(this.name);
    return this.loader.loadClass(componentClassName);
  }
}

// "[Ljava/lang/String;" → "java/lang/String"；"[[I" → "[I"；"[I" → "int"
export function getComponentClassName(className) {
  if (!className.startsWith('[')) throw new Error(`Not array class: ${className}`);
  const componentTypeDescriptor = className.slice(1);
  return descriptorToClassName(componentTypeDescriptor);
}

export function descriptorToClassName(descriptor) {
  if (descriptor[0] === 'L') return descriptor.slice(1, -1);
  if (descriptor[0] === '[') return descriptor;
  const primitives = {
    B: 'byte', C: 'char', D: 'double', F: 'float',
    I: 'int', J: 'long', S: 'short', Z: 'boolean',
  };
  return primitives[descriptor] ?? descriptor;
}

// "java/lang/String" → "[Ljava/lang/String;"；数组类名前加 "["
export function getArrayClassName(className) {
  if (className.startsWith('[')) return '[' + className;
  const primitives = {
    boolean: 'Z', byte: 'B', char: 'C', short: 'S',
    int: 'I', long: 'J', float: 'F', double: 'D',
  };
  const d = primitives[className];
  return d ? '[' + d : `[L${className};`;
}
