# 环境与构建

## 环境要求

- **JDK 17**（本教程基于 OpenJDK 17.0.2，class 文件 major version = 61）
- **Node.js ≥ 18**（推荐 v20+；用到了 ESM、DataView、BigInt、TextDecoder，全部是 ECMAScript 标准 API）
- VM 内核**零 npm 依赖**（VitePress 仅用于教程站点，与 VM 无关）

## 整体思路：我们要造一个什么东西

```
  java/HelloWorld.java          jdk/java/lang/*.java（桩 JDK）
        │ javac                          │ javac --patch-module
        ▼                                ▼
  build/classes/*.class         build/jdk/*.class
        └──────────┬───────────────────┘
                   ▼
        ┌──────────────────────┐
        │   我们的 JVM（src/）  │
        │  classpath → 找类     │  day1
        │  classfile → 解析     │  day2
        │  rtda → 数据区        │  day3
        │  instructions → 指令  │  day4~day9
        │  interpreter → 执行   │  day4+
        │  heap → 方法区/堆     │  day5~day7
        │  native → 本地方法    │  day8
        └──────────────────────┘
                   ▼
              程序输出
```

关键点：**我们的 VM 不读真实 JDK**（jmods 格式解析成本高），而是自带一套极简桩类
（`Object/String/System/PrintStream/Throwable/StringBuilder`），编译后用我们自己的
类路径加载。这和真实 JVM 用 `rt.jar` 引导自己是同一个思想，只是规模小了几个数量级。

## 构建

```bash
npm run build   # = bash scripts/build.sh
```

构建脚本做两件事，各有一个 JDK 17 下的关键知识点：

### 1. 编译桩 JDK（`jdk/` → `build/jdk`）

```bash
javac -encoding UTF-8 --patch-module java.base=jdk -d build/jdk $JDK_SOURCES
```

- **`--patch-module java.base=jdk`**：JDK 9+ 的模块系统禁止普通编译把类放进
  `java.lang` 等 `java.base` 已有的包（`package exists in another module: java.base`）。
  `--patch-module` 告诉 javac"这些源文件是对 java.base 模块的补丁"，从而允许编译。
  注意这只影响**编译期**；运行期我们的 VM 从 `build/jdk` 目录读 class 文件，
  和真实 JDK 毫无关系。
- **`-encoding UTF-8`**：Windows 上 javac 默认用系统编码（GBK）读源文件，
  源码里有中文注释或中文字符串时必须显式指定。

### 2. 编译测试类（`java/` → `build/classes`）

```bash
javac -encoding UTF-8 -XDstringConcat=inline -g -d build/classes $TEST_SOURCES
```

- **`-XDstringConcat=inline`**：javac 9+ 默认把 `"a" + b` 编译成
  `invokedynamic`（StringConcatFactory 在运行时生成拼接方法）。实现 invokedynamic
  需要方法句柄、LambdaMetafactory 等一整套设施，成本极高。这个隐藏选项让 javac
  退回 JDK 8 的行为：编译成 `StringBuilder.append` 调用链——我们只需给
  StringBuilder 写几个 native 方法（day8）即可。
- **`-g`**：生成 LineNumberTable / LocalVariableTable 调试信息，
  day2 的解析器会读到它们。

## 项目结构

```
src/day1 ~ src/day10   # 逐章实现（后续 day 直接 import 前几天的模块，绝不复制粘贴）
jdk/                   # 迷你 JDK 桩类（java.lang.* / java.io.*）
java/                  # 每天的验收测试类（dayN.XxxTest）
scripts/build.sh       # 构建脚本
scripts/pack-web.mjs   # 把 class 文件打成浏览器 bundle（在线解释器用）
docs/                  # 本教程站点（VitePress）
```

**为什么按 day 分目录而不是按包分？** 这是教学项目：每一天的 `main.js` 都是
**当天能力的可运行验收**——`npm run day5` 跑的是"只有 day1~5 知识时能做的事"。
后续 day 通过 `import '../day3/rtda/thread.js'` 复用基础设施，通过
`register(opcode, inst)` 往 day4 的全局指令分派表里补充新指令，
所以 src 里**没有重复代码**，day 目录只是"能力快照"的入口集合。

## 全教程最重要的工具：javap

```bash
javap -v -p build/classes/day4/GaussTest.class
```

- day2 写解析器时，`javap -v` 的输出就是标准答案——你解析出的每个字段都应与之相同
- day4 起每条字节码指令的语义用 `javap -c` 对照
- 遇到"这个属性/常量长什么样"的问题，先 javap 看一眼再写代码

## 双端兼容说明（本教程的特色）

这套 VM 内核（`src/day2`~`day10`，入口 `main.js` 除外）不 import 任何 `node:*` 模块，
只用 DataView/TextDecoder/BigInt 等标准 API，因此**同一份代码原样跑在浏览器里**——
就是 [🎮 在线解释器](/playground)。具体手段在各章的【双端说明】框里穿插讲解：

- 类加载靠**鸭子类型**：`ClassLoader` 只要求 classpath 对象有 `readClass(name)` 方法，
  Node 传文件系统实现，浏览器传 base64 查表实现
- 解释器 `step()/runThread()` 分离：CLI 循环跑 step，浏览器用定时器按可调速度驱动 step
- 所有输出走可注入的 sink：Node 默认 console，浏览器注入页面终端
