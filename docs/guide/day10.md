# day10 完整 JVM

> 对应原书第 11 章（收官）。本章结束时：一个支持 `main(String[] args)` 传参的完整 JVM。

## 本章目标

```bash
npm run day10   # = node src/day10/main.js -cp build/classes day10.JvmDemo foo bar
# === mini JVM (Node.js) ===
# args.length = 2
# args[0] = foo
# fib(10) = 55
# grade(85) = B
# caught ArithmeticException
# === bye ===
```

## 背景知识

本章没有新的 JVM 机制——它是把前 9 天的能力**组装成一个完整的启动流程**，
并补上最后一块拼图：命令行参数如何变成 `main(String[] args)` 的实参。

真实 JVM 的启动序列（极度简化）：引导类加载器 → 初始化系统类 →
加载主类 → 建主线程 → 调 main。我们的版本同构，只是规模迷你。

## 源码讲解

### 启动流程：`src/day10/main.js`

```js
import '../day5/instructions/references.js';   // 副作用：注册引用类指令
import '../day6/instructions/invoke.js';       // 副作用：注册调用类指令
import '../day7/instructions/arrays.js';       // 副作用：注册数组指令 + ldc 字符串
import { initSystemOut } from '../day8/native/systemInit.js'; // 副作用：注册全部 native
import '../day9/instructions/athrow.js';       // 副作用：注册 athrow + 检查升级
```

**import 即装配**：每个模块的顶层 `register()/registerNative()` 调用在
import 时执行，VM 的"能力表"就这样被逐层拼满。这就是为什么 day10 的 main.js
里看不到任何"注册"代码。

```js
// 1. 类加载器 + 启动 System.out
const loader = new ArrayClassLoader(new Classpath(cmd.cpOption));
initSystemOut(loader);

// 2. 加载主类
const mainClass = loader.loadClass(cmd.className.replaceAll('.', '/'));

// 3. 命令行参数 → 堆中 String[]
const argsArr = createArgsArray(loader, cmd.args);

// 4. 建线程、建 main 帧、args 放入 0 号槽、启动解释循环
const thread = new Thread();
const frame = thread.newFrame(mainMethod);
frame.localVars.setRef(0, argsArr);       // main 是静态方法，0 号槽就是 args
thread.pushFrame(frame);
runThread(thread);
```

参数数组的构造复用 day7 的全部设施：

```js
function createArgsArray(loader, args) {
  const stringArrClass = loader.loadClass('[Ljava/lang/String;');  // 数组类现场造
  const arr = newArray(stringArrClass, args.length);
  for (let i = 0; i < args.length; i++) {
    arr.data[i] = jString(loader, args[i]);   // 每个参数经字符串池驻留
  }
  return arr;
}
```

### 验收矩阵：一个 demo 覆盖全书

`day10.JvmDemo` 的每一项都对应一天的能力：

| 输出 | 覆盖能力 | 章节 |
|------|---------|------|
| args.length = 2 | main 参数传递、String[] | day10 |
| fib(10) = 55 | 递归、动态分派、字符串拼接 native | day6/8 |
| grade(85) = B | tableswitch（switch 语句） | day4 |
| caught ArithmeticException | 除零 → 真异常 → catch | day9 |
| 多态/数组/驻留 | new、字段、数组、字符串池 | day5/6/7 |

## 至此的完整度

**指令覆盖**：~190 个有定义的 opcode 中实现 ~160 条。未实现的：

| 指令 | 为什么没实现 |
|------|-------------|
| jsr / ret | JDK 6+ 的 javac 不再生成（finally 改用异常表内联） |
| invokedynamic | 需要方法句柄体系；用 `-XDstringConcat=inline` 回避了字符串拼接场景，lambda 不支持 |
| monitorenter / monitorexit | 无多线程 |
| breakpoint / impdep1/2 | 保留指令，正常 class 文件不会出现 |
| wide 的部分组合 | wide ret 等 |

**诚实清单（没做的事）**：

- **字节码验证**（§4.10）：信任 javac 产出，加载时不验证——错误的字节码会造成未定义行为
- **GC**：对象生命周期交给 JS 引擎的垃圾回收
- **多线程**：Thread 类只是数据结构，没有调度
- **泛型/注解/反射**：相关属性（Signature/RuntimeAnnotations）按原始字节跳过
- **性能**：解释器无任何优化（真实 JVM 有 JIT、方法内联、逃逸分析……
  fib(10) 我们跑 1593 条指令，HotSpot 编译后是几条机器码）

## 双端架构总览

到了收官日，回看"同一份内核跑两端"是如何成立的：

```
                ┌──────────── 共享内核（零 node:* import）────────────┐
                │  classfile 解析 / rtda / heap / 指令集 / 解释器      │
                └───────┬──────────────────────────────┬─────────────┘
                        │ 鸭子类型注入                   │ 钩子注入
        ┌───────────────┴─────────────┐  ┌────────────┴───────────────┐
        │ Node CLI                    │  │ 浏览器（docs/）             │
        │ Classpath → node:fs 读盘     │  │ {readClass} → base64 查表   │
        │ runThread() 全速循环         │  │ setInterval 按速调 step()   │
        │ 默认 sink → console         │  │ setOutputSink → 终端面板     │
        │ 默认 tracer → 文本日志        │  │ 定时快照 → 帧栈/字节码视图    │
        └─────────────────────────────┘  └────────────────────────────┘
```

三个注入点（classpath 鸭子类型、step 驱动、输出 sink）撑起了全部差异——
这就是"只动基础设施，不动教学内容"的落地形态。去 [🎮 在线解释器](/playground)
选 `day6 递归 fib(10)`，速度拉低单步执行，亲眼看看帧栈的压入与弹出，
这是理解本章所有内容最直观的方式。

## 毕业设计级练习

1. **实现 3 个 native**：`Math.pow(DD)D`、`Object.hashCode()I`（用自增 id）、
   `String.length()I`（改 native 版，读 value 字段长度）。
2. **指令统计**：给解释器加每指令计数（Map<opcode, count>），
   比较 fib 递归版 vs 循环版的指令数和热点分布——这就是 JVM profiling 的雏形。
3. **阅读 §4.7.4 StackMapTable**：思考字节码验证要检查什么
   （每个基本块入口的局部变量表/操作数栈类型状态一致），
   以及为什么有了它验证从"数据流分析"退化成"线性检查"。
4. **lambda 初探**：写一个带 `Runnable r = () -> {...}` 的测试类，
   `javap -v` 看 invokedynamic 和 BootstrapMethods 属性长什么样，
   估算实现它需要哪些设施。
