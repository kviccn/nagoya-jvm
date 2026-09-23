// 书第7章 / §6.5 —— 方法调用指令（0xb6~0xb9）
// invokevirtual   虚方法：按对象实际类型动态分派
// invokespecial   非虚方法：<init>、私有方法、super 调用，无需动态分派
// invokestatic    静态方法
// invokeinterface 接口方法
import { Index16Instruction } from '../../day4/instructions/base.js';
import { register } from '../../day4/instructions/factory.js';
import { initClass } from '../../day5/heap/initClass.js';
import { lookupMethodInClass } from '../../day5/heap/method.js';
import { parseMethodDescriptor } from '../../day5/heap/methodDescriptor.js';
import { findNativeMethod } from '../nativeRegistry.js';

function cpOf(frame) { return frame.method.class.constantPool; }

// ---- 方法调用核心：建帧、传参、压栈；native 方法走注册表 ----
export function invokeMethod(invokerFrame, method) {
  const thread = invokerFrame.thread;
  const newFrame = thread.newFrame(method);
  thread.pushFrame(newFrame);

  // 参数传递：调用者操作数栈顶 argSlotCount 个槽 → 被调者局部变量表（§2.6.1）
  for (let i = method.argSlotCount - 1; i >= 0; i--) {
    newFrame.localVars.setSlot(i, invokerFrame.operandStack.popSlot());
  }

  if (method.isNative()) {
    if (method.name === 'registerNatives') { // 真实 JDK 的 native 注册钩子，桩类用不上
      thread.popFrame();
      return;
    }
    const key = `${method.class.name}~${method.name}~${method.descriptor}`;
    const impl = findNativeMethod(key);
    if (!impl) throw new Error(`native 方法未注册: ${key}`);
    impl(newFrame); // native 实现把返回值压到 newFrame 自己的操作数栈
    thread.popFrame();
    // 把返回值搬运回调用者的操作数栈
    const { returnType } = parseMethodDescriptor(method.descriptor);
    if (returnType !== 'V') {
      if (returnType === 'J' || returnType === 'D') {
        const filler = newFrame.operandStack.popSlot();
        const value = newFrame.operandStack.popSlot();
        invokerFrame.operandStack.pushSlot(value);
        invokerFrame.operandStack.pushSlot(filler);
      } else {
        invokerFrame.operandStack.pushSlot(newFrame.operandStack.popSlot());
      }
    }
  }
}

export class InvokeStatic extends Index16Instruction {
  execute(frame) {
    const method = cpOf(frame).getConstant(this.index).resolvedMethod();
    if (!method.isStatic()) {
      throw new Error(`IncompatibleClassChangeError: ${method.name} 不是静态方法`);
    }
    const class_ = method.class;
    if (!class_.initStarted) {
      frame.revertNextPC();
      initClass(frame.thread, class_);
      return;
    }
    invokeMethod(frame, method);
  }
}

export class InvokeSpecial extends Index16Instruction {
  execute(frame) {
    const method = cpOf(frame).getConstant(this.index).resolvedMethod();
    if (method.isStatic()) {
      throw new Error(`IncompatibleClassChangeError: ${method.name} 是静态方法`);
    }
    invokeMethod(frame, method); // 直接调用解析结果，不做动态分派
  }
}

export class InvokeVirtual extends Index16Instruction {
  execute(frame) {
    const methodRef = cpOf(frame).getConstant(this.index);
    const resolvedMethod = methodRef.resolvedMethod();
    if (resolvedMethod.isStatic()) {
      throw new Error(`IncompatibleClassChangeError: ${resolvedMethod.name} 是静态方法`);
    }
    // 不弹栈先偷看 this（参数还在栈顶，this 在参数下面）
    const ref = frame.operandStack.getRefFromTop(resolvedMethod.argSlotCount - 1);
    if (ref === null) throw new Error('NullPointerException'); // day9 升级
    if (resolvedMethod.isFinal() || resolvedMethod.class.isFinal()) {
      return invokeMethod(frame, resolvedMethod); // final 方法无需分派
    }
    // §5.4.3.3 动态分派：从对象的实际类开始查找
    const method = lookupMethodInClass(ref.class, methodRef.name, methodRef.descriptor);
    if (!method) throw new Error(`AbstractMethodError: ${methodRef.name}`);
    invokeMethod(frame, method);
  }
}

export class InvokeInterface {
  fetchOperands(reader) {
    this.index = reader.readUint16();
    this.count = reader.readUint8(); // 参数槽位数（历史遗留，忽略）
    reader.readUint8();              // 必须是 0（历史遗留，忽略）
  }
  execute(frame) {
    const methodRef = cpOf(frame).getConstant(this.index);
    const resolvedMethod = methodRef.resolvedMethod();
    const ref = frame.operandStack.getRefFromTop(resolvedMethod.argSlotCount - 1);
    if (ref === null) throw new Error('NullPointerException');
    const method = lookupMethodInClass(ref.class, methodRef.name, methodRef.descriptor);
    if (!method) throw new Error(`AbstractMethodError: ${methodRef.name}`);
    invokeMethod(frame, method);
  }
}

register(0xb6, new InvokeVirtual());
register(0xb7, new InvokeSpecial());
register(0xb8, new InvokeStatic());
register(0xb9, new InvokeInterface());
