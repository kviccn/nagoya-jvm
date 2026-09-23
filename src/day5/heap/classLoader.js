// 书第6章 / §5.3~5.4 —— 类加载器：加载 → 链接（验证+准备）
// 初始化（<clinit> 的执行）在 day6 指令触发时做（initClass.js）
import { parseClassFile } from '../../day2/classfile/classFile.js';
import { JClass } from './class.js';
import { Slots } from '../../day3/rtda/slot.js';

export class ClassLoader {
  constructor(classpath, verboseClass = false) {
    this.cp = classpath;
    this.classMap = new Map(); // 方法区：已加载的类
    this.verboseClass = verboseClass;
  }

  // name 是内名（java/lang/Object）或数组类名（[I、[[Ljava/lang/String;）
  loadClass(name) {
    const cached = this.classMap.get(name);
    if (cached) return cached;
    if (name[0] === '[') {
      throw new Error(`数组类将在 day7 支持: ${name}`);
    }
    return this.loadNonArrayClass(name);
  }

  loadNonArrayClass(name) {
    const data = this.cp.readClass(name);
    if (this.verboseClass) console.log(`[load] ${name}`);
    const cf = parseClassFile(data);
    const jClass = this.defineClass(cf);
    this.link(jClass);
    return jClass;
  }

  // §5.3.5 创建运行时类
  defineClass(cf) {
    const jClass = JClass.fromClassFile(cf, this);
    this.classMap.set(jClass.name, jClass);
    this.resolveSuperClassAndInterfaces(jClass);
    return jClass;
  }

  resolveSuperClassAndInterfaces(jClass) {
    if (jClass.name !== 'java/lang/Object') {
      jClass.superClass = this.loadClass(jClass.superClassName);
    }
    jClass.interfaces = jClass.interfaceNames.map((n) => this.loadClass(n));
  }

  // §5.4 链接：验证（略，信任 javac）+ 准备（静态变量分配与常量初始化）
  link(jClass) {
    this.verify(jClass);
    this.prepare(jClass);
  }

  verify() {
    // §5.4.1 Verification —— 教学实现省略（字节码来自可信的 javac）
  }

  // §5.4.2 Preparation：计算字段槽位、分配静态变量、初始化 static final 常量
  prepare(jClass) {
    this.calcInstanceFieldSlotIds(jClass);
    this.calcStaticFieldSlotIds(jClass);
    jClass.staticVars = new Slots(jClass.staticSlotCount);
    this.initStaticFinalVars(jClass);
  }

  calcInstanceFieldSlotIds(jClass) {
    let slotId = jClass.superClass ? jClass.superClass.instanceSlotCount : 0;
    for (const f of jClass.fields) {
      if (!f.isStatic()) {
        f.slotId = slotId;
        slotId += f.isLongOrDouble() ? 2 : 1;
      }
    }
    jClass.instanceSlotCount = slotId;
  }

  calcStaticFieldSlotIds(jClass) {
    let slotId = 0;
    for (const f of jClass.fields) {
      if (f.isStatic()) {
        f.slotId = slotId;
        slotId += f.isLongOrDouble() ? 2 : 1;
      }
    }
    jClass.staticSlotCount = slotId;
  }

  initStaticFinalVars(jClass) {
    const cp = jClass.constantPool;
    for (const f of jClass.fields) {
      if (!f.isStatic() || !f.isFinal() || f.constValueIndex === 0) continue;
      const c = cp.getConstant(f.constValueIndex);
      switch (c.type) {
        case 'int': jClass.staticVars.setInt(f.slotId, c.value); break;
        case 'long': jClass.staticVars.setLong(f.slotId, c.value); break;
        case 'float': jClass.staticVars.setFloat(f.slotId, c.value); break;
        case 'double': jClass.staticVars.setDouble(f.slotId, c.value); break;
        case 'string': /* day7：字符串常量对象 */ break;
        default: throw new Error(`static final 常量类型不支持: ${c.type}`);
      }
    }
  }
}
