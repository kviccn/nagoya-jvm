// day5 验收：类加载 + 对象 + 静态/实例字段 + <clinit>（书第6章）
// 运行: node src/day5/main.js -cp build/classes day5.StaticFieldTest
import { parseCmd, printUsage } from '../day1/cmd.js';
import { Classpath } from '../day1/classpath/classpath.js';
import { ClassLoader } from './heap/classLoader.js';
import { interpret, setVerbose } from '../day4/interpreter.js';
import './instructions/references.js'; // 注册引用类指令

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

// day5 还没有 System.out：测试类把结果写入 static int RESULT，这里读出
const resultField = mainClass.getField('RESULT', 'I', true);
if (resultField) {
  console.log(`RESULT = ${mainClass.staticVars.getInt(resultField.slotId)}`);
}
