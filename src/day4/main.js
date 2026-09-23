// day4 验收：解释执行 GaussTest.main（1+2+...+100=5050，书第5章）
// 运行: node src/day4/main.js -cp build/classes day4.GaussTest
import { parseCmd, printUsage } from '../day1/cmd.js';
import { Classpath } from '../day1/classpath/classpath.js';
import { parseClassFile, findCodeAttr } from '../day2/classfile/classFile.js';
import { interpret, setVerbose } from './interpreter.js';

const cmd = parseCmd(process.argv.slice(2));
if (cmd.help || !cmd.className) {
  printUsage();
  process.exit(0);
}
setVerbose(true); // day4 还没有 System.out，靠指令跟踪观察结果

const cp = new Classpath(cmd.cpOption);
const cf = parseClassFile(cp.readClass(cmd.className.replaceAll('.', '/')));

// day4 还没实现方法区：直接从 class 文件里找 main 方法，包一层伪方法对象
const mainInfo = cf.methods.find((m) => m.name === 'main' && m.descriptor === '([Ljava/lang/String;)V');
if (!mainInfo) {
  console.error('找不到 main 方法');
  process.exit(1);
}
const codeAttr = findCodeAttr(mainInfo);
const pseudoMethod = {
  name: 'main',
  maxLocals: codeAttr.maxLocals,
  maxStack: codeAttr.maxStack,
  code: codeAttr.code,
};

console.log(`开始解释执行 ${cmd.className}.main ...`);
interpret(pseudoMethod);
console.log('执行完毕。请在上面指令跟踪中确认 istore 的最终值 sum=5050。');
