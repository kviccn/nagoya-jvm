// day8 里程碑：HelloWorld —— System.out.println + 字符串拼接 + arraycopy（书第9章）
// 运行: node src/day8/main.js -cp build/classes day8.HelloWorld
import { parseCmd, printUsage } from '../day1/cmd.js';
import { Classpath } from '../day1/classpath/classpath.js';
import { ArrayClassLoader } from '../day7/heap/array.js';
import { interpret, setVerbose } from '../day4/interpreter.js';
import '../day5/instructions/references.js';
import '../day6/instructions/invoke.js';
import '../day7/instructions/arrays.js';
import { initSystemOut } from './native/systemInit.js'; // 副作用：注册全部 native

const cmd = parseCmd(process.argv.slice(2));
if (cmd.help || !cmd.className) {
  printUsage();
  process.exit(0);
}
setVerbose(!!cmd.verbose);

const cp = new Classpath(cmd.cpOption);
const loader = new ArrayClassLoader(cp, !!cmd.verbose);
initSystemOut(loader); // 注入 System.out

const mainClass = loader.loadClass(cmd.className.replaceAll('.', '/'));
const mainMethod = mainClass.getMainMethod();
if (!mainMethod) {
  console.error('找不到 main 方法');
  process.exit(1);
}

interpret(mainMethod);
