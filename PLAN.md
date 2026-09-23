# JVM Spec 学习计划：用 Node.js 实现一个迷你 JVM（已全部完成 ✅）

> 按《自己动手写 Java 虚拟机》（张秀宏）章节组织，对照 JVMS 17，
> 用 Node.js (ESM) 实现：class 文件解析器 → 类加载器 → 解释器 → 完整 JVM。
> 代码按 `src/day1` ~ `src/day10` 逐天累计，详见 [README.md](README.md)。
>
> 环境：OpenJDK 17.0.2（class major version = 61）、Node.js v26。

| day | 对应书章节 | Spec 章节 | 内容 | 状态 |
|-----|-----------|-----------|------|------|
| day1 | 第1、2章 | — | 命令行工具、类路径搜索 | ✅ |
| day2 | 第3章 | §4 | class 文件解析器（常量池/字段/方法/属性） | ✅ |
| day3 | 第4章 | §2.5/§2.6 | 运行时数据区（Slot/局部变量表/操作数栈/帧/栈/线程） | ✅ |
| day4 | 第5章 | §6 | ~140 条指令 + 解释器循环（GaussTest sum=5050） | ✅ |
| day5 | 第6章 | §5.3/§5.4 | 方法区、运行时常量池、类加载与链接、`<clinit>` 触发 | ✅ |
| day6 | 第7章 | §5.4.3/§6.5 | 方法调用与返回、动态分派（fib(10)=55） | ✅ |
| day7 | 第8章 | §5.3.3 | 数组、字符串池（ldc 字符串、intern） | ✅ |
| day8 | 第9章 | §2.9 | native 注册表、System.out.println、HelloWorld | ✅ |
| day9 | 第10章 | §2.10/§4.7.3 | 异常：athrow、异常表、逐帧展开、调用链 | ✅ |
| day10 | 第11章 | — | 收官：完整 JVM、main(String[]) 传参、综合演示 | ✅ |

## 学习路径回顾（建议的消化顺序）

1. **先跑再看**：`npm run build && npm run day10`，确认整体可用。
2. **逐天阅读**：每个 `src/dayN/` 目录头部注释标注了对应章节；配合书和
   [JVMS 17](https://docs.oracle.com/javase/specs/jvms/se17/html/) 对照读。
3. **动手练习**（每天一个）：
   - day2：`node src/day2/main.js` 输出与 `javap -v` 逐项对照
   - day4：拿 `java/day6/FibonacciTest.java` 的 fib 字节码（`javap -c`）手工反汇编，再 `-v` 跑跟踪比对
   - day5：给 `javap -v` 里的某个字段手写 access_flags 解码
   - day6：修改 `VirtualDispatchTest`，观察接口调用（invokeinterface）路径
   - day9：给 `ExceptionTest` 加嵌套 try 和自定义异常，观察逐帧展开
4. **进阶方向**（本书之外，按兴趣选做）：
   - 字节码验证（§4.10，StackMapTable 已在解析器中保留原始字节）
   - invokedynamic（§4.4.10，lambda 原理；当前用 `-XDstringConcat=inline` 回避）
   - 泛型 Signature 属性、注解属性解析
   - 简单 GC / 对象头模型

## 参考

- 《自己动手写 Java 虚拟机》（张秀宏，Go 版，本仓库为其 Node.js 平移实现）
- 《The Java Virtual Machine Specification, Java SE 17 Edition》
- `javap -v -p` 输出 = 最好的调试对照工具
