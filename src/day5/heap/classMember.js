// 书第6章 / §5.4.4 —— 类成员基类（Field/Method 共用）与访问控制
import { ACC } from '../../day2/classfile/classFile.js';

export class ClassMember {
  constructor(memberInfo, ownerClass) {
    this.accessFlags = memberInfo.accessFlags;
    this.name = memberInfo.name;
    this.descriptor = memberInfo.descriptor;
    this.class = ownerClass; // 所属的类
  }

  isPublic() { return (this.accessFlags & ACC.PUBLIC) !== 0; }
  isPrivate() { return (this.accessFlags & ACC.PRIVATE) !== 0; }
  isProtected() { return (this.accessFlags & ACC.PROTECTED) !== 0; }
  isStatic() { return (this.accessFlags & ACC.STATIC) !== 0; }
  isFinal() { return (this.accessFlags & ACC.FINAL) !== 0; }
  isSynthetic() { return (this.accessFlags & ACC.SYNTHETIC) !== 0; }
  isNative() { return (this.accessFlags & ACC.NATIVE) !== 0; }
  isAbstract() { return (this.accessFlags & ACC.ABSTRACT) !== 0; }

  // §5.4.4 Access Control：d 是否可以访问 this 成员
  isAccessibleTo(d) {
    if (this.isPublic()) return true;
    const c = this.class;
    if (this.isProtected()) {
      return d === c || d.isSubClassOf(c) || d.getPackageName() === c.getPackageName();
    }
    if (!this.isPrivate()) {
      return d.getPackageName() === c.getPackageName();
    }
    return d === c;
  }
}
