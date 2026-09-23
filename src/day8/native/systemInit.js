// 书第11章简化版 —— VM 启动时初始化 System.out
// （真实 JVM 由 System.initializeSystemClass 完成，我们直接注入一个 PrintStream 对象）
import { registerNative } from '../../day6/nativeRegistry.js';
import './javaLangSystem.js';
import './javaIoPrintStream.js';
import './javaLangStringBuilder.js';

export function registerAllNatives() {
  // 上面的 import 副作用已完成注册，此函数仅为语义化入口
}

export function initSystemOut(loader) {
  const systemClass = loader.loadClass('java/lang/System');
  const psClass = loader.loadClass('java/io/PrintStream');
  const ps = psClass.newObject(); // 桩类无字段，无需跑 <init>
  const outField = systemClass.getField('out', 'Ljava/io/PrintStream;', true);
  systemClass.staticVars.setRef(outField.slotId, ps);
  systemClass.initStarted = true; // 桩类没有 <clinit>，直接标记
}
