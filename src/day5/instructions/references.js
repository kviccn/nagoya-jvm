// 书第6章 / §6.5 —— 引用类指令：ldc、new、字段访问、类型检查（0x12~0x14, 0xb2~0xb5, 0xbb, 0xc0~0xc1）
import { Index8Instruction, Index16Instruction } from '../../day4/instructions/base.js';
import { register } from '../../day4/instructions/factory.js';
import { initClass } from '../heap/initClass.js';

function cpOf(frame) { return frame.method.class.constantPool; }

// ---- ldc / ldc_w / ldc2_w：从常量池取字面量压栈（字符串在 day7 升级） ----
function ldc(frame, index) {
  const stack = frame.operandStack;
  const c = cpOf(frame).getConstant(index);
  switch (c.type) {
    case 'int': return stack.pushInt(c.value);
    case 'float': return stack.pushFloat(c.value);
    case 'long': return stack.pushLong(c.value);
    case 'double': return stack.pushDouble(c.value);
    case 'string': throw new Error('ldc 字符串将在 day7 支持');
    default: throw new Error(`ldc: 不支持的常量类型 ${c.type}`);
  }
}

export class Ldc extends Index8Instruction {
  execute(frame) { ldc(frame, this.index); }
}
export class LdcW extends Index16Instruction {
  execute(frame) { ldc(frame, this.index); }
}
export class Ldc2W extends Index16Instruction {
  execute(frame) { ldc(frame, this.index); }
}

// ---- new：创建对象（字段清零，<init> 由 invokespecial 完成，见 day6） ----
export class New extends Index16Instruction {
  execute(frame) {
    const class_ = cpOf(frame).getConstant(this.index).resolvedClass();
    if (!class_.initStarted) {
      frame.revertNextPC(); // 先执行 <clinit>，返回后重新执行本条 new
      initClass(frame.thread, class_);
      return;
    }
    if (class_.isInterface() || class_.isAbstract()) {
      throw new Error(`InstantiationError: ${class_.name}`);
    }
    frame.operandStack.pushRef(class_.newObject());
  }
}

// ---- 静态字段访问 ----
export class GetStatic extends Index16Instruction {
  execute(frame) {
    const field = cpOf(frame).getConstant(this.index).resolvedField();
    const class_ = field.class;
    if (!class_.initStarted) {
      frame.revertNextPC();
      initClass(frame.thread, class_);
      return;
    }
    if (!field.isStatic()) throw new Error(`IncompatibleClassChangeError: ${field.name}`);
    const vars = class_.staticVars;
    const s = frame.operandStack;
    const i = field.slotId;
    switch (field.descriptor[0]) {
      case 'J': return s.pushLong(vars.getLong(i));
      case 'D': return s.pushDouble(vars.getDouble(i));
      case 'F': return s.pushFloat(vars.getFloat(i));
      case 'L': case '[': return s.pushRef(vars.getRef(i));
      default: return s.pushInt(vars.getInt(i)); // Z B C S I
    }
  }
}

export class PutStatic extends Index16Instruction {
  execute(frame) {
    const field = cpOf(frame).getConstant(this.index).resolvedField();
    const class_ = field.class;
    if (!class_.initStarted) {
      frame.revertNextPC();
      initClass(frame.thread, class_);
      return;
    }
    if (!field.isStatic()) throw new Error(`IncompatibleClassChangeError: ${field.name}`);
    if (field.isFinal() && frame.method.class !== class_) {
      throw new Error(`IllegalAccessError: final 字段 ${field.name}`);
    }
    const vars = class_.staticVars;
    const s = frame.operandStack;
    const i = field.slotId;
    switch (field.descriptor[0]) {
      case 'J': return vars.setLong(i, s.popLong());
      case 'D': return vars.setDouble(i, s.popDouble());
      case 'F': return vars.setFloat(i, s.popFloat());
      case 'L': case '[': return vars.setRef(i, s.popRef());
      default: return vars.setInt(i, s.popInt());
    }
  }
}

// ---- 实例字段访问 ----
export class GetField extends Index16Instruction {
  execute(frame) {
    const field = cpOf(frame).getConstant(this.index).resolvedField();
    if (field.isStatic()) throw new Error(`IncompatibleClassChangeError: ${field.name}`);
    const ref = frame.operandStack.popRef();
    if (ref === null) throw new Error('NullPointerException'); // day9 升级为真正的异常对象
    const fields = ref.fields();
    const s = frame.operandStack;
    const i = field.slotId;
    switch (field.descriptor[0]) {
      case 'J': return s.pushLong(fields.getLong(i));
      case 'D': return s.pushDouble(fields.getDouble(i));
      case 'F': return s.pushFloat(fields.getFloat(i));
      case 'L': case '[': return s.pushRef(fields.getRef(i));
      default: return s.pushInt(fields.getInt(i));
    }
  }
}

export class PutField extends Index16Instruction {
  execute(frame) {
    const field = cpOf(frame).getConstant(this.index).resolvedField();
    if (field.isStatic()) throw new Error(`IncompatibleClassChangeError: ${field.name}`);
    if (field.isFinal() && frame.method.class !== field.class) {
      throw new Error(`IllegalAccessError: final 字段 ${field.name}`);
    }
    const s = frame.operandStack;
    const i = field.slotId;
    let ref;
    switch (field.descriptor[0]) {
      case 'J': { const v = s.popLong(); ref = s.popRef(); nullCheck(ref); return ref.fields().setLong(i, v); }
      case 'D': { const v = s.popDouble(); ref = s.popRef(); nullCheck(ref); return ref.fields().setDouble(i, v); }
      case 'F': { const v = s.popFloat(); ref = s.popRef(); nullCheck(ref); return ref.fields().setFloat(i, v); }
      case 'L': case '[': { const v = s.popRef(); ref = s.popRef(); nullCheck(ref); return ref.fields().setRef(i, v); }
      default: { const v = s.popInt(); ref = s.popRef(); nullCheck(ref); return ref.fields().setInt(i, v); }
    }
  }
}

function nullCheck(ref) {
  if (ref === null) throw new Error('NullPointerException');
}

// ---- instanceof / checkcast ----
export class InstanceOf extends Index16Instruction {
  execute(frame) {
    const ref = frame.operandStack.popRef();
    if (ref === null) return frame.operandStack.pushInt(0);
    const class_ = cpOf(frame).getConstant(this.index).resolvedClass();
    frame.operandStack.pushInt(ref.isInstanceOf(class_) ? 1 : 0);
  }
}

export class CheckCast extends Index16Instruction {
  execute(frame) {
    const ref = frame.operandStack.popRef();
    frame.operandStack.pushRef(ref); // 不弹栈，仅检查
    if (ref === null) return;
    const class_ = cpOf(frame).getConstant(this.index).resolvedClass();
    if (!ref.isInstanceOf(class_)) {
      throw new Error(`ClassCastException: ${ref.class.name} -> ${class_.name}`);
    }
  }
}

// 注册到指令分派表（import 本模块即生效）
register(0x12, new Ldc());
register(0x13, new LdcW());
register(0x14, new Ldc2W());
register(0xb2, new GetStatic());
register(0xb3, new PutStatic());
register(0xb4, new GetField());
register(0xb5, new PutField());
register(0xbb, new New());
register(0xc0, new CheckCast());
register(0xc1, new InstanceOf());
