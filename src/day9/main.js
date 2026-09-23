// day9 验收：异常处理 —— try/catch/finally、除零捕获、未捕获异常调用链（书第10章）
// 运行: node src/day9/main.js -cp build/classes day9.ExceptionTest
//      node src/day9/main.js -cp build/classes day9.UncaughtTest
import { parseCmd, printUsage } from '../day1/cmd.js';
import { Classpath } from '../day1/classpath/classpath.js';
import { ArrayClassLoader } from '../day7/heap/array.js';
import { interpret, setVerbose } from '../day4/interpreter.js';
import '../day5/instructions/references.js';
import '../day6/instructions/invoke.js';
import '../day7/instructions/arrays.js';
import { initSystemOut } from '../day8/native/systemInit.js';
import './instructions/athrow.js'; // 注册 athrow + 检查升级
import { UncaughtJvmException, printStackTrace } from './heap/exception.js';

const cmd = parseCmd(process.argv.slice(2));
if (cmd.help || !cmd.className) {
  printUsage();
  process.exit(0);
}
setVerbose(!!cmd.verbose);

const cp = new Classpath(cmd.cpOption);
const loader = new ArrayClassLoader(cp, !!cmd.verbose);
initSystemOut(loader);

const mainClass = loader.loadClass(cmd.className.replaceAll('.', '/'));
const mainMethod = mainClass.getMainMethod();
if (!mainMethod) {
  console.error('找不到 main 方法');
  process.exit(1);
}

try {
  interpret(mainMethod);
} catch (e) {
  if (e instanceof UncaughtJvmException) {
    printStackTrace(e.exObj);
    process.exit(1);
  }
  throw e;
}

const resultField = mainClass.getField('RESULT', 'I', true);
if (resultField) {
  console.log(`RESULT = ${mainClass.staticVars.getInt(resultField.slotId)}`);
}
