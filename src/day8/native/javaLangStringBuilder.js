// 书第9章风格扩展 —— native 实现：java/lang/StringBuilder
// buf 字段（描述符 Ljava/lang/Object;）里直接存 JS 字符串，toString 时转成堆中 String
import { registerNative } from '../../day6/nativeRegistry.js';
import { jString, jsString } from '../../day7/heap/stringPool.js';

const N = 'java/lang/StringBuilder';
const BUF = ['buf', 'Ljava/lang/Object;'];

function getBuf(thisRef) {
  return thisRef.getRefVar(...BUF) ?? '';
}

function appendImpl(frame, piece) {
  const thisRef = frame.localVars.getRef(0);
  thisRef.setRefVar(...BUF, getBuf(thisRef) + piece);
  frame.operandStack.pushRef(thisRef); // append 返回 this，支持链式调用
}

registerNative(`${N}~append~(Ljava/lang/String;)Ljava/lang/StringBuilder;`, (f) => {
  const s = f.localVars.getRef(1);
  appendImpl(f, s === null ? 'null' : jsString(s));
});
registerNative(`${N}~append~(I)Ljava/lang/StringBuilder;`, (f) => {
  appendImpl(f, String(f.localVars.getInt(1)));
});
registerNative(`${N}~append~(J)Ljava/lang/StringBuilder;`, (f) => {
  appendImpl(f, String(f.localVars.getLong(1)));
});
registerNative(`${N}~append~(C)Ljava/lang/StringBuilder;`, (f) => {
  appendImpl(f, String.fromCharCode(f.localVars.getInt(1)));
});
registerNative(`${N}~append~(Z)Ljava/lang/StringBuilder;`, (f) => {
  appendImpl(f, f.localVars.getInt(1) !== 0 ? 'true' : 'false');
});
registerNative(`${N}~append~(Ljava/lang/Object;)Ljava/lang/StringBuilder;`, (f) => {
  const o = f.localVars.getRef(1);
  if (o === null) return appendImpl(f, 'null');
  if (o.class.name === 'java/lang/String') return appendImpl(f, jsString(o));
  appendImpl(f, `[${o.class.name}]`);
});
registerNative(`${N}~toString~()Ljava/lang/String;`, (f) => {
  const thisRef = f.localVars.getRef(0);
  const loader = f.method.class.loader;
  f.operandStack.pushRef(jString(loader, getBuf(thisRef)));
});
