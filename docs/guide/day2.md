# day2 解析 class 文件

> 对应原书第 3 章，JVMS §4。本章结束时：能完整解析任意 javac 17 编译的 class 文件。

## 本章目标

```bash
npm run day2
# version: 61.0 (Java 17)
# this class: day4/GaussTest, super class: java/lang/Object
# interfaces: 0
# fields: 0, methods: 3
#   method: ACC_PUBLIC <init>()V ...
#   method: ACC_PUBLIC ACC_STATIC main([Ljava/lang/String;)V max_stack=2 max_locals=3 len=23
#   ...
```

**调试方法**：任何一项输出都应该和 `javap -v build/classes/day4/GaussTest.class`
完全一致。javap 就是本章的标准答案。

## 背景知识

### class 文件总体布局（§4.1）

```
ClassFile {
  u4             magic;                 // 0xCAFEBABE
  u2             minor_version;         // 次版本（17 恒为 0）
  u2             major_version;         // 主版本（17 = 61）
  u2             constant_pool_count;   // 常量池条目数 + 1
  cp_info        constant_pool[constant_pool_count-1];
  u2             access_flags;          // public/final/interface...
  u2             this_class;            // 常量池索引
  u2             super_class;           // 常量池索引（Object 为 0）
  u2             interfaces_count;
  u2             interfaces[interfaces_count];
  u2             fields_count;
  field_info     fields[fields_count];
  u2             methods_count;
  method_info    methods[methods_count];
  u2             attributes_count;
  attribute_info attributes[attributes_count];
}
```

三个对解析器最重要的性质：

1. **全部大端序**（big-endian）：多字节整数高位在前。
2. **定长表头 + 变长表**：除常量池外都是"count 前缀 + 数组"的机械结构。
3. **一切名字都在常量池**：类名、字段名、方法名、描述符、属性名……
   class 文件主体里几乎看不到字符串，全是常量池索引。所以常量池必须先解析。

## 源码讲解

### 字节读取器：`src/day2/classfile/reader.js`

所有读取都收敛到 `ClassReader`，内部维护读指针 `pos`：

```js
export class ClassReader {
  constructor(bytes) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.raw = bytes;
    this.pos = 0;
  }
  u2() {
    const v = this.view.getUint16(this.pos);  // DataView 默认大端
    this.pos += 2;
    return v;
  }
  i8() {                       // CONSTANT_Long 用，返回 BigInt
    const v = this.view.getBigInt64(this.pos);
    this.pos += 8;
    return v;
  }
  // ...
}
```

两个值得注意的设计：

- **为什么用 DataView 而不是 Node Buffer？** DataView 是 ECMAScript 标准 API，
  Node 和浏览器原生都有；而 `Buffer.readUInt32BE` 是 Node 特有。
  这一个选择让整个 class 解析器零改动跑进了浏览器（见【双端说明】框）。
- **为什么构造 DataView 要传 `byteOffset/byteLength`？**
  Node 的 `readFileSync` 返回的 Buffer 底层可能共享一个 8KB 的 ArrayBuffer 池，
  `bytes.buffer` 的起点不一定是数据起点。显式传 offset/length 是必选项，
  漏掉会读出错位数据（表现为魔数校验莫名失败）。
- `i4()/f4()/i8()/f8()` 这四个是带符号/浮点版本，专门服务常量池——
  `CONSTANT_Integer` 是有符号的，用 `u4()` 读负数会得到 40 多亿的大正数。

### 常量池：`src/day2/classfile/constantPool.js`

常量池是 19 种 tag 的变长记录表（§4.4 Table 4.4-A）。解析是一个 tag 分派循环：

```js
export function parseConstantPool(reader) {
  const count = reader.u2();                // 注意：实际条目数 + 1
  const cp = new Array(count).fill(null);   // 索引从 1 开始，cp[0] 闲置
  for (let i = 1; i < count; i++) {
    const tag = reader.u1();
    switch (tag) {
      case 1: { // CONSTANT_Utf8
        const len = reader.u2();
        cp[i] = { tag, value: utf8Decoder.decode(reader.bytes(len)) };
        break;
      }
      case 5: // CONSTANT_Long：8 字节，用 BigInt 表示
        cp[i] = { tag, value: reader.i8() };
        i++;   // ★ §4.4.5：long/double 占两个常量池槽位
        break;
      case 9: case 10: case 11: case 12: case 17: case 18:
        // *ref / NameAndType / Dynamic / InvokeDynamic：两个 u2 索引
        cp[i] = { tag, classIndex: reader.u2(), nameAndTypeIndex: reader.u2() };
        break;
      // ...
    }
  }
  return cp;
}
```

三个容易踩的坑：

1. **`constant_pool_count` 比实际条目数多 1**，且索引从 1 开始——
   字节码里的 `ldc #3` 指 `cp[3]`，不是 `cp[2]`。
2. **`CONSTANT_Long`/`Double` 占两个槽位**（§4.4.5）：读到 tag 5/6 后 `i++` 跳过一个槽。
   漏掉这行，后续所有索引错位，表现为类名/方法名张冠李戴——非常难查。
3. **MUTF-8 与 UTF-8 的差异**：class 文件用的是 Modified UTF-8（`\0` 编码为
   `0xC0 0x80`，补充字符编码为 surrogate 对）。教学场景（ASCII 标识符为主）
   与 UTF-8 等价，直接用标准的 `TextDecoder('utf-8')` 解码；
   真要 100% 精确需要专门处理，真实 JVM 就是这么做的。

解析完还要提供**符号引用解析辅助**，因为 `CONSTANT_Fieldref` 里存的不是
字段名，而是"类索引 + NameAndType 索引"的间接结构：

```js
export function cpRef(cp, i) {
  const ref = cp[i];
  return {
    className: cpClassName(cp, ref.classIndex),
    ...cpNameAndType(cp, ref.nameAndTypeIndex),   // { name, descriptor }
  };
}
// cp[Fieldref] → cp[Class] → cp[Utf8] = "java/lang/Object"
//              → cp[NameAndType] → cp[Utf8] + cp[Utf8] = "x" + "I"
```

day5 的 FieldRef/MethodRef 符号引用就是在这组函数之上构建的。

### 属性：`src/day2/classfile/attributes.js`

属性是 class 文件里真正的"内容载体"。结构统一为
`u2 name_index + u4 length + u1 info[length]`——**这让我们可以先按名字分派，
不认识的属性也能安全跳过 length 字节**：

```js
switch (name) {
  case 'Code': return parseCode(reader, cp, name);
  case 'ConstantValue': return { name, constantValueIndex: reader.u2() };
  // ...
  default:
    // 未识别的属性（StackMapTable、Signature、BootstrapMethods 等）保留原始字节
    return { name, raw: reader.bytes(length) };
}
```

最重要的 `Code` 属性（§4.7.3）装着方法的全部可执行信息：

```js
function parseCode(reader, cp, name) {
  const maxStack = reader.u2();       // 操作数栈深度上限（javac 编译时算好）
  const maxLocals = reader.u2();      // 局部变量表槽位数（含 this 和参数）
  const codeLength = reader.u4();
  const code = reader.bytes(codeLength);          // ★ 字节码本体
  const exCount = reader.u2();
  const exceptionTable = [];                       // ★ day9 的 try/catch 全靠它
  for (let i = 0; i < exCount; i++) {
    exceptionTable.push({
      startPc: reader.u2(), endPc: reader.u2(),
      handlerPc: reader.u2(), catchType: reader.u2(),
    });
  }
  const attributes = parseAttributes(reader, cp);  // Code 里还能嵌套属性！
  return { name, maxStack, maxLocals, code, exceptionTable, attributes };
}
```

注意两个反直觉点：`maxStack/maxLocals` 是 javac **编译时静态计算**的上限，
JVM 直接信任它分配帧（字节码验证保证不越界）；属性是**可嵌套**的——
Code 属性内部还有 LineNumberTable 等子属性。

### 总装：`src/day2/classfile/classFile.js`

`parseClassFile` 按 §4.1 的布局顺序机械读取。field_info 和 method_info
结构相同（§4.5/§4.6），共用一个 `parseMember`：

```js
const magic = reader.u4();
if (magic !== MAGIC) throw new Error(`Bad magic: 0x${magic.toString(16)}`);
const minorVersion = reader.u2();
const majorVersion = reader.u2();       // 61 = Java 17
const constantPool = parseConstantPool(reader);
const accessFlags = reader.u2();
const thisClass = reader.u2();          // 只是索引！名字要回常量池查
// ... interfaces / fields / methods / attributes
```

`this_class`/`super_class` 都是常量池索引，便捷函数 `className(cf)` 负责
"索引 → CONSTANT_Class → CONSTANT_Utf8"的两级跳转。

### 反汇编器：`src/day2/classfile/disassembler.js`

把 `Code.code` 字节序列还原成 `javap -c` 风格的指令文本：

```
   0: iload_0
   1: iconst_2
   2: if_icmpge     14
   5: iload_0
   6: bipush        48
   ...
```

它不仅用于教学对照，还是[在线解释器](/playground)左侧"字节码视图"的数据源。
核心难点在**变长操作数**：每种指令的操作数格式不同（0/1/2/4 字节、常量池索引、
跳转偏移、tableswitch 的对齐填充……），反汇编器内置了一张操作数格式表，
遇到 `#n` 常量池索引还会回查常量池追加注释（如 `// Field ANSWER:I`）。

::: tip 双端说明
本章是双端改造的受益者：`DataView` + `TextDecoder` 都是 ES 标准 API，
Node 26 和浏览器完全一致。reader.js 文件头的注释记录了这个决策。
:::

## 常见坑

1. **版本号对照**：major 61 = Java 17。`MAJOR_TO_JAVA` 表在 classFile.js 里。
2. **`cp[0]` 闲置**：所有 "索引 0" 在规范里有特殊含义（如 super_class=0 表示 Object）。
3. **属性 length 字段**：解析自定义属性时 length 是 `info` 的字节数，
   不认识的属性必须按它跳过，否则后续全部错位。

## 动手实验

1. `javap -v build/classes/day6/FibonacciTest.class`，找到 `fib` 方法的 Code 属性，
   手工数出 `code_length`，再用我们的解析器输出比对。
2. 手工反汇编 `fib` 的前 4 条字节码：`1a 05 a2 00 0e`——查 §6.5 指令表，
   `1a`=iload_0、`05`=iconst_2、`a2`=if_icmpge（后跟 2 字节偏移）。
   再和 `node src/day2/classfile/disassembler.js` 驱动的反汇编输出对照。
3. 写一个带 `static final long L = 123456789012345L;` 的类，用 javap 观察
   CONSTANT_Long 在常量池里占两个索引（下一个条目索引 +2）。
