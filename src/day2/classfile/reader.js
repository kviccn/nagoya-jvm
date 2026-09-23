// JVMS §4.1 —— class 文件读取器
//
// 【双端兼容说明】
// class 文件全是多字节大端序（big-endian）。这里统一用 DataView 读取：
//   - DataView 是 ECMAScript 标准 API，Node.js 和浏览器原生都有
//   - 构造参数只要求 Uint8Array —— Node 侧 readFileSync 返回的 Buffer 是
//     Uint8Array 的子类，浏览器侧 fetch().arrayBuffer() 也能直接包装
// 因此本模块是 VM 内核中"零环境依赖"的基础件。
export class ClassReader {
  /**
   * @param {Uint8Array} bytes class 文件字节（Node 传 Buffer、浏览器传 Uint8Array 均可）
   */
  constructor(bytes) {
    // 注意 DataView 需要显式传入 byteOffset/byteLength：
    // Buffer 底层可能共享一个更大的 ArrayBuffer 池，直接用 bytes.buffer 会读串位
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.raw = bytes; // 原始字节引用（注意不能命名为 bytes，会遮蔽 bytes() 方法）
    this.pos = 0; // 当前读指针（相对 class 文件起始的字节偏移）
  }

  /** 读 1 字节无符号整数（u1） */
  u1() {
    return this.view.getUint8(this.pos++);
  }

  /** 读 2 字节无符号整数（u2，大端） */
  u2() {
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }

  /** 读 4 字节无符号整数（u4，大端） */
  u4() {
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }

  /** 读 4 字节有符号整数（CONSTANT_Integer 用） */
  i4() {
    const v = this.view.getInt32(this.pos);
    this.pos += 4;
    return v;
  }

  /** 读 4 字节 IEEE754 单精度浮点（CONSTANT_Float 用） */
  f4() {
    const v = this.view.getFloat32(this.pos);
    this.pos += 4;
    return v;
  }

  /** 读 8 字节有符号整数（CONSTANT_Long 用，返回 BigInt） */
  i8() {
    const v = this.view.getBigInt64(this.pos);
    this.pos += 8;
    return v;
  }

  /** 读 8 字节 IEEE754 双精度浮点（CONSTANT_Double 用） */
  f8() {
    const v = this.view.getFloat64(this.pos);
    this.pos += 8;
    return v;
  }

  /**
   * 读 n 字节原始数据（CONSTANT_Utf8、未知属性用）
   * 返回原数组的视图（subarray，不复制），调用方不应修改
   */
  bytes(n) {
    const b = this.raw.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }
}
