// day2 验收：从类路径加载并 dump class 文件结构（书第3章），对照 `javap -v`
// 运行: node src/day2/main.js -cp build/classes day4.GaussTest
import { parseCmd, printUsage } from '../day1/cmd.js';
import { Classpath } from '../day1/classpath/classpath.js';
import {
  parseClassFile, className, superClassName, formatFlags, findCodeAttr, MAJOR_TO_JAVA,
} from './classfile/classFile.js';

const cmd = parseCmd(process.argv.slice(2));
if (cmd.help || !cmd.className) {
  printUsage();
  process.exit(0);
}

const cp = new Classpath(cmd.cpOption);
const data = cp.readClass(cmd.className.replaceAll('.', '/'));
const cf = parseClassFile(data);

console.log(`version: ${cf.majorVersion}.${cf.minorVersion} (Java ${MAJOR_TO_JAVA[cf.majorVersion] ?? '?'})`);
console.log(`flags: ${formatFlags(cf.accessFlags)}`);
console.log(`this class: ${className(cf)}, super class: ${superClassName(cf)}`);
console.log(`interfaces: ${cf.interfaces.length}, fields: ${cf.fields.length}, methods: ${cf.methods.length}`);
for (const f of cf.fields) {
  console.log(`  field: ${formatFlags(f.accessFlags)} ${f.name} ${f.descriptor}`);
}
for (const m of cf.methods) {
  const code = findCodeAttr(m);
  const info = code ? ` max_stack=${code.maxStack} max_locals=${code.maxLocals} len=${code.code.length}` : '';
  console.log(`  method: ${formatFlags(m.accessFlags)} ${m.name}${m.descriptor}${info}`);
}
