// 书第5章 / §6.5 —— 指令分派表：opcode → 指令实例
// day5/day6/day7/day9 会通过 register() 补充引用、调用、数组、异常类指令
import * as constants from './constants.js';
import * as loads from './loads.js';
import * as stores from './stores.js';
import * as stack from './stack.js';
import * as math from './math.js';
import * as conversions from './conversions.js';
import * as comparisons from './comparisons.js';
import * as control from './control.js';
import * as extended from './extended.js';

// 大多数指令无状态，直接复用单例
const singleton = (Cls) => new Cls();

const instructionTable = new Map([
  [0x00, singleton(constants.Nop)],
  [0x01, singleton(constants.aconst_null)],
  [0x02, singleton(constants.iconst_m1)],
  [0x03, singleton(constants.iconst_0)],
  [0x04, singleton(constants.iconst_1)],
  [0x05, singleton(constants.iconst_2)],
  [0x06, singleton(constants.iconst_3)],
  [0x07, singleton(constants.iconst_4)],
  [0x08, singleton(constants.iconst_5)],
  [0x09, singleton(constants.lconst_0)],
  [0x0a, singleton(constants.lconst_1)],
  [0x0b, singleton(constants.fconst_0)],
  [0x0c, singleton(constants.fconst_1)],
  [0x0d, singleton(constants.fconst_2)],
  [0x0e, singleton(constants.dconst_0)],
  [0x0f, singleton(constants.dconst_1)],
  [0x10, singleton(constants.Bipush)],
  [0x11, singleton(constants.Sipush)],
  // 0x12 ldc / 0x13 ldc_w / 0x14 ldc2_w → day5/day7 注册
  [0x15, singleton(loads.iload)],
  [0x16, singleton(loads.lload)],
  [0x17, singleton(loads.fload)],
  [0x18, singleton(loads.dload)],
  [0x19, singleton(loads.aload)],
  [0x1a, singleton(loads.iload_0)],
  [0x1b, singleton(loads.iload_1)],
  [0x1c, singleton(loads.iload_2)],
  [0x1d, singleton(loads.iload_3)],
  [0x1e, singleton(loads.lload_0)],
  [0x1f, singleton(loads.lload_1)],
  [0x20, singleton(loads.lload_2)],
  [0x21, singleton(loads.lload_3)],
  [0x22, singleton(loads.fload_0)],
  [0x23, singleton(loads.fload_1)],
  [0x24, singleton(loads.fload_2)],
  [0x25, singleton(loads.fload_3)],
  [0x26, singleton(loads.dload_0)],
  [0x27, singleton(loads.dload_1)],
  [0x28, singleton(loads.dload_2)],
  [0x29, singleton(loads.dload_3)],
  [0x2a, singleton(loads.aload_0)],
  [0x2b, singleton(loads.aload_1)],
  [0x2c, singleton(loads.aload_2)],
  [0x2d, singleton(loads.aload_3)],
  // 0x2e~0x35 数组 load → day7 注册
  [0x36, singleton(stores.istore)],
  [0x37, singleton(stores.lstore)],
  [0x38, singleton(stores.fstore)],
  [0x39, singleton(stores.dstore)],
  [0x3a, singleton(stores.astore)],
  [0x3b, singleton(stores.istore_0)],
  [0x3c, singleton(stores.istore_1)],
  [0x3d, singleton(stores.istore_2)],
  [0x3e, singleton(stores.istore_3)],
  [0x3f, singleton(stores.lstore_0)],
  [0x40, singleton(stores.lstore_1)],
  [0x41, singleton(stores.lstore_2)],
  [0x42, singleton(stores.lstore_3)],
  [0x43, singleton(stores.fstore_0)],
  [0x44, singleton(stores.fstore_1)],
  [0x45, singleton(stores.fstore_2)],
  [0x46, singleton(stores.fstore_3)],
  [0x47, singleton(stores.dstore_0)],
  [0x48, singleton(stores.dstore_1)],
  [0x49, singleton(stores.dstore_2)],
  [0x4a, singleton(stores.dstore_3)],
  [0x4b, singleton(stores.astore_0)],
  [0x4c, singleton(stores.astore_1)],
  [0x4d, singleton(stores.astore_2)],
  [0x4e, singleton(stores.astore_3)],
  // 0x4f~0x56 数组 store → day7 注册
  [0x57, singleton(stack.Pop)],
  [0x58, singleton(stack.Pop2)],
  [0x59, singleton(stack.Dup)],
  [0x5a, singleton(stack.DupX1)],
  [0x5b, singleton(stack.DupX2)],
  [0x5c, singleton(stack.Dup2)],
  [0x5d, singleton(stack.Dup2X1)],
  [0x5e, singleton(stack.Dup2X2)],
  [0x5f, singleton(stack.Swap)],
  [0x60, singleton(math.iadd)],
  [0x61, singleton(math.ladd)],
  [0x62, singleton(math.fadd)],
  [0x63, singleton(math.dadd)],
  [0x64, singleton(math.isub)],
  [0x65, singleton(math.lsub)],
  [0x66, singleton(math.fsub)],
  [0x67, singleton(math.dsub)],
  [0x68, singleton(math.imul)],
  [0x69, singleton(math.lmul)],
  [0x6a, singleton(math.fmul)],
  [0x6b, singleton(math.dmul)],
  [0x6c, singleton(math.idiv)],
  [0x6d, singleton(math.ldiv)],
  [0x6e, singleton(math.fdiv)],
  [0x6f, singleton(math.ddiv)],
  [0x70, singleton(math.irem)],
  [0x71, singleton(math.lrem)],
  [0x72, singleton(math.frem)],
  [0x73, singleton(math.drem)],
  [0x74, singleton(math.ineg)],
  [0x75, singleton(math.lneg)],
  [0x76, singleton(math.fneg)],
  [0x77, singleton(math.dneg)],
  [0x78, singleton(math.ishl)],
  [0x79, singleton(math.lshl)],
  [0x7a, singleton(math.ishr)],
  [0x7b, singleton(math.lshr)],
  [0x7c, singleton(math.iushr)],
  [0x7d, singleton(math.lushr)],
  [0x7e, singleton(math.iand)],
  [0x7f, singleton(math.land)],
  [0x80, singleton(math.ior)],
  [0x81, singleton(math.lor)],
  [0x82, singleton(math.ixor)],
  [0x83, singleton(math.lxor)],
  [0x84, new math.Iinc()], // 有状态？无——操作数在自身字段，但 fetchOperands 每轮重写，可复用
  [0x85, singleton(conversions.i2l)],
  [0x86, singleton(conversions.i2f)],
  [0x87, singleton(conversions.i2d)],
  [0x88, singleton(conversions.l2i)],
  [0x89, singleton(conversions.l2f)],
  [0x8a, singleton(conversions.l2d)],
  [0x8b, singleton(conversions.f2i)],
  [0x8c, singleton(conversions.f2l)],
  [0x8d, singleton(conversions.f2d)],
  [0x8e, singleton(conversions.d2i)],
  [0x8f, singleton(conversions.d2l)],
  [0x90, singleton(conversions.d2f)],
  [0x91, singleton(conversions.i2b)],
  [0x92, singleton(conversions.i2c)],
  [0x93, singleton(conversions.i2s)],
  [0x94, singleton(comparisons.Lcmp)],
  [0x95, singleton(comparisons.fcmpl)],
  [0x96, singleton(comparisons.fcmpg)],
  [0x97, singleton(comparisons.dcmpl)],
  [0x98, singleton(comparisons.dcmpg)],
  [0x99, singleton(comparisons.ifeq)],
  [0x9a, singleton(comparisons.ifne)],
  [0x9b, singleton(comparisons.iflt)],
  [0x9c, singleton(comparisons.ifge)],
  [0x9d, singleton(comparisons.ifgt)],
  [0x9e, singleton(comparisons.ifle)],
  [0x9f, singleton(comparisons.if_icmpeq)],
  [0xa0, singleton(comparisons.if_icmpne)],
  [0xa1, singleton(comparisons.if_icmplt)],
  [0xa2, singleton(comparisons.if_icmpge)],
  [0xa3, singleton(comparisons.if_icmpgt)],
  [0xa4, singleton(comparisons.if_icmple)],
  [0xa5, singleton(comparisons.if_acmpeq)],
  [0xa6, singleton(comparisons.if_acmpne)],
  [0xa7, singleton(comparisons.Goto)],
  // 0xa8 jsr / 0xa9 ret：已废弃（JDK 6+ 不生成），不实现
  [0xaa, new comparisons.TableSwitch()],
  [0xab, new comparisons.LookupSwitch()],
  [0xac, singleton(control.ireturn)],
  [0xad, singleton(control.lreturn)],
  [0xae, singleton(control.freturn)],
  [0xaf, singleton(control.dreturn)],
  [0xb0, singleton(control.areturn)],
  [0xb1, singleton(control._return)],
  // 0xb2 getstatic / 0xb3 putstatic / 0xb4 getfield / 0xb5 putfield → day5 注册
  // 0xb6~0xba invoke* / new / newarray / anewarray → day6/day7 注册
  // 0xbc newarray / 0xbd anewarray / 0xbe arraylength / 0xbf athrow / 0xc0 checkcast / 0xc1 instanceof → day5/7/9
  [0xc4, new extended.Wide()],
  // 0xc5 multianewarray → day7
  [0xc6, singleton(extended.IfNull)],
  [0xc7, singleton(extended.IfNonNull)],
  [0xc8, new extended.GotoW()],
]);

export function register(opcode, instruction) {
  instructionTable.set(opcode, instruction);
}

export function getInstruction(opcode) {
  const inst = instructionTable.get(opcode);
  if (!inst) {
    throw new Error(`Unsupported opcode: 0x${opcode.toString(16).padStart(2, '0')}`);
  }
  return inst;
}

// 指令名表（日志与反汇编用）
// 【双端兼容说明】从普通 ESM 模块 import，替代原来的 node:fs readFileSync
import OPCODE_NAMES from './opcodes.js';

export function opcodeName(opcode) {
  return OPCODE_NAMES[opcode] ?? `0x${opcode.toString(16)}`;
}
