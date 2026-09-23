// 书第10章 / §6.5 —— athrow 指令 + VM 内部检查的"真异常"升级
// （day4 的 idiv 等原来抛 JS Error，这里升级为抛堆中异常对象，可被 try/catch 捕获）
import { NoOperandsInstruction } from '../../day4/instructions/base.js';
import { register } from '../../day4/instructions/factory.js';
import { handleThrow, throwNew } from '../heap/exception.js';
import { checkArrayBounds, arrayLength } from '../../day7/heap/array.js';
import { registerNative } from '../../day6/nativeRegistry.js';
import { printStackTrace } from '../heap/exception.js';

// ---- athrow（0xbf） ----
class Athrow extends NoOperandsInstruction {
  execute(frame) {
    const ex = frame.operandStack.popRef();
    if (ex === null) {
      return throwNew(frame, 'java/lang/NullPointerException'); // athrow null → NPE
    }
    handleThrow(frame, ex);
  }
}

// ---- 除零检查升级 ----
function makeIDiv(isRem) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = s.popInt();
      const v1 = s.popInt();
      if (v2 === 0) return throwNew(frame, 'java/lang/ArithmeticException');
      s.pushInt(isRem ? v1 % v2 : (v1 / v2) | 0);
    }
  };
}
function makeLDiv(isRem) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const v2 = s.popLong();
      const v1 = s.popLong();
      if (v2 === 0n) return throwNew(frame, 'java/lang/ArithmeticException');
      s.pushLong(isRem ? v1 % v2 : v1 / v2);
    }
  };
}

// ---- 数组访问 NPE/越界检查升级 ----
function makeALoadChecked(kind) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      const index = s.popInt();
      const arrRef = s.popRef();
      if (arrRef === null) return throwNew(frame, 'java/lang/NullPointerException');
      if (index < 0 || index >= arrayLength(arrRef)) {
        return throwNew(frame, 'java/lang/ArrayIndexOutOfBoundsException');
      }
      const v = arrRef.data[index];
      if (kind === 'long') s.pushLong(v);
      else if (kind === 'double') s.pushDouble(v);
      else if (kind === 'float') s.pushFloat(v);
      else if (kind === 'ref') s.pushRef(v);
      else s.pushInt(v);
    }
  };
}
function makeAStoreChecked(kind) {
  return class extends NoOperandsInstruction {
    execute(frame) {
      const s = frame.operandStack;
      let v, index, arrRef;
      if (kind === 'long') { v = s.popLong(); index = s.popInt(); arrRef = s.popRef(); }
      else if (kind === 'double') { v = s.popDouble(); index = s.popInt(); arrRef = s.popRef(); }
      else if (kind === 'float') { v = s.popFloat(); index = s.popInt(); arrRef = s.popRef(); }
      else if (kind === 'ref') { v = s.popRef(); index = s.popInt(); arrRef = s.popRef(); }
      else { v = s.popInt(); index = s.popInt(); arrRef = s.popRef(); }
      if (arrRef === null) return throwNew(frame, 'java/lang/NullPointerException');
      if (index < 0 || index >= arrayLength(arrRef)) {
        return throwNew(frame, 'java/lang/ArrayIndexOutOfBoundsException');
      }
      arrRef.data[index] = v;
    }
  };
}

class ArrayLengthChecked extends NoOperandsInstruction {
  execute(frame) {
    const arrRef = frame.operandStack.popRef();
    if (arrRef === null) return throwNew(frame, 'java/lang/NullPointerException');
    frame.operandStack.pushInt(arrayLength(arrRef));
  }
}

// 注册（覆盖 day4/day7 的对应指令）
const inst = (Cls) => new Cls();
register(0xbf, new Athrow());
register(0x6c, inst(makeIDiv(false))); // idiv
register(0x70, inst(makeIDiv(true)));  // irem
register(0x6d, inst(makeLDiv(false))); // ldiv
register(0x71, inst(makeLDiv(true)));  // lrem
register(0x2e, inst(makeALoadChecked('int')));
register(0x32, inst(makeALoadChecked('ref')));
register(0x4f, inst(makeAStoreChecked('int')));
register(0x53, inst(makeAStoreChecked('ref')));
register(0xbe, new ArrayLengthChecked());

// printStackTrace native（读取 day9 挂在 extra 上的调用栈）
registerNative('java/lang/Throwable~printStackTrace~()V', (frame) => {
  const thisRef = frame.localVars.getRef(0);
  printStackTrace(thisRef);
});
