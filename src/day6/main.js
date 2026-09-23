// day6 验收：方法调用 —— 静态递归 fib(10)=55、构造器、虚方法动态分派（书第7章）
// 运行: node src/day6/main.js -cp build/classes day6.FibonacciTest
//      node src/day6/main.js -cp build/classes day6.VirtualDispatchTest
import { parseCmd, printUsage } from '../day1/cmd.js';
import { Classpath } from '../day1/classpath/classpath.js';
import { ClassLoader } from '../day5/heap/classLoader.js';
import { interpret, setVerbose } from '../day4/interpreter.js';
import '../day5/instructions/references.js';
import './instructions/invoke.js'; // 注册调用类指令

const cmd = parseCmd(process.argv.slice(2));
if (cmd.help || !cmd.className) {
  printUsage();
  process.exit(0);
}
setVerbose(!!cmd.verbose);

const cp = new Classpath(cmd.cpOption);
const loader = new ClassLoader(cp, true);
const mainClass = loader.loadClass(cmd.className.replaceAll('.', '/'));
const mainMethod = mainClass.getMainMethod();
if (!mainMethod) {
  console.error('找不到 main 方法');
  process.exit(1);
}

interpret(mainMethod);

const resultField = mainClass.getField('RESULT', 'I', true);
if (resultField) {
  console.log(`RESULT = ${mainClass.staticVars.getInt(resultField.slotId)}`);
}
