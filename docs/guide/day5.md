# day5 类和对象

> 对应原书第 6 章，JVMS §5.3/§5.4/§5.5。本章结束时：类加载器 + 方法区就位，
> 对象可以 new 出来，`<clinit>` 在首次使用时自动触发。

## 本章目标

```bash
npm run day5
# RESULT = 85
```

`StaticFieldTest`：`<clinit>` 把 `COUNT` 置 41 → main 里 `COUNT++` 两次（=43）
→ `RESULT = COUNT + ANSWER`（ANSWER 是编译期常量 42）→ 85。

## 背景知识

### 类的生命周期（§5.3~§5.5）

```
加载 Loading          链接 Linking                初始化 Initialization
┌─────────────┐   ┌─────────┬──────────┬───────┐   ┌──────────────────┐
│ class 文件   │ → │ 验证     │ 准备      │ 解析   │ → │ 执行 <clinit>      │
│ → JClass    │   │ (略)    │ 静态区    │ 符号引用│   │ （首次主动使用时）  │
└─────────────┘   └─────────┴──────────┴───────┘   └──────────────────┘
```

- **加载**：读字节码 → 方法区里的 `JClass`（本章）
- **准备**：静态字段分配槽位并置默认值；`static final` 常量直接按
  `ConstantValue` 属性写入（本章）
- **解析**：常量池里的符号引用 → 直接引用（首次使用时惰性解析，本章）
- **初始化**：执行 `<clinit>`（§5.5 规定了 6 种"首次主动使用"的触发时机，本章）

### 对象长什么样

```
堆中 JObject                     方法区 JClass
┌──────────────────┐            ┌────────────────────────┐
│ class ───────────┼───────────→│ name, superClass       │
│ data: Slots      │            │ fields[], methods[]    │
│  (实例字段槽位)   │            │ staticVars（静态区）     │
└──────────────────┘            │ constantPool（运行时）   │
                                │ instanceSlotCount      │
                                └────────────────────────┘
```

实例字段和静态字段**复用 day3 的 `Slots`**——"一切皆槽位"的设计再次兑现。

## 源码讲解

### 类加载器：`src/day5/heap/classLoader.js`

```js
loadClass(name) {
  const cached = this.classMap.get(name);
  if (cached) return cached;                  // 方法区缓存（classMap）
  return this.loadNonArrayClass(name);        // 数组类 day7 才支持
}

loadNonArrayClass(name) {
  const data = this.cp.readClass(name);       // ← 鸭子类型：day1 的 Classpath
  const cf = parseClassFile(data);            // ← day2 的解析器
  const jClass = this.defineClass(cf);
  this.link(jClass);
  return jClass;
}
```

注意 `resolveSuperClassAndInterfaces`：**加载一个类会递归触发父类和接口的加载**——
`java.lang.Object` 因此总是最早进方法区的类之一。

### 准备阶段：字段槽位编号

```js
calcInstanceFieldSlotIds(jClass) {
  let slotId = jClass.superClass ? jClass.superClass.instanceSlotCount : 0; // ★ 继承父类布局
  for (const f of jClass.fields) {
    if (!f.isStatic()) {
      f.slotId = slotId;
      slotId += f.isLongOrDouble() ? 2 : 1;
    }
  }
  jClass.instanceSlotCount = slotId;
}
```

**实例字段槽位从父类的 `instanceSlotCount` 继续编号**——这行代码就是"继承的字段布局"：
子类对象的 Slots 数组里，前面是父类字段，后面是自己的字段。getfield 解析出
slotId 后，无论对象实际是父类还是子类，用同一个偏移都能读对——这正是
单继承让字段访问变成 O(1) 数组下标的原因。

`initStaticFinalVars` 处理编译期常量：`static final int ANSWER = 42` 的 42
存于字段的 `ConstantValue` 属性，准备阶段直接写入静态区，**不等 `<clinit>`**。
（所以 StaticFieldTest 里 ANSWER 在 `<clinit>` 执行前就可用了。）

### 运行时常量池：`src/day5/heap/runtimeConstantPool.js`

day2 的常量池是静态字节结构；运行期需要"能解析的符号引用"。
三类符号引用共享一个惰性解析 + 缓存的模式：

```js
class SymRef {
  resolvedClass() {
    if (!this.resolvedClassCache) {
      const d = this.cp.class;                        // 发起引用的类
      const c = d.loader.loadClass(this.className);   // 用发起方的类加载器解析！
      if (!c.isAccessibleTo(d)) {
        throw new Error(`IllegalAccessError: ${d.name} -> ${c.name}`);
      }
      this.resolvedClassCache = c;
    }
    return this.resolvedClassCache;
  }
}
```

两个规范细节：

1. **用发起引用类的加载器去加载被引用类**（§5.4.3.1）——这是类加载器
   命名空间隔离的基础，虽然我们只有一个加载器，机制是忠实的。
2. **解析时做访问控制检查**（`IllegalAccessError`）：private 字段、
   非 public 类跨包访问在这里被拦截。

`FieldRef.resolvedField()` 在类解析之上再查字段（沿继承链），
`MethodRef` 同理——**解析结果都缓存**，同一符号第二次使用零成本。

### 初始化触发：`src/day5/heap/initClass.js` + 指令侧配合

`<clinit>` 的触发是全项目最精巧的控制流，值得逐行读。指令侧（以 getstatic 为例）：

```js
// src/day5/instructions/references.js
const field = cpOf(frame).getConstant(this.index).resolvedField();
const class_ = field.class;
if (!class_.initStarted) {
  frame.revertNextPC();              // ★ 撤销：本指令稍后重新执行
  initClass(frame.thread, class_);
  return;
}
// ... 正常读静态字段
```

initClass 侧：

```js
export function initClass(thread, jClass) {
  jClass.initStarted = true;                          // ★ 先置位，防自引用死循环
  if (jClass.superClass && !jClass.superClass.initStarted) {
    initClass(thread, jClass.superClass);             // ★ 父类先初始化（§5.5）
  }
  const clinit = jClass.getClinitMethod();
  if (clinit) thread.pushFrame(thread.newFrame(clinit));
}
```

合起来的时序：

```
getstatic 发现类未初始化
  → revertNextPC()：frame.nextPc 退回 getstatic 自己的地址
  → initClass：压入 <clinit> 帧
  → 解释器下一轮：栈顶是 <clinit>，开始执行静态块
  → <clinit> return：弹帧
  → 解释器下一轮：栈顶又是原方法帧，nextPc 恰好指回 getstatic
  → getstatic 重执行，此时 initStarted=true，正常读字段
```

**不需要任何特殊调度**——"弹帧后回到调用者"是帧模型的固有行为，
revertNextPC 只是借用了它。new/putstatic/invokestatic 用完全相同的模式。

### new 与字段访问指令

`New` 创建对象（字段槽位全部清零），构造函数的调用是 javac 生成的
`invokespecial <init>`——**new 指令本身不调用构造器**，day6 实现 invoke 后
对象才真正可用。`GetField/PutField` 按 `field.descriptor[0]` 分派类型，
从 `ref.fields()`（就是 day3 的 Slots）按 slotId 读写。

## 关键细节

1. **`initStarted` 先置位**：若 `<clinit>` 里又引用了本类静态字段
   （`static int X = X + 1` 之类的循环初始化），不先置位会无限递归压帧。
2. **接口字段**：接口的 `public static final` 字段也是常量，getstatic 解析时
   `getField` 会沿超接口查找（class.js 的字段解析顺序：本类 → 超接口 → 超类）。
3. **`isAssignableFrom`**：instanceof/checkcast 的语义核心，处理了
   类-类、类-接口、数组-数组（组件类型协变）三种情形——
   `String[] instanceof Object[]` 为 true 就靠最后那个分支。

## 动手实验

1. 给 StaticFieldTest 加 `static final long L = 123456789012345L;`，
   重新编译后在 `initStaticFinalVars` 打断点/加日志，观察 BigInt 写入静态区。
2. 把 `COUNT = 41` 从静态块挪到声明处（`static int COUNT = 41;`），
   `javap -c` 对比 `<clinit>`——结论：javac 把两种写法都合并进 `<clinit>`。
3. 写一个类 A 的 `<clinit>` 里读 B 的静态字段，B 的 `<clinit>` 里又读 A 的，
   观察初始化顺序（§5.5 要求当前线程独占初始化锁，我们的单线程 VM 简化了这点）。
