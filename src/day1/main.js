// day1 验收：能找到并读出主类字节码（书第1、2章）
// 运行: node src/day1/main.js -cp build/classes day4/GaussTest
import { parseCmd, printUsage } from './cmd.js';
import { Classpath } from './classpath/classpath.js';

const cmd = parseCmd(process.argv.slice(2));
if (cmd.help || !cmd.className) {
  printUsage();
  process.exit(0);
}

const cp = new Classpath(cmd.cpOption);
const className = cmd.className.replaceAll('.', '/');
const data = cp.readClass(className);
console.log(`找到类 ${className}`);
console.log(`字节码长度: ${data.length} bytes`);
console.log(`magic: 0x${data.readUInt32BE(0).toString(16).toUpperCase()}`);
