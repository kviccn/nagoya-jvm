---
layout: home
hero:
  name: nagoya-jvm
  text: 用 Node.js 自己动手写 Java 虚拟机
  tagline: 对照 JVMS 17 与《自己动手写Java虚拟机》，从零实现 class 解析器、类加载器和解释器，最终在浏览器里可视化单步执行字节码
  actions:
    - theme: brand
      text: 开始学习 →
      link: /guide/day1
    - theme: alt
      text: 🎮 在线解释器
      link: /playground
features:
  - title: 零依赖 Node.js 实现
    details: 只用 ES 标准 API（DataView/BigInt/TextDecoder），同一套内核代码同时跑在 Node CLI 和浏览器里
  - title: 逐章累计，步步可验收
    details: day1~day10 对应原书章节，每天都有可运行命令和明确的期望输出（如 fib(10)=55）
  - title: 现代 JDK 17 适配
    details: 解决了 --patch-module 编译桩类、-XDstringConcat=inline 绕过 invokedynamic 等新版 JDK 的真实适配问题
---
