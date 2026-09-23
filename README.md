# nagoya-jvm：《自己动手写 Java 虚拟机》Node.js 版

用 Node.js (ESM) 按书逐章实现的迷你 JVM，可加载并执行本机 `javac 17` 编译的 `.class` 文件。
代码按 `src/day1` ~ `src/day10` 组织，每一天对应书的 1~2 章，**逐天累计**（后续 day 通过
`import` 复用前几天的模块，并用 `register()` 往 day4 的指令分派表里补充新指令，源码中
没有重复代码）。

**同一套 VM 内核同时跑在 Node CLI 和浏览器里**——零 `node:*` import 的内核 +
三个注入点（鸭子类型 Classpath / step 驱动 / 输出 sink）撑起双端：

- 📖 **在线教程**：<https://kviccn.github.io/nagoya-jvm/>（VitePress，每章含源码逐段讲解）
- 🎮 **在线解释器**：<https://kviccn.github.io/nagoya-jvm/playground>
  （字节码高亮 / 帧栈 / 局部变量表 / 操作数栈 / 控制台，运行 / 暂停 / 单步 / 5 档调速，移动端适配）

环境：OpenJDK 17.0.2（class major version 61）、Node.js ≥ 18（开发用 v26），VM 内核零 npm 依赖。

## 快速开始

```bash
npm run build    # 编译 JDK 桩类（build/jdk）+ 全部测试类（build/classes）
npm run day1     # ... 到 npm run day10
```

或直接：`node src/dayN/main.js [-cp 路径] [-v] 主类名 [程序参数...]`

`npm run day10` 期望输出（`main(String[] args)` 传参 + 综合演示）：

```
=== mini JVM (Node.js) ===
args.length = 2
args[0] = foo
args[1] = bar
fib(10) = 55
sum(primes) = 17
grade(85) = B
grade(62) = D
caught ArithmeticException
finally done
=== bye ===
```

## 每一天的内容与验收

| day | 对应书章节 | 实现内容 | 验收命令 | 期望结果 |
|-----|-----------|---------|---------|---------|
| day1 | 第1、2章 | 命令行解析（`-cp`）、类路径搜索（目录/组合/通配符 Entry） | `npm run day1` | 找到类并读出 magic `0xCAFEBABE` |
| day2 | 第3章 | class 文件解析器：常量池全部 19 种 tag、字段/方法/属性（Code、异常表等）、**javap 风格反汇编器** | `npm run day2` | 结构信息与 `javap -v` 一致 |
| day3 | 第4章 | 运行时数据区：Slot、局部变量表、操作数栈、帧、虚拟机栈、线程 | `npm run day3` | 槽位读写、帧栈 push/pop 正确 |
| day4 | 第5章 | 指令集（~140 条）+ 解释器（**step/runThread 分离**、tracer 钩子） | `npm run day4` | 指令跟踪中 `sum=5050` |
| day5 | 第6章 | 方法区：Class/Field/Method、运行时常量池、类加载器（加载→链接）、`<clinit>` 触发；指令：ldc/new/get\*/put\*/instanceof/checkcast | `npm run day5` | `RESULT = 85` |
| day6 | 第7章 | 方法调用：invokestatic/special/virtual/interface、参数传递、动态分派、native 注册表 | `npm run day6` | `fib(10)=55`、虚分派 `RESULT = 204` |
| day7 | 第8章 | 数组类现场创建（§5.3.3）、字符串池（intern）；指令：newarray/anewarray/xaload/xastore/multianewarray/arraylength | `npm run day7` | 数组 `RESULT = 190`、驻留 `RESULT = 6` |
| day8 | 第9章 | native 实现：PrintStream/StringBuilder/System.arraycopy；启动注入 System.out；**可注入输出 sink** | `npm run day8` | `Hello, JVM!` / `fib(10) = 55` / `b[2] = 3` |
| day9 | 第10章 | 异常：athrow、异常表查找、逐帧展开、调用链打印；除零/NPE/越界升级为可捕获异常 | `npm run day9` | `RESULT = 1101`；UncaughtTest 打印调用链并 exit 1 |
| day10 | 第11章 | 收官：完整 JVM，`main(String[] args)` 传参，综合演示 | `npm run day10` | 见上方输出 |

## 在线教程与可视化解释器

```bash
npm run build       # 1. 编译桩 JDK + 测试类（bundle 的原料）
npm run build:web   # 2. 打包 class → docs/.vitepress/vm/classes-bundle.js
npm run docs:dev    # 3. 本地预览教程站（含 /playground 在线解释器）
npm run docs:build  # 构建静态站点 → docs/.vitepress/dist
```

## 目录结构

```
src/
  day1/  cmd.js, classpath/{entry,classpath}.js        # 唯一的 node:fs 内核模块
  day2/  classfile/{reader,constantPool,attributes,classFile,disassembler}.js
  day3/  rtda/{slot,operandStack,frame,stack,thread}.js
  day4/  instructions/{base,constants,loads,stores,stack,math,conversions,
         comparisons,control,extended,factory}.js + opcodes.js, interpreter.js
  day5/  heap/{classMember,field,method,methodDescriptor,object,class,
         runtimeConstantPool,classLoader,initClass}.js, instructions/references.js
  day6/  instructions/invoke.js, nativeRegistry.js
  day7/  heap/{array,stringPool}.js, instructions/arrays.js
  day8/  native/{output,javaLangSystem,javaIoPrintStream,javaLangStringBuilder,systemInit}.js
  day9/  heap/exception.js, instructions/athrow.js
  day10/ main.js（完整入口：main 传参 + 全部指令 + native + 异常）
jdk/     迷你 JDK 桩类（java.lang.Object/String/System/Throwable/StringBuilder、
         java.io.PrintStream...，用 --patch-module java.base=jdk 编译绕过模块限制；
         运行时被 VM 当作真正的 JDK 类加载）
java/    每天的验收测试类（dayN.XxxTest）
scripts/ build.sh（编译）+ pack-web.mjs（浏览器 class bundle 打包）
docs/    VitePress 教程站
  guide/              setup + day1~day10 章节（背景知识 + 源码逐段讲解 + 实验）
  playground.md       在线解释器页面
  .vitepress/
    components/JvmVisualizer.vue   # 可视化器（import @vm → ../../src 复用内核）
    vm/classes-bundle.js           # 生成的 class bundle（gitignore）
.github/workflows/deploy.yml       # Pages 自动部署 + 回归兜底
```

## 关键技术决策

- **双端兼容**：VM 内核（src/day2~day10，入口 main.js 除外）零 `node:*` import，
  只用 DataView/TextDecoder/BigInt 等 ES 标准 API。三个注入点撑起全部端差异：
  ① 类加载鸭子类型（`readClass(name)`：Node 传文件系统 Classpath，浏览器传
  base64 bundle 查表对象）；② 解释器 `step/runThread` 分离（CLI 循环跑 step，
  浏览器用 `setInterval` 按可调速度驱动 step，每 tick 快照一次 UI）；
  ③ 输出走可注入 sink（`output.js`：Node 默认 console，浏览器注入页面终端）。
- **数值表示**：int/float 用 JS number（`|0`/`Math.fround` 截断），long 用 BigInt，
  double 用 number（原生 f64）；`imul` 用 `Math.imul` 保持 32 位溢出语义。
- **指令分派**：day4 的 `factory.js` 持有全局 `Map<opcode, 指令实例>`，后续 day 用
  `register()` 补充或覆盖（day7 覆盖 ldc 支持字符串、day9 覆盖 idiv 支持除零异常）。
- **类初始化时机（§5.5）**：new/getstatic/putstatic/invokestatic 发现类未初始化时
  `revertNextPC()` 并压入 `<clinit>` 帧，返回后重执行原指令。
- **native 方法**：注册表 key 为 `类名~方法名~描述符`（描述符区分重载）；native 帧
  局部变量表放参数，返回值压到自身操作数栈，由 invokeMethod 搬运回调用者；
  native 方法无 Code 属性，按原书 hack 设 `maxStack=4`。
- **字符串拼接**：javac 17 默认生成 invokedynamic（StringConcatFactory），用
  `-XDstringConcat=inline` 改为 StringBuilder 调用链，避免实现 invokedynamic。
- **JDK 桩类**：不解析 `jmods`，自带极简 `java.lang.*` / `java.io.*`，
  `System.out` 由 VM 启动时注入；Windows 下 javac 需 `-encoding UTF-8`（默认 GBK）。
- **未实现**：字节码验证（信任 javac）、jsr/ret（JDK 6+ 不生成）、invokedynamic、
  多线程、GC（JS 引擎代劳）、monitorenter/exit、泛型/注解属性解析。

## 排错技巧

- `node src/dayN/main.js -cp build/classes -v Xxx` 打印每条指令 + 每帧的局部变量表/操作数栈。
- `javap -v -p build/classes/...` 是对照 class 文件结构的"标准答案"；
  `src/day2/classfile/disassembler.js` 的输出与 `javap -c` 逐项一致。
- 解释器抛异常时会自动打印 JVM 帧栈（类.方法 + pc + 栈状态）。

## License

[MIT](LICENSE)
