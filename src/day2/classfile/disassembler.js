// 反汇编器：把 Code 属性的字节码转成 javap -c 风格的文本
//
// 【定位】web 可视化器的"代码视图"和教程文档引用字节码都靠它；
// 与 day4 的指令实现无关（那边管执行，这里只管"按格式读出操作数并排版"）。
//
// 每条指令产出: { pc, length, mnemonic, text }
//   pc       —— 指令在方法代码中的偏移
//   length   —— 指令总长度（含操作数），UI 高亮/单步定位用
//   mnemonic —— 助记符，如 "invokestatic"
//   text     —— 完整文本，如 "invokestatic #30 // Method fib:(I)I"
import OPCODE_NAMES from '../../day4/instructions/opcodes.js';
import { TAG, cpClassName, cpRef, cpNameAndType } from './constantPool.js';

// newarray 的 atype 编码（§6.5 newarray）
const ATYPE_NAMES = {
  4: 'boolean', 5: 'char', 6: 'float', 7: 'double',
  8: 'byte', 9: 'short', 10: 'int', 11: 'long',
};

// ---- 各指令的操作数格式表（默认无操作数） ----
// u8: 1 字节无符号 | i8: 1 字节有符号 | i16: 2 字节有符号
// u8cp/u16cp: 常量池索引（带注释解析） | branch16/branch32: 跳转偏移
const OPERAND_FORMATS = {
  bipush: 'i8',
  sipush: 'i16',
  ldc: 'u8cp',
  ldc_w: 'u16cp',
  ldc2_w: 'u16cp',
  iload: 'u8', lload: 'u8', fload: 'u8', dload: 'u8', aload: 'u8',
  istore: 'u8', lstore: 'u8', fstore: 'u8', dstore: 'u8', astore: 'u8', ret: 'u8',
  iinc: 'iinc', // u8 索引 + i8 增量
  getstatic: 'u16cp', putstatic: 'u16cp', getfield: 'u16cp', putfield: 'u16cp',
  invokevirtual: 'u16cp', invokespecial: 'u16cp', invokestatic: 'u16cp',
  new: 'u16cp', anewarray: 'u16cp', checkcast: 'u16cp', instanceof: 'u16cp',
  invokeinterface: 'invokeinterface', // u16cp + u8 count + u8 zero
  invokedynamic: 'invokedynamic',     // u16cp + u8 + u8（本 VM 不执行，仅反汇编展示）
  newarray: 'atype',
  multianewarray: 'multianewarray',   // u16cp + u8 维度数
  goto: 'branch16', jsr: 'branch16',
  ifeq: 'branch16', ifne: 'branch16', iflt: 'branch16',
  ifge: 'branch16', ifgt: 'branch16', ifle: 'branch16',
  if_icmpeq: 'branch16', if_icmpne: 'branch16', if_icmplt: 'branch16',
  if_icmpge: 'branch16', if_icmpgt: 'branch16', if_icmple: 'branch16',
  if_acmpeq: 'branch16', if_acmpne: 'branch16',
  ifnull: 'branch16', ifnonnull: 'branch16',
  goto_w: 'branch32', jsr_w: 'branch32',
  tableswitch: 'tableswitch',
  lookupswitch: 'lookupswitch',
  wide: 'wide',
};

/**
 * 反汇编一个方法的全部字节码
 * @param {Uint8Array} code Code 属性中的字节码
 * @param {Array|null} rawCp day2 解析出的原始常量池（用于生成 #n 后的注释，可省略）
 * @returns {Array<{pc:number, length:number, mnemonic:string, text:string}>}
 */
export function disassemble(code, rawCp = null) {
  const view = new DataView(code.buffer, code.byteOffset, code.byteLength);
  const result = [];
  let pc = 0;

  const u8 = () => view.getUint8(pc++);
  const i8 = () => { const v = view.getInt8(pc); pc++; return v; };
  const u16 = () => { const v = view.getUint16(pc); pc += 2; return v; };
  const i16 = () => { const v = view.getInt16(pc); pc += 2; return v; };
  const i32 = () => { const v = view.getInt32(pc); pc += 4; return v; };

  while (pc < code.length) {
    const startPc = pc;
    const opcode = u8();
    const mnemonic = OPCODE_NAMES[opcode] ?? `0x${opcode.toString(16)}`;
    const format = OPERAND_FORMATS[mnemonic] ?? 'none';
    let text = mnemonic;

    switch (format) {
      case 'none':
        break;
      case 'u8':
        text += ` ${u8()}`;
        break;
      case 'i8':
        text += ` ${i8()}`;
        break;
      case 'i16':
        text += ` ${i16()}`;
        break;
      case 'u8cp':
        text += ` #${u8()}` + cpComment(rawCp, code[startPc + 1]);
        break;
      case 'u16cp': {
        const idx = u16();
        text += ` #${idx}` + cpComment(rawCp, idx);
        break;
      }
      case 'iinc':
        text += ` ${u8()} by ${i8()}`;
        break;
      case 'branch16':
        text += ` ${startPc + i16()}`; // 转成绝对地址，和 javap 一致
        break;
      case 'branch32':
        text += ` ${startPc + i32()}`;
        break;
      case 'invokeinterface': {
        const idx = u16();
        const count = u8();
        u8(); // 恒为 0
        text += ` #${idx}, count ${count}` + cpComment(rawCp, idx);
        break;
      }
      case 'invokedynamic': {
        const idx = u16();
        u16(); // 恒为 0
        text += ` #${idx}, 0` + cpComment(rawCp, idx);
        break;
      }
      case 'atype':
        text += ` ${ATYPE_NAMES[u8()] ?? '?'}`;
        break;
      case 'multianewarray': {
        const idx = u16();
        const dims = u8();
        text += ` #${idx}, ${dims}` + cpComment(rawCp, idx);
        break;
      }
      case 'tableswitch': {
        // 操作数按 4 字节对齐（相对方法代码起始，和解释器 skipPadding 一致）
        while (pc % 4 !== 0) pc++;
        const def = i32();
        const low = i32();
        const high = i32();
        const targets = [];
        for (let i = 0; i < high - low + 1; i++) targets.push(startPc + i32());
        text += ` ${low}..${high}: [${targets.join(', ')}] default: ${startPc + def}`;
        break;
      }
      case 'lookupswitch': {
        while (pc % 4 !== 0) pc++;
        const def = i32();
        const npairs = i32();
        const pairs = [];
        for (let i = 0; i < npairs; i++) {
          pairs.push(`${i32()}→${startPc + i32()}`);
        }
        text += ` {${pairs.join(', ')}} default: ${startPc + def}`;
        break;
      }
      case 'wide': {
        const sub = u8();
        const subName = OPCODE_NAMES[sub] ?? '?';
        const idx = u16();
        text += sub === 0x84 ? ` iinc ${idx} by ${i16()}` : ` ${subName} ${idx}`;
        break;
      }
      default:
        text += ` <未知格式 ${format}>`;
    }

    result.push({ pc: startPc, length: pc - startPc, mnemonic, text });
  }
  return result;
}

// 生成 javap 风格的常量池注释，如 " // Method java/lang/Object.<init>:()V"
function cpComment(rawCp, index) {
  if (!rawCp || !rawCp[index]) return '';
  const e = rawCp[index];
  try {
    switch (e.tag) {
      case 7: return ` // class ${cpClassName(rawCp, index)}`;
      case 8: return ` // String ${rawCp[e.nameIndex].value}`;
      case 9: {
        const r = cpRef(rawCp, index);
        return ` // Field ${r.className}.${r.name}:${r.descriptor}`;
      }
      case 10: case 11: {
        const r = cpRef(rawCp, index);
        return ` // Method ${r.className}.${r.name}:${r.descriptor}`;
      }
      case 3: return ` // int ${e.value}`;
      case 4: return ` // float ${e.value}`;
      case 5: return ` // long ${e.value}`;
      case 6: return ` // double ${e.value}`;
      case 12: {
        const nt = cpNameAndType(rawCp, index);
        return ` // NameAndType ${nt.name}:${nt.descriptor}`;
      }
      default:
        return ` // ${TAG[e.tag] ?? '?'}`;
    }
  } catch {
    return '';
  }
}
