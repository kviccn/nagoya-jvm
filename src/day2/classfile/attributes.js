// 书第3章 / JVMS §4.7 — Attributes
import { cpUtf8 } from './constantPool.js';

// 解析 attributes 表（field_info / method_info / Code / ClassFile 通用）
export function parseAttributes(reader, cp) {
  const count = reader.u2();
  const attrs = [];
  for (let i = 0; i < count; i++) {
    attrs.push(parseAttribute(reader, cp));
  }
  return attrs;
}

function parseAttribute(reader, cp) {
  const nameIndex = reader.u2();
  const length = reader.u4();
  const name = cpUtf8(cp, nameIndex);
  switch (name) {
    case 'Code': return parseCode(reader, cp, name);
    case 'ConstantValue':
      return { name, constantValueIndex: reader.u2() };
    case 'Exceptions': {
      const n = reader.u2();
      const table = [];
      for (let i = 0; i < n; i++) table.push(reader.u2());
      return { name, exceptionIndexTable: table };
    }
    case 'LineNumberTable': {
      const n = reader.u2();
      const table = [];
      for (let i = 0; i < n; i++) table.push({ startPc: reader.u2(), lineNumber: reader.u2() });
      return { name, table };
    }
    case 'LocalVariableTable': {
      const n = reader.u2();
      const table = [];
      for (let i = 0; i < n; i++) {
        table.push({
          startPc: reader.u2(), length: reader.u2(),
          name: cpUtf8(cp, reader.u2()), descriptor: cpUtf8(cp, reader.u2()), index: reader.u2(),
        });
      }
      return { name, table };
    }
    case 'SourceFile':
      return { name, sourceFile: cpUtf8(cp, reader.u2()) };
    default:
      // 未识别的属性（StackMapTable、Signature、BootstrapMethods 等）保留原始字节
      return { name, raw: reader.bytes(length) };
  }
}

// §4.7.3 The Code Attribute —— 解释器（day4+）最重要的属性
function parseCode(reader, cp, name) {
  const maxStack = reader.u2();
  const maxLocals = reader.u2();
  const codeLength = reader.u4();
  const code = reader.bytes(codeLength);
  const exCount = reader.u2();
  const exceptionTable = [];
  for (let i = 0; i < exCount; i++) {
    exceptionTable.push({
      startPc: reader.u2(), endPc: reader.u2(),
      handlerPc: reader.u2(), catchType: reader.u2(),
    });
  }
  const attributes = parseAttributes(reader, cp);
  return { name, maxStack, maxLocals, code, exceptionTable, attributes };
}
