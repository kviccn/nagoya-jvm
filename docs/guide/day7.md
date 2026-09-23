# day7 数组和字符串

> 对应原书第 8 章，JVMS §5.3.3。本章结束时：数组（含多维）和字符串字面量可用。

## 本章目标

```bash
npm run day7   # day7.ArrayTest → RESULT = 190
node src/day7/main.js -cp build/classes day7.StringTest   # RESULT = 6
```

## 背景知识

### 数组类不由 class 文件定义（§5.3.3）

`[I`（int[]）、`[[Ljava/lang/String;`（String[][]）这些类**没有对应的 class 文件**——
JVM 在首次需要时现场创建它们。数组类名就是描述符：

| Java 写法 | 数组类名 | 创建时机 |
|-----------|---------|---------|
| `int[]` | `[I` | newarray (atype=10) |
| `String[]` | `[Ljava/lang/String;` | anewarray + 组件类引用 |
| `int[][]` | `[[I` | multianewarray 递归创建 |

基本类型类（`int`、`long`……）同理——它们只是类型标识，
`int[].class.getComponentType()` 返回的就是 `int` 这个"类"。

### 字符串驻留（intern）

`"hello" == "hello"` 在 Java 里为 true，因为编译期相同的字符串字面量在
常量池里只有一个条目，JVM 加载时把它们**驻留**到同一个堆中 String 对象。
ldc 遇到 String 常量时：查驻留池 → 命中直接返回引用，未命中创建对象入池。

## 源码讲解

### 数组类加载器：`src/day7/heap/array.js`

`ArrayClassLoader` 继承 day5 的 `ClassLoader`，只改 `loadClass` 的分派：

```js
export class ArrayClassLoader extends ClassLoader {
  loadClass(name) {
    const cached = this.classMap.get(name);
    if (cached) return cached;
    if (name[0] === '[') return this.loadArrayClass(name);      // ★ 数组类现场造
    if (PRIMITIVE_TYPES.has(name)) {                            // ★ 基本类型类现场造
      const c = primitiveClass(name);
      this.classMap.set(name, c);
      return c;
    }
    return this.loadNonArrayClass(name);                        // 普通类走老路
  }

  loadArrayClass(name) {
    const c = new JClass();
    c.name = name;
    c.accessFlags = ACC.PUBLIC;
    c.loader = this;
    c.initStarted = true;                       // 数组类没有 <clinit>
    c.superClass = this.loadClass('java/lang/Object');
    c.interfaces = [                            // ★ §4.7/§5.3.3：数组默认实现这两个接口
      this.loadClass('java/lang/Cloneable'),
      this.loadClass('java/io/Serializable'),
    ];
    this.classMap.set(name, c);
    return c;
  }
}
```

三个要点：

1. **数组类的父类是 Object，接口是 Cloneable + Serializable**——
   所以 `int[] instanceof Cloneable` 为 true（day5 的 isAssignableFrom 数组分支
   也写了这条规则，两处呼应）。
2. `initStarted = true`：数组类没有 `<clinit>`，跳过初始化检查。
3. 基本类型类 `initStarted` 同样置 true，且全局缓存（primitiveClassCache）。

### 数组对象

```js
export function newArray(arrayClass, count) {
  const component = descriptorToClassName(arrayClass.name.slice(1));
  let fill;
  if (component === 'long') fill = 0n;           // 类型决定默认值
  else if (['byte','char','double','float','int','short','boolean'].includes(component)) fill = 0;
  else fill = null;                              // 引用数组
  return new JObject(arrayClass, new Array(count).fill(fill));
}
```

`JObject.data` 对普通对象是 Slots，对数组直接是 **JS 数组**——
组件类型决定填充的默认值（§2.4：数值 0、long 0n、引用 null）。

### 字符串池：`src/day7/heap/stringPool.js`

```js
const internedStrings = new Map();   // JS 字符串 → 堆中 String 对象

export function jString(loader, jsStr) {
  if (internedStrings.has(jsStr)) return internedStrings.get(jsStr);  // 驻留命中

  const charArrClass = loader.loadClass('[C');
  const charArr = newArray(charArrClass, jsStr.length);
  for (let i = 0; i < jsStr.length; i++) {
    charArr.data[i] = jsStr.charCodeAt(i);      // char[] 逐字符填充
  }
  const strClass = loader.loadClass('java/lang/String');
  const jStr = strClass.newObject();
  jStr.setRefVar('value', '[C', charArr);       // ★ 直接塞字段，不走构造器
  internedStrings.set(jsStr, jStr);
  return jStr;
}
```

要点：

- 桩 JDK 的 `java.lang.String` 有一个 `char[] value` 字段（JDK 8 风格；
  真实 JDK 9+ 是 `byte[]` + coder，教学简化）。VM 直接按字段名塞值——
  **VM 创建"系统级"对象时绕过构造器是常见手法**，后面注入 System.out 也是。
- `jsString` 是逆变换：`String.fromCharCode(...charArr.data)`。
  day8 的 println native 靠它把堆中字符串还原成 JS 字符串打印。

### ldc 升级与数组指令：`src/day7/instructions/arrays.js`

**覆盖注册**第一次体现价值——day5 的 ldc 遇到字符串会抛"将在 day7 支持"，
day7 用同名类重新注册 0x12/0x13：

```js
class Ldc extends Index8Instruction {
  execute(frame) {
    // ...
    case 'string': return stack.pushRef(jString(frame.method.class.loader, c.value));
  }
}
register(0x12, new Ldc());    // 覆盖 day5 的注册
```

数组指令的分派核心：

- `newarray`：操作数是 1 字节 **atype**（4=boolean[] ... 10=int[]，11=long[]），
  查 ATYPES 表得到数组类名
- `anewarray`：操作数是常量池类引用，先解析组件类，
  再用 `getArrayClassName` 拼出数组类名（`java/lang/String` → `[Ljava/lang/String;`）
- `xaload/xastore`：`makeALoad/makeAStore` 高阶函数按组件类型生成 8 个变体，
  统一做 NPE + 越界检查（day9 会把检查升级为抛真异常对象）
- `multianewarray`：弹出 dimensions 个维度长度，**递归** newArray——
  `new int[2][3]` 先造 length=2 的 `[[I`，每个元素再造 length=3 的 `[I`

## 关键细节

1. **byte/char/short/boolean 数组元素入栈按 int 处理**（§2.11.1）——
   makeALoad 的 else 分支统一 `s.pushInt(v)`。
2. **`arraylength` 对 null 也抛 NPE**——不只是 xaload/xastore。
3. **字符串池是模块级 Map**：同一个进程里所有类共享。web 端 Reset 重建
   类加载器后旧驻留对象仍指向旧 String 类——教学场景无害，代码里留了注释。
4. **`componentClass()`**：`[[I` → `[I` → `int`，靠 `descriptorToClassName`
   逐级剥 `[`（day5 class.js 底部）。

## 动手实验

1. `new int[2][3][4]` 生成几条指令？先猜，再用 `javap -c` 验证
   （答案：一条 multianewarray，操作数 dimensions=3）。
2. 修改 StringTest：`new String("x") == "x"` 是 true 还是 false？
   用我们的 VM 验证，并解释为什么（new 指令创建的是**新对象**，不进池）。
3. 给数组类补一个假象：如果 `loadArrayClass` 忘了设置 superClass，
   `arr instanceof Object` 会怎样？动手把 superClass 行注释掉试试（记得改回来）。
