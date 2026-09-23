# 🎮 在线解释器

在浏览器里单步执行字节码：左侧是当前方法的反汇编（高亮下一条指令），中间是帧栈
（每帧的局部变量表和操作数栈），底部是 `System.out` 输出。

建议玩法：

- 选 **day6 递归 fib(10)**，速度拉到最低，单步观察方法调用时帧的压入与弹出
- 选 **day10 综合演示**，观察 `args.length` / `args[0]` 的输出——
  示例自带的参数（`foo bar`）会经字符串池驻留后作为 `String[]` 放进 main 帧的 0 号槽；
  工具栏下方给出等价的 Node CLI 命令，本地可复现完全一致的行为

<JvmVisualizer />

::: tip 本地运行
```bash
npm run build      # 编译桩 JDK + 测试类
npm run build:web  # 把 class 文件打包成浏览器 bundle
npm run docs:dev   # 启动文档站（含本页）
```
:::
