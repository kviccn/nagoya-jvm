# day1 命令行与类路径

> 对应原书第 1、2 章。本章结束时：能从类路径里找到主类并读出它的字节码。

## 本章目标

```bash
npm run day1
# 找到类 day4/GaussTest
# 字节码长度: 507 bytes
# magic: 0xCAFEBABE
```

## 背景知识

### JVM 怎么找到你的类？

执行 `java -cp build/classes day4.GaussTest` 时，JVM 做三件事：解析命令行、
在类路径上搜索 `day4/GaussTest.class`、把字节码读进内存交给后续的解析器。
本章实现前两件半（读出来但不解析，解析是 day2 的事）。

真实 JVM 有三级类路径（JVMS §5.3 的语境）：

| 类路径 | 内容 | 本实现 |
|--------|------|--------|
| 启动类路径（bootstrap） | JDK 核心类（java.lang.*） | `build/jdk`（桩类） |
| 扩展类路径 | `jre/lib/ext`（JDK 9 起已废弃） | 省略 |
| 用户类路径 | `-cp` 指定 | `build/classes` |

### 类"内名"（binary name）

源码里写 `java.lang.Object`，但 class 文件里和 JVM 内部统一用**斜杠内名**
`java/lang/Object`（§4.2.1）。搜索文件时再拼上 `.class` 后缀：

```js
const className = cmd.className.replaceAll('.', '/');  // day4.GaussTest → day4/GaussTest
```

## 源码讲解

### 命令行解析：`src/day1/cmd.js`

`parseCmd` 把 argv 拆成 `-cp` 选项、主类名、程序参数三段。
"第一个非选项参数是主类，其余全部透传给 `main(String[])`"是 `java` 命令的约定：

```js
const cmd = { cpOption: '.', className: null, args: [], help: false };
// ...
} else if (cmd.className === null) {
  cmd.className = arg;    // 第一个非选项参数是主类
} else {
  cmd.args.push(arg);     // 其余是传给 main(String[]) 的参数
}
```

day10 会用 `cmd.args` 构造堆中 `String[]`；`-v` 开关在 day4 接入指令跟踪。

### Entry 三态：`src/day1/classpath/entry.js`

类路径上的一个项（Entry）可能是：目录、`;` 分隔的组合、`*` 通配符。
用**组合模式**表达：`newEntry` 按字符串形态返回不同实现，三者都有
`readClass(className)` 接口：

```js
export function newEntry(path) {
  if (path.includes(PATH_SEPARATOR)) return new CompositeEntry(path); // "a;b;c"
  if (path.endsWith('*')) return new WildcardEntry(path);             // "lib/*"
  return new DirEntry(path);                                          // "build/classes"
}
```

- **`DirEntry`**：`join(absDir, className + '.class')` 存在则 `readFileSync` 读出字节
- **`CompositeEntry`**：持有一组子 Entry，**按顺序**逐个询问，先到先得
  （这就是为什么 `-cp a;b` 里 a 的类会"覆盖"b 里的同名类）
- **`WildcardEntry`**：把 `foo/*` 展开成 foo 下所有子目录的 CompositeEntry。
  真实 JVM 在这里展开 `.jar` 文件；我们把桩 JDK 编译成目录形式，直接省略 zip 支持

### Classpath 组合：`src/day1/classpath/classpath.js`

```js
export class Classpath {
  constructor(userCpOption, bootCpOption = 'build/jdk') {
    this.bootClasspath = newEntry(bootCpOption);
    this.userClasspath = newEntry(userCpOption || '.');
  }
  readClass(className) {
    let { data } = this.bootClasspath.readClass(className);  // 先搜桩 JDK
    if (data) return data;
    ({ data } = this.userClasspath.readClass(className));    // 再搜用户类
    if (data) return data;
    throw new Error(`ClassNotFoundException: ${className}`);
  }
}
```

先 boot 后 user 的顺序对应真实 JVM 的**双亲委派**的简化版：
`java.lang.String` 永远从桩 JDK 加载，用户类路径里就算塞一个同名类也不会生效。

### 验收入口：`src/day1/main.js`

读出字节码后只做一件事——验证魔数。每个 class 文件前 4 字节固定是
`0xCAFEBABE`（§4.1），读到它说明从文件定位到字节读取整条链路是通的：

```js
const data = cp.readClass(className);
console.log(`magic: 0x${data.readUInt32BE(0).toString(16).toUpperCase()}`);
// magic: 0xCAFEBABE
```

::: warning 双端说明
本模块用 `node:fs` 读盘，是**唯一的 Node 专属内核模块**。day5 的 `ClassLoader`
对 classpath 是鸭子类型——只调用 `readClass(name)`，不关心实现。
Web 版因此可以传一个 10 行的查表对象：

```js
const bundleClasspath = {
  readClass(name) {
    const b64 = CLASS_BUNDLE[name];            // 预打包的 base64 类文件
    if (!b64) throw new Error(`ClassNotFoundException: ${name}`);
    return b64ToBytes(b64);
  },
};
```

day1 之后所有代码对"字节从哪来"完全无感知。这是全项目双端兼容的支点。
:::

## 常见坑

1. **路径分隔符**：Windows 用 `;`，Linux/macOS 用 `:`。本项目锁定 `;`
   （常量 `PATH_SEPARATOR`），CI 在 Linux 上跑也要用 `;`——因为这只是我们
   自己 cmd.js 的解析约定，与操作系统无关。
2. **类名写法**：命令行传 `day4.GaussTest`（点号），内部立刻转成 `day4/GaussTest`。
   后面所有模块（常量池、类加载器、native 注册表）**一律只用内名**，混用会出
   找不到类的诡异错误。

## 动手实验

1. `node src/day1/main.js -cp "build/classes;build/jdk" day8.HelloWorld`——
   验证 CompositeEntry 按顺序查找（类其实在第二个目录）。
2. 把类名故意写成 `day4/GaussTest`（已经是内名），观察会发生什么，
   想想为什么（`replaceAll('.', '/')` 对斜杠无影响，所以也能工作——
   这算不算 bug？`java` 命令允许传 `day4/GaussTest` 吗？试试真实的 `java` 命令）。
3. 在 `java/` 下写一个 `java.lang.Object` 并编译进 `build/classes`，
   用 day5 之后的完整 VM 加载它，验证"先 boot 后 user"让它永远不生效。
