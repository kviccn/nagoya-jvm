// 书第6章 —— Method：字节码、异常表（day9 用）、参数槽位数
import { ClassMember } from './classMember.js';
import { findCodeAttr } from '../../day2/classfile/classFile.js';
import { parseMethodDescriptor, slotCountOf } from './methodDescriptor.js';

export class Method extends ClassMember {
  constructor(memberInfo, ownerClass) {
    super(memberInfo, ownerClass);
    this.maxStack = 0;
    this.maxLocals = 0;
    this.code = null;
    this.exceptionTable = [];
    this.argSlotCount = 0;

    const codeAttr = findCodeAttr(memberInfo);
    if (codeAttr) {
      this.maxStack = codeAttr.maxStack;
      this.maxLocals = codeAttr.maxLocals;
      this.code = codeAttr.code;
      this.exceptionTable = codeAttr.exceptionTable; // {startPc,endPc,handlerPc,catchType}
    }
    this.calcArgSlotCount();
    if (this.isNative()) {
      // native 方法没有 Code 属性：局部变量表容纳参数，操作数栈给返回值留足空间
      this.maxLocals = this.argSlotCount;
      this.maxStack = Math.max(this.maxStack, 4);
    }
  }

  calcArgSlotCount() {
    const { paramTypes } = parseMethodDescriptor(this.descriptor);
    this.argSlotCount = paramTypes.reduce((n, t) => n + slotCountOf(t), 0);
    if (!this.isStatic()) this.argSlotCount++; // this 引用
  }

  isSynchronized() { return (this.accessFlags & 0x0020) !== 0; }
  isBridge() { return (this.accessFlags & 0x0040) !== 0; }
  isVarargs() { return (this.accessFlags & 0x0080) !== 0; }

  // day9 异常处理：在当前方法的异常表中找 handler，返回 handlerPc 或 -1
  findExceptionHandler(exClass, pc) {
    for (const e of this.exceptionTable) {
      if (pc < e.startPc || pc >= e.endPc) continue;
      if (e.catchType === 0) return e.handlerPc; // finally（catch 所有）
      const catchClassRef = this.class.constantPool.getConstant(e.catchType);
      const catchClass = catchClassRef.resolvedClass();
      if (catchClass === exClass || catchClass.isSuperClassOf(exClass)) {
        return e.handlerPc;
      }
    }
    return -1;
  }
}

// 在类及其父类中查找方法（invoke 系列指令的方法解析/分派）
export function lookupMethodInClass(jClass, name, descriptor) {
  for (let c = jClass; c; c = c.superClass) {
    const m = c.methods.find((m) => m.name === name && m.descriptor === descriptor);
    if (m) return m;
  }
  return lookupMethodInInterfaces(jClass.interfaces, name, descriptor);
}

export function lookupMethodInInterfaces(ifaces, name, descriptor) {
  for (const iface of ifaces) {
    const m = iface.methods.find((m) => m.name === name && m.descriptor === descriptor);
    if (m) return m;
    const found = lookupMethodInInterfaces(iface.interfaces, name, descriptor);
    if (found) return found;
  }
  return null;
}
