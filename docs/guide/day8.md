# day8 native 方法：HelloWorld

> 对应原书第 9 章。本章结束时：**`Hello, JVM!` 在我们的 VM 上打印出来**。

## 本章目标

```bash
npm run day8   # day8.HelloWorld
# Hello, JVM!
# fib(10) = 55
# b[2] = 3
```

## 背景知识

### native 方法是什么

JVM 的能力边界就是字节码的能力边界——但"往终端写一个字符"这件事字节码做不到，
必须落到宿主环境（真实 JVM 是 C 实现的 OS 调用；我们是 JS 的 console）。
`native` 关键字声明的方法就是这座桥：Java 侧只有签名，实现由 VM 用宿主语言提供。

### 桩 JDK 的双重身份

```
编译期                          运行期
javac 看到 java/lang/System 的     我们的 VM 从 build/jdk 加载桩类，
真实声明（来自 JDK 的 java.base）   执行到 println 时发现是 native，
（桩类仅用于 --patch-module 场景）  → 查注册表 → 执行 JS 实现
```

桩类 `java/io/PrintStream` 的所有 println 都标了 native，方法体为空——
它们是"协议"，真正的实现在 VM 的 JS 侧。

### 字符串拼接的真相

`"fib(10) = " + fib(10)` 经过 `-XDstringConcat=inline` 编译后变成：

```
new StringBuilder()
  .append("fib(10) = ")
  .append(55)
  .toString()
```

所以 HelloWorld 要打出来，至少需要：`PrintStream.println(String)`、
`StringBuilder.append(String/int)`、`StringBuilder.toString()` 四组 native。

## 源码讲解

### 注册表：`src/day6/nativeRegistry.js`

```js
const registry = new Map();
export function registerNative(key, impl) { registry.set(key, impl); }
export function findNativeMethod(key) { return registry.get(key); }
```

key 的格式 `类名~方法名~描述符`（如
`java/io/PrintStream~println~(Ljava/lang/String;)V`）——**描述符必须带**：
println 有 8 个重载，不带描述符会互相覆盖。

day6 的 `invokeMethod` 里，native 分支的执行流程：

```js
if (method.isNative()) {
  const key = `${method.class.name}~${method.name}~${method.descriptor}`;
  const impl = findNativeMethod(key);
  if (!impl) throw new Error(`native 方法未注册: ${key}`);
  impl(newFrame);          // native 实现：从 newFrame.localVars 读参数
  thread.popFrame();       //          把返回值压到 newFrame 自己的操作数栈
  // 返回值搬运回调用者操作数栈（long/double 占两槽，特殊处理）
  const { returnType } = parseMethodDescriptor(method.descriptor);
  if (returnType !== 'V') { /* popSlot/pushSlot 搬运 */ }
}
```

native 方法也走完整的"压帧 → 传参 → 弹帧 → 回传"流程——
对解释器主循环完全透明。

### PrintStream native：`src/day8/native/javaIoPrintStream.js`

```js
registerNative(`${N}~println~(Ljava/lang/String;)V`, (f) => {
  const jStr = f.localVars.getRef(1);       // 0 槽是 this，1 槽是第一个参数
  sinkPrintln(jStr === null ? 'null' : jsString(jStr));
});
registerNative(`${N}~println~(J)V`, (f) => sinkPrintln(String(f.localVars.getLong(1))));
```

读参数的位置规则：**0 号槽是 `this`**（println 是实例方法），参数从 1 号槽开始，
long/double 参数占两槽（1、2）。`jsString` 把堆中 String 还原成 JS 字符串。

### 输出 sink：`src/day8/native/output.js`

```js
const defaultSink = {
  println: (s) => console.log(s),
  print: (s) => {
    if (typeof process !== 'undefined' && process.stdout) process.stdout.write(s);
    else console.log(s);
  },
  error: (s) => console.error(s),
};
let sink = { ...defaultSink };
export function setOutputSink(partial) { sink = { ...defaultSink, ...partial }; }
```

**VM 的一切对外输出都汇到这三个函数**。Node 默认直通 console；
[在线解释器](/playground)在启动前 `setOutputSink` 注入渲染函数，
把输出画到页面终端面板——同一份 native 实现，两种出口。
注意默认 sink 里 `typeof process` 的**惰性判断**：模块加载期引用
`process.stdout` 会在浏览器里直接抛 ReferenceError。

### System.out 注入：`src/day8/native/systemInit.js`

```js
export function initSystemOut(loader) {
  const systemClass = loader.loadClass('java/lang/System');
  const psClass = loader.loadClass('java/io/PrintStream');
  const ps = psClass.newObject();                        // 桩类无字段，无需跑 <init>
  const outField = systemClass.getField('out', 'Ljava/io/PrintStream;', true);
  systemClass.staticVars.setRef(outField.slotId, ps);    // 直接写静态槽
  systemClass.initStarted = true;
}
```

真实 JVM 由 `System.initializeSystemClass()`（一个 native）在启动早期完成
out 的初始化；我们简化为 VM 启动时直接 new 一个 PrintStream 塞进 `System.out`
静态槽。效果等同：`System.out.println(...)` 的 getstatic 能取到非 null 的 PrintStream。

### StringBuilder native：`src/day8/native/javaLangStringBuilder.js`

桩类 StringBuilder 的 `buf` 字段直接存 **JS 字符串**（不是 char[]——
native 世界可以用宿主的最方便表示，只要 Java 侧看不见）：

```js
registerNative('java/lang/StringBuilder~append~(Ljava/lang/String;)Ljava/lang/StringBuilder;',
  (f) => {
    const self = f.localVars.getRef(0);
    const str = jsString(f.localVars.getRef(1));
    self.extra = (self.extra ?? '') + str;     // extra：对象的扩展位
    f.operandStack.pushRef(self);              // append 返回 this（链式调用）
  });
```

`extra` 是 JObject 的扩展槽——VM 需要给对象挂"规范之外的数据"时的逃生门
（day9 的调用链也挂在 extra 上）。

## 关键细节

1. **`registerNatives` 空方法**：真实 JDK 的 Object/System 等类有这个 native
   用于自举注册；invokeMethod 对它特判直接弹帧返回，桩类用不上。
2. **`arraycopy`**：`src/day8/native/javaLangSystem.js` 用 JS 数组切片实现，
   带类型/越界检查——String 的一些内部方法会用到。
3. **println(null)**：Java 语义是打印字符串 `"null"`，native 里显式处理。

## 动手实验

1. 给桩 PrintStream 加 `println(double)` 的调用示例，用 `-v` 观察 native 帧的
   局部变量表（double 参数占 1、2 两槽，this 在 0 槽）。
2. 实现一个 `java/lang/Math~sqrt~(D)D` native 并在测试类里调用
   （提示：返回值要 `pushDouble` 到 newFrame 的操作数栈）。
3. 把 `output.js` 的默认 sink 换成把每行输出加上 `[JVM]` 前缀——
   体会"所有输出一个出口"这个设计的便利。
