// 书第9章 —— native 实现：java/lang/System
// native 实现约定：参数在 frame.localVars（0 起，实例方法 0 是 this），
// 返回值压到 frame.operandStack（由 invokeMethod 搬运回调用者）
import { registerNative } from '../../day6/nativeRegistry.js';

registerNative(
  'java/lang/System~arraycopy~(Ljava/lang/Object;ILjava/lang/Object;II)V',
  (frame) => {
    const lv = frame.localVars;
    const src = lv.getRef(0);
    const srcPos = lv.getInt(1);
    const dest = lv.getRef(2);
    const destPos = lv.getInt(3);
    const length = lv.getInt(4);
    if (src === null || dest === null) throw new Error('NullPointerException');
    if (srcPos < 0 || destPos < 0 || length < 0
      || srcPos + length > src.data.length || destPos + length > dest.data.length) {
      throw new Error('IndexOutOfBoundsException');
    }
    // 先切片再写回，兼容 src/dest 重叠
    const tmp = src.data.slice(srcPos, srcPos + length);
    for (let i = 0; i < length; i++) dest.data[destPos + i] = tmp[i];
  },
);

registerNative(
  'java/lang/System~currentTimeMillis~()J',
  (frame) => {
    frame.operandStack.pushLong(BigInt(Date.now()));
  },
);
