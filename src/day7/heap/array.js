// 书第8章 —— 数组类与数组对象
// 数组类不由 class 文件定义，由 VM 按需创建（§5.3.3）；基本类型类同理（§5.3 注）
import { ClassLoader } from '../../day5/heap/classLoader.js';
import { JClass, descriptorToClassName } from '../../day5/heap/class.js';
import { ACC } from '../../day2/classfile/classFile.js';
import { JObject } from '../../day5/heap/object.js';

const PRIMITIVE_TYPES = new Set(['byte', 'char', 'double', 'float', 'int', 'long', 'short', 'boolean']);

const primitiveClassCache = new Map();
function primitiveClass(name) {
  if (!primitiveClassCache.has(name)) {
    const c = new JClass();
    c.name = name;
    c.accessFlags = ACC.PUBLIC | ACC.FINAL | ACC.ABSTRACT;
    c.initStarted = true;
    primitiveClassCache.set(name, c);
  }
  return primitiveClassCache.get(name);
}

export class ArrayClassLoader extends ClassLoader {
  loadClass(name) {
    const cached = this.classMap.get(name);
    if (cached) return cached;
    if (name[0] === '[') return this.loadArrayClass(name);
    if (PRIMITIVE_TYPES.has(name)) {
      const c = primitiveClass(name);
      this.classMap.set(name, c);
      return c;
    }
    return this.loadNonArrayClass(name);
  }

  // §5.3.3：数组类 = 标记类 + 组件类型，父类 Object，实现 Cloneable/Serializable
  loadArrayClass(name) {
    const c = new JClass();
    c.name = name;
    c.accessFlags = ACC.PUBLIC;
    c.loader = this;
    c.initStarted = true; // 数组类没有 <clinit>
    c.superClass = this.loadClass('java/lang/Object');
    c.interfaces = [
      this.loadClass('java/lang/Cloneable'),
      this.loadClass('java/io/Serializable'),
    ];
    this.classMap.set(name, c);
    return c;
  }
}

// 创建数组对象：data 直接是 JS 数组
export function newArray(arrayClass, count) {
  if (!arrayClass.isArray()) throw new Error(`不是数组类: ${arrayClass.name}`);
  const component = descriptorToClassName(arrayClass.name.slice(1));
  let fill;
  if (component === 'long') fill = 0n;
  else if (['byte', 'char', 'double', 'float', 'int', 'short', 'boolean'].includes(component)) fill = 0;
  else fill = null;
  return new JObject(arrayClass, new Array(count).fill(fill));
}

export function arrayLength(arr) {
  return arr.data.length;
}

export function checkArrayBounds(arr, index) {
  if (index < 0 || index >= arr.data.length) {
    throw new Error(`ArrayIndexOutOfBoundsException: index=${index} length=${arr.data.length}`);
  }
}
