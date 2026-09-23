// day10 收官（书第11章）：完整 JVM —— 支持 main(String[] args) 传参、全部指令、native、异常
// 运行: node src/day10/main.js -cp build/classes day10.JvmDemo foo bar
import { parseCmd, printUsage } from '../day1/cmd.js';
import { Classpath } from '../day1/classpath/classpath.js';
import { ArrayClassLoader, newArray } from '../day7/heap/array.js';
import { jString } from '../day7/heap/stringPool.js';
import { Thread } from '../day3/rtda/thread.js';
import { runThread, setVerbose } from '../day4/interpreter.js';
import '../day5/instructions/references.js';
import '../day6/instructions/invoke.js';
import '../day7/instructions/arrays.js';
import { initSystemOut } from '../day8/native/systemInit.js';
import '../day9/instructions/athrow.js';
import { UncaughtJvmException, printStackTrace } from '../day9/heap/exception.js';

const cmd = parseCmd(process.argv.slice(2));
if (cmd.help || !cmd.className) {
  printUsage();
  process.exit(0);
}
setVerbose(!!cmd.verbose);

// 1. 类加载器 + 启动 System.out
const cp = new Classpath(cmd.cpOption);
const loader = new ArrayClassLoader(cp, !!cmd.verbose);
initSystemOut(loader);

// 2. 加载主类
const mainClass = loader.loadClass(cmd.className.replaceAll('.', '/'));
const mainMethod = mainClass.getMainMethod();
if (!mainMethod) {
  console.error('找不到 main 方法');
  process.exit(1);
}

// 3. 命令行参数 → String[]（书第11章）
const argsArr = createArgsArray(loader, cmd.args);

// 4. 建线程、建 main 帧、放入 args，启动解释循环
const thread = new Thread();
const frame = thread.newFrame(mainMethod);
frame.localVars.setRef(0, argsArr);
thread.pushFrame(frame);

try {
  runThread(thread);
} catch (e) {
  if (e instanceof UncaughtJvmException) {
    printStackTrace(e.exObj);
    process.exit(1);
  }
  throw e;
}

function createArgsArray(loader, args) {
  const stringArrClass = loader.loadClass('[Ljava/lang/String;');
  const arr = newArray(stringArrClass, args.length);
  for (let i = 0; i < args.length; i++) {
    arr.data[i] = jString(loader, args[i]);
  }
  return arr;
}
