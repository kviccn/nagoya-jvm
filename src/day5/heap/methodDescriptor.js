// 书第6章 / §4.3.2/§4.3.3 —— 字段与方法描述符解析
// 例: "(ILjava/lang/String;[J)D" → params: ['I','Ljava/lang/String;','[J'], return: 'D'
export function parseMethodDescriptor(descriptor) {
  const paramTypes = [];
  let i = 1; // 跳过 '('
  while (descriptor[i] !== ')') {
    const start = i;
    i = skipType(descriptor, i);
    paramTypes.push(descriptor.slice(start, i));
  }
  return { paramTypes, returnType: descriptor.slice(i + 1) };
}

function skipType(desc, i) {
  while (desc[i] === '[') i++;
  if (desc[i] === 'L') return desc.indexOf(';', i) + 1;
  return i + 1; // 基本类型单字符
}

// 一个类型在局部变量表/操作数栈中占几个槽位（long/double 占 2）
export function slotCountOf(typeDesc) {
  return typeDesc === 'J' || typeDesc === 'D' ? 2 : 1;
}

// 描述符 → 可用于 loadClass 的类名
export function toClassName(descriptor) {
  if (descriptor[0] === 'L') return descriptor.slice(1, -1); // Ljava/lang/Object; → java/lang/Object
  if (descriptor[0] === '[') return descriptor;              // 数组类名就是描述符形式
  return PRIMITIVE_NAMES[descriptor] ?? descriptor;
}

export const PRIMITIVE_NAMES = {
  B: 'byte', C: 'char', D: 'double', F: 'float',
  I: 'int', J: 'long', S: 'short', Z: 'boolean', V: 'void',
};
