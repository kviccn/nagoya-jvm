// 书第6章 —— Field：成员信息 + slotId + 常量值索引
import { ClassMember } from './classMember.js';
import { findConstantValueAttr } from '../../day2/classfile/classFile.js';

export class Field extends ClassMember {
  constructor(memberInfo, ownerClass) {
    super(memberInfo, ownerClass);
    this.slotId = 0; // 字段在 Slots 中的下标（链接阶段分配）
    const cv = findConstantValueAttr(memberInfo);
    this.constValueIndex = cv ? cv.constantValueIndex : 0; // static final 常量
  }

  isVolatile() { return (this.accessFlags & 0x0040) !== 0; }
  isTransient() { return (this.accessFlags & 0x0080) !== 0; }
  isEnum() { return (this.accessFlags & 0x4000) !== 0; }
  isLongOrDouble() { return this.descriptor === 'J' || this.descriptor === 'D'; }
}
