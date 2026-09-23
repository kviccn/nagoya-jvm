// 书第3章 / JVMS §4.1 — ClassFile 结构总装
import { ClassReader } from './reader.js';
import { parseConstantPool, cpClassName } from './constantPool.js';
import { parseAttributes } from './attributes.js';

const MAGIC = 0xCAFEBABE;

// major version → JDK 版本（§4.1 注）
export const MAJOR_TO_JAVA = {
  45: '1.1', 46: '1.2', 47: '1.3', 48: '1.4', 49: '5', 50: '6', 51: '7',
  52: '8', 53: '9', 54: '10', 55: '11', 56: '12', 57: '13', 58: '14',
  59: '15', 60: '16', 61: '17', 62: '18', 63: '19', 64: '20', 65: '21',
};

// §4.1/4.5/4.6 access flag 位
export const ACC = {
  PUBLIC: 0x0001, PRIVATE: 0x0002, PROTECTED: 0x0004, STATIC: 0x0008,
  FINAL: 0x0010, SUPER: 0x0020, SYNCHRONIZED: 0x0020, VOLATILE: 0x0040,
  BRIDGE: 0x0040, TRANSIENT: 0x0080, VARARGS: 0x0080, NATIVE: 0x0100,
  INTERFACE: 0x0200, ABSTRACT: 0x0400, STRICT: 0x0800, SYNTHETIC: 0x1000,
  ANNOTATION: 0x2000, ENUM: 0x4000, MODULE: 0x8000,
};

export function formatFlags(flags) {
  return Object.entries(ACC)
    .filter(([, bit]) => flags & bit)
    .map(([name]) => 'ACC_' + name)
    .join(' ');
}

function parseMember(reader, cp) {
  // field_info / method_info 同构（§4.5 / §4.6）
  const accessFlags = reader.u2();
  const nameIndex = reader.u2();
  const descriptorIndex = reader.u2();
  const attributes = parseAttributes(reader, cp);
  return {
    accessFlags,
    name: cp[nameIndex].value,
    descriptor: cp[descriptorIndex].value,
    attributes,
  };
}

export function parseClassFile(buf) {
  const reader = new ClassReader(buf);

  const magic = reader.u4();
  if (magic !== MAGIC) {
    throw new Error(`Bad magic: 0x${magic.toString(16)}（不是 class 文件）`);
  }
  const minorVersion = reader.u2();
  const majorVersion = reader.u2();
  const constantPool = parseConstantPool(reader);
  const accessFlags = reader.u2();
  const thisClass = reader.u2();
  const superClass = reader.u2();

  const interfaces = [];
  const interfaceCount = reader.u2();
  for (let i = 0; i < interfaceCount; i++) interfaces.push(reader.u2());

  const fields = [];
  const fieldCount = reader.u2();
  for (let i = 0; i < fieldCount; i++) fields.push(parseMember(reader, constantPool));

  const methods = [];
  const methodCount = reader.u2();
  for (let i = 0; i < methodCount; i++) methods.push(parseMember(reader, constantPool));

  const attributes = parseAttributes(reader, constantPool);

  return {
    minorVersion, majorVersion, constantPool,
    accessFlags, thisClass, superClass, interfaces,
    fields, methods, attributes,
  };
}

// ---- 便捷查询 ----
export function className(cf) {
  return cpClassName(cf.constantPool, cf.thisClass);
}

export function superClassName(cf) {
  return cf.superClass === 0 ? null : cpClassName(cf.constantPool, cf.superClass);
}

export function findCodeAttr(member) {
  return member.attributes.find((a) => a.name === 'Code') ?? null;
}

export function findConstantValueAttr(member) {
  return member.attributes.find((a) => a.name === 'ConstantValue') ?? null;
}
