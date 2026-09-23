// 书第9章 —— native 实现：java/io/PrintStream
// 输出统一走 output.js 的可注入 sink（Node 默认直通 console，web 端注入页面渲染）
import { registerNative } from '../../day6/nativeRegistry.js';
import { jsString } from '../../day7/heap/stringPool.js';
import { sinkPrintln, sinkPrint } from './output.js';

const N = 'java/io/PrintStream';

registerNative(`${N}~println~()V`, () => sinkPrintln(''));
registerNative(`${N}~println~(Z)V`, (f) => sinkPrintln(f.localVars.getInt(1) !== 0));
registerNative(`${N}~println~(C)V`, (f) => sinkPrintln(String.fromCharCode(f.localVars.getInt(1))));
registerNative(`${N}~println~(I)V`, (f) => sinkPrintln(f.localVars.getInt(1)));
registerNative(`${N}~println~(J)V`, (f) => sinkPrintln(String(f.localVars.getLong(1))));
registerNative(`${N}~println~(F)V`, (f) => sinkPrintln(f.localVars.getFloat(1)));
registerNative(`${N}~println~(D)V`, (f) => sinkPrintln(f.localVars.getDouble(1)));

registerNative(`${N}~println~(Ljava/lang/String;)V`, (f) => {
  const jStr = f.localVars.getRef(1);
  sinkPrintln(jStr === null ? 'null' : jsString(jStr));
});

registerNative(`${N}~print~(Ljava/lang/String;)V`, (f) => {
  const jStr = f.localVars.getRef(1);
  sinkPrint(jStr === null ? 'null' : jsString(jStr));
});

registerNative(`${N}~print~(I)V`, (f) => {
  sinkPrint(f.localVars.getInt(1));
});
