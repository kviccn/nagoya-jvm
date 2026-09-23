// day7 验收：数组（含多维）+ 字符串字面量驻留（书第8章）
// 运行: node src/day7/main.js -cp build/classes day7.ArrayTest
//      node src/day7/main.js -cp build/classes day7.StringTest
import { parseCmd, printUsage } from '../day1/cmd.js';
import { Classpath } from '../day1/classpath/classpath.js';
import { ArrayClassLoader } from './heap/array.js';
import { interpret, setVerbose } from '../day4/interpreter.js';
import '../day5/instructions/references.js';
import '../day6/instructions/invoke.js';
import './instructions/arrays.js'; // 注册数组指令 + ldc 字符串

const cmd = parseCmd(process.argv.slice(2));
if (cmd.help || !cmd.className) {
  printUsage();
  process.exit(0);
}
setVerbose(!!cmd.verbose);

const cp = new Classpath(cmd.cpOption);
const loader = new ArrayClassLoader(cp, true);
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
