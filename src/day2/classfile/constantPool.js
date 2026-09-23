// 书第3章 / JVMS §4.4 — The Constant Pool
// tag 值见 Table 4.4-A；CONSTANT_Long/Double 占两个索引槽位（§4.4.5）
//
// 【双端兼容说明】
// MUTF-8 字符串解码用 TextDecoder（Node 11+ 与浏览器原生都有），
// 不再依赖 Node 特有的 Buffer#toString。

const utf8Decoder = new TextDecoder('utf-8');

export const TAG = {
  1: 'Utf8',
  3: 'Integer',
  4: 'Float',
  5: 'Long',
  6: 'Double',
  7: 'Class',
  8: 'String',
  9: 'Fieldref',
  10: 'Methodref',
  11: 'InterfaceMethodref',
  12: 'NameAndType',
  15: 'MethodHandle',
  16: 'MethodType',
  17: 'Dynamic',
  18: 'InvokeDynamic',
  19: 'Module',
  20: 'Package',
};

export function parseConstantPool(reader) {
  const count = reader.u2(); // constant_pool_count：实际条目数 + 1
  const cp = new Array(count).fill(null); // 索引从 1 开始，cp[0] 不用
  for (let i = 1; i < count; i++) {
    const tag = reader.u1();
    switch (tag) {
      case 1: { // CONSTANT_Utf8 §4.4.7
        // 严格说是 MUTF-8（Modified UTF-8）：\0 编码为 0xC0 0x80、补充字符用 surrogate 对
        // 教学场景（ASCII 标识符）与 UTF-8 等价，直接用 TextDecoder
        const len = reader.u2();
        cp[i] = { tag, value: utf8Decoder.decode(reader.bytes(len)) };
        break;
      }
      case 3: // CONSTANT_Integer：4 字节有符号整数
        cp[i] = { tag, value: reader.i4() };
        break;
      case 4: // CONSTANT_Float：4 字节单精度浮点
        cp[i] = { tag, value: reader.f4() };
        break;
      case 5: // CONSTANT_Long：8 字节，占两个常量池槽位（§4.4.5），用 BigInt 表示
        cp[i] = { tag, value: reader.i8() };
        i++;
        break;
      case 6: // CONSTANT_Double：8 字节，同样占两个槽位
        cp[i] = { tag, value: reader.f8() };
        i++;
        break;
      case 7: // CONSTANT_Class
      case 8: // CONSTANT_String
      case 16: // CONSTANT_MethodType
      case 19: // CONSTANT_Module
      case 20: // CONSTANT_Package
        cp[i] = { tag, nameIndex: reader.u2() };
        break;
      case 9: case 10: case 11: // *ref
      case 12: // NameAndType
      case 17: case 18: // Dynamic / InvokeDynamic
        cp[i] = { tag, classIndex: reader.u2(), nameAndTypeIndex: reader.u2() };
        break;
      case 15: // CONSTANT_MethodHandle
        cp[i] = { tag, referenceKind: reader.u1(), referenceIndex: reader.u2() };
        break;
      default:
        throw new Error(`Unknown constant pool tag: ${tag} at index ${i}`);
    }
  }
  return cp;
}

// ---- 常量池解析辅助 ----
export function cpUtf8(cp, i) {
  return cp[i].value;
}

export function cpClassName(cp, i) {
  return cp[cp[i].nameIndex].value; // 形如 "java/lang/Object" 的内名（§4.2.1）
}

export function cpNameAndType(cp, i) {
  const nt = cp[i];
  return { name: cp[nt.classIndex].value, descriptor: cp[nt.nameAndTypeIndex].value };
}

export function cpRef(cp, i) {
  const ref = cp[i];
  return {
    className: cpClassName(cp, ref.classIndex),
    ...cpNameAndType(cp, ref.nameAndTypeIndex),
  };
}
