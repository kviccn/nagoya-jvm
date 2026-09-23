<!--
  JVM 在线可视化解释器
  =====================
  直接复用仓库里的 VM 内核（@vm → src/），在浏览器里驱动：
    - step(thread) 单步执行（day4 解释器的 step/runThread 分离就是为这里准备的）
    - 每个 UI tick 批量执行 N 步（速度滑块控制 N），tick 末尾从线程快照一次 UI 状态
      —— 不用逐指令 tracer，全速时 fib(10) 的 1593 条指令也不会卡渲染
  类文件来自构建期生成的 classes-bundle.js（scripts/pack-web.mjs），
  通过"查表式假 Classpath"喂给同步的 ClassLoader。
-->
<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount } from 'vue';
import { CLASS_BUNDLE } from '../vm/classes-bundle.js';

// ---- VM 内核（与 Node CLI 完全同一份代码） ----
import { ArrayClassLoader, newArray } from '@vm/day7/heap/array.js';
import { Thread } from '@vm/day3/rtda/thread.js';
import { step } from '@vm/day4/interpreter.js';
import '@vm/day5/instructions/references.js';   // 副作用：注册引用类指令
import '@vm/day6/instructions/invoke.js';       // 副作用：注册调用类指令
import '@vm/day7/instructions/arrays.js';       // 副作用：注册数组指令
import { initSystemOut } from '@vm/day8/native/systemInit.js'; // 副作用：注册 native
import '@vm/day9/instructions/athrow.js';       // 副作用：注册 athrow + 检查升级
import { setOutputSink } from '@vm/day8/native/output.js';
import { disassemble } from '@vm/day2/classfile/disassembler.js';
import { jsString, jString } from '@vm/day7/heap/stringPool.js';
import { UncaughtJvmException } from '@vm/day9/heap/exception.js';

// ---- 可选示例（都编译自 java/ 目录，已打进 bundle） ----
// args：该示例的 main(String[]) 参数（只读展示）；无 args 的示例不显示参数框
const DEMOS = [
  { id: 'day4.GaussTest', label: 'day4 高斯求和（观察局部变量表）' },
  { id: 'day5.StaticFieldTest', label: 'day5 静态字段与 <clinit>' },
  { id: 'day6.FibonacciTest', label: 'day6 递归 fib(10)' },
  { id: 'day6.VirtualDispatchTest', label: 'day6 虚方法动态分派' },
  { id: 'day7.ArrayTest', label: 'day7 数组（含多维）' },
  { id: 'day7.StringTest', label: 'day7 字符串驻留' },
  { id: 'day8.HelloWorld', label: 'day8 HelloWorld（println）' },
  { id: 'day9.ExceptionTest', label: 'day9 try/catch/finally' },
  { id: 'day9.UncaughtTest', label: 'day9 未捕获异常调用链' },
  { id: 'day10.JvmDemo', label: 'day10 综合演示', args: 'foo bar' },
];

// ---- 响应式状态 ----
const selectedDemo = ref(DEMOS[0].id);
const currentDemo = computed(() => DEMOS.find((d) => d.id === selectedDemo.value));
// 该示例对应的 Node CLI 完整命令（与 npm run dayN 等价）
const cliCommand = computed(() => {
  const d = currentDemo.value;
  const day = d.id.split('.')[0]; // 'day10.JvmDemo' → 'day10'
  return `node src/${day}/main.js -cp build/classes ${d.id}${d.args ? ' ' + d.args : ''}`;
});
const status = ref('ready'); // ready | running | paused | done | error
const consoleLines = ref([]); // 终端面板行
const frames = shallowRef([]); // 帧栈快照（栈顶在前）
const bytecode = shallowRef([]); // 当前栈顶方法的反汇编
const activePc = ref(-1); // 当前（将要执行的）指令 pc
const stepsCount = ref(0); // 已执行指令数
const resultText = ref(''); // RESULT 静态字段（如果示例有）
const errorText = ref('');

// 速度滑块：档位 → 每个 tick(30ms) 执行的指令数
const SPEED_LEVELS = [1, 10, 100, 1000, 10000];
const speedLevel = ref(2); // 默认 100 步/tick ≈ 3300 条/秒

// ---- 非响应式的 VM 状态（大对象，不走 Vue 响应式以免拖累性能） ----
let thread = null;
let mainClass = null;
let timer = null;
const disasmCache = new WeakMap(); // method → 反汇编结果（方法不可变，安全缓存）

// base64 → Uint8Array（浏览器环境，atob 原生可用）
function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 查表式假 Classpath：ClassLoader 是鸭子类型，只需要 readClass(name)
const bundleClasspath = {
  readClass(name) {
    const data = CLASS_BUNDLE[name];
    if (!data) throw new Error(`ClassNotFoundException: ${name}`);
    return b64ToBytes(data);
  },
};

// 输出汇：VM 的一切输出都画到终端面板
function pushLine(kind, text) {
  consoleLines.value.push({ kind, text });
  if (consoleLines.value.length > 500) consoleLines.value.shift();
}

setOutputSink({
  println: (s) => pushLine('out', s),
  print: (s) => pushLine('out', s),
  error: (s) => pushLine('err', s),
});

// ---- VM 生命周期 ----
function reset() {
  stopTimer();
  // 重新建类加载器和线程：类对象、静态区、堆全部全新，天然完成 Reset
  // （指令/native 注册是全局副作用，只需注册一次，import 时已保证）
  const loader = new ArrayClassLoader(bundleClasspath);
  initSystemOut(loader);
  mainClass = loader.loadClass(selectedDemo.value.replaceAll('.', '/'));
  thread = new Thread();
  const frame = thread.newFrame(mainClass.getMainMethod());
  // main(String[] args)：把输入的参数构造成堆中 String[]，放进 0 号槽（day10 同款流程）
  frame.localVars.setRef(0, createArgsArray(loader, currentDemo.value.args ?? ''));
  thread.pushFrame(frame);
  status.value = 'ready';
  consoleLines.value = [];
  stepsCount.value = 0;
  resultText.value = '';
  errorText.value = '';
  snapshot();
}

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function run() {
  if (status.value === 'done' || status.value === 'error') return;
  status.value = 'running';
  timer = setInterval(() => {
    const n = SPEED_LEVELS[speedLevel.value];
    try {
      for (let i = 0; i < n; i++) {
        if (step(thread)) {
          finish();
          return;
        }
        stepsCount.value++;
      }
      snapshot(); // 每 tick 只刷新一次 UI
    } catch (e) {
      fail(e);
    }
  }, 30);
}

function pause() {
  stopTimer();
  status.value = 'paused';
  snapshot();
}

function singleStep() {
  if (status.value === 'done' || status.value === 'error') return;
  stopTimer();
  try {
    const done = step(thread);
    stepsCount.value++;
    snapshot();
    if (done) finish();
    else status.value = 'paused';
  } catch (e) {
    fail(e);
  }
}

function finish() {
  stopTimer();
  status.value = 'done';
  snapshot();
  // 示例约定：把结果写到 static int RESULT 的，读出来展示
  const resultField = mainClass.getField('RESULT', 'I', true);
  if (resultField) {
    resultText.value = `RESULT = ${mainClass.staticVars.getInt(resultField.slotId)}`;
  }
}

function fail(e) {
  stopTimer();
  status.value = 'error';
  snapshot();
  if (e instanceof UncaughtJvmException) {
    // Java 层的未捕获异常：printStackTrace 已通过 sink 打到面板
    errorText.value = `程序因未捕获异常终止：${e.exObj.class.name}`;
  } else {
    errorText.value = `VM 内部错误：${e.message}`;
  }
}

// ---- UI 快照：从线程当前状态生成一次响应式副本 ----
function snapshot() {
  if (!thread || thread.isStackEmpty()) {
    frames.value = [];
    bytecode.value = [];
    activePc.value = -1;
    return;
  }
  frames.value = thread.getFrames().map((f) => ({
    name: `${f.method.class.name}.${f.method.name}${f.method.descriptor}`,
    pc: f.nextPc,
    locals: snapshotSlots(f.localVars.slots, f.localVars.slots.length),
    stack: snapshotSlots(f.operandStack.slots, f.operandStack.size),
  }));
  const top = thread.currentFrame();
  bytecode.value = disassembleMethod(top.method);
  activePc.value = top.nextPc; // 高亮"下一条将要执行的指令"
}

function snapshotSlots(slots, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = slots[i];
    out.push(s.ref !== null ? describeRef(s.ref) : String(s.num));
  }
  return out;
}

// 引用值的可读描述（防御性：任何一步出错都不影响快照）
function describeRef(ref) {
  try {
    if (ref.class.name === 'java/lang/String') return `"${jsString(ref)}"`;
    if (ref.class.isArray()) return `${ref.class.name}[${ref.data.length}]`;
    return ref.class.name.split('/').pop();
  } catch {
    return 'ref';
  }
}

const disasmOf = (m) => {
  if (!disasmCache.has(m)) {
    disasmCache.set(m, disassemble(m.code, m.class.constantPool.rawCp));
  }
  return disasmCache.get(m);
};
const disassembleMethod = disasmOf;

// 命令行参数 → 堆中 String[]（与 src/day10/main.js 的 createArgsArray 同构）
function createArgsArray(loader, input) {
  const args = input.trim() === '' ? [] : input.trim().split(/\s+/);
  const arr = newArray(loader.loadClass('[Ljava/lang/String;'), args.length);
  for (let i = 0; i < args.length; i++) {
    arr.data[i] = jString(loader, args[i]);
  }
  return arr;
}

onMounted(reset);
onBeforeUnmount(stopTimer);
</script>

<template>
  <div class="jvm-viz">
    <!-- 控制条 -->
    <div class="toolbar">
      <select v-model="selectedDemo" :disabled="status === 'running'" @change="reset">
        <option v-for="d in DEMOS" :key="d.id" :value="d.id">{{ d.label }}</option>
      </select>
      <button v-if="status !== 'running'" class="primary" @click="run">▶ 运行</button>
      <button v-else @click="pause">⏸ 暂停</button>
      <button :disabled="status === 'done' || status === 'error'" @click="singleStep">⏭ 单步</button>
      <button @click="reset">↺ 重置</button>
      <label class="speed">
        速度
        <input v-model.number="speedLevel" type="range" min="0" max="4" step="1" />
        <span>{{ SPEED_LEVELS[speedLevel] }} 步/帧</span>
      </label>
      <span class="badge" :class="status">{{ status }}</span>
      <span class="steps">{{ stepsCount }} 条指令</span>
    </div>

    <!-- 第二行：等价的 CLI 命令（示例自带的 args 也会拼进命令里） -->
    <div class="subbar">
      <span class="cli">本地运行：<code>{{ cliCommand }}</code></span>
    </div>

    <div v-if="errorText" class="error-banner">{{ errorText }}</div>
    <div v-if="resultText" class="result-banner">✅ {{ resultText }}</div>

    <div class="panels">
      <!-- 左：字节码 -->
      <div class="panel">
        <div class="panel-title">字节码（栈顶方法）</div>
        <div class="code-list">
          <div
            v-for="ins in bytecode"
            :key="ins.pc"
            class="code-line"
            :class="{ active: ins.pc === activePc }"
          >
            <span class="pc">{{ String(ins.pc).padStart(4) }}</span>
            <span>{{ ins.text }}</span>
          </div>
          <div v-if="!bytecode.length" class="empty">（线程已结束）</div>
        </div>
      </div>

      <!-- 中：帧栈 -->
      <div class="panel">
        <div class="panel-title">帧栈（栈顶在上）</div>
        <div class="frames-list">
          <div v-for="(f, i) in frames" :key="i" class="frame-card">
            <div class="frame-name">{{ f.name }}</div>
            <div class="frame-row">
              <span class="tag">nextPc</span>
              <code>{{ f.pc }}</code>
            </div>
            <div class="frame-row">
              <span class="tag">局部变量表</span>
              <code>[{{ f.locals.join(', ') }}]</code>
            </div>
            <div class="frame-row">
              <span class="tag">操作数栈</span>
              <code>[{{ f.stack.join(', ') }}]</code>
            </div>
          </div>
          <div v-if="!frames.length" class="empty">（空）</div>
        </div>
      </div>

      <!-- 下/右：控制台 -->
      <div class="panel console-panel">
        <div class="panel-title">控制台输出</div>
        <div class="console-body">
          <div v-for="(l, i) in consoleLines" :key="i" :class="l.kind">{{ l.text }}</div>
          <div v-if="!consoleLines.length" class="empty">（暂无输出）</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jvm-viz {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}
.toolbar select,
.toolbar button {
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.toolbar button.primary {
  background: var(--vp-c-brand-1);
  color: #fff;
  border-color: var(--vp-c-brand-1);
}
.toolbar button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.speed {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--vp-c-text-2);
}
.subbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin: -2px 0 10px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.cli code {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  font-family: var(--vp-font-family-mono);
  user-select: all;
}
.badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 12px;
}
.badge.running { background: #16a34a22; color: #16a34a; }
.badge.done { background: #2563eb22; color: #2563eb; }
.badge.error { background: #dc262622; color: #dc2626; }
.steps { color: var(--vp-c-text-2); font-size: 12px; }
.error-banner, .result-banner {
  padding: 6px 10px;
  border-radius: 6px;
  margin-bottom: 8px;
}
.error-banner { background: #dc262622; color: #dc2626; }
.result-banner { background: #16a34a22; color: #16a34a; }
.panels {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 10px;
}
.panel {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 120px;
}
.console-panel { grid-column: 1 / -1; }
.panel-title {
  padding: 6px 10px;
  background: var(--vp-c-bg-soft);
  font-weight: 600;
  color: var(--vp-c-text-2);
}
.code-list, .frames-list, .console-body {
  padding: 6px;
  overflow: auto;
  max-height: 320px;
  font-family: var(--vp-font-family-mono);
}
.code-line {
  display: flex;
  gap: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: pre;
}
.code-line.active {
  background: #eab30833;
  outline: 1px solid #eab308;
}
.code-line .pc { color: var(--vp-c-text-3); }
.frame-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
}
.frame-name { font-weight: 600; margin-bottom: 4px; }
.frame-row { display: flex; gap: 8px; }
.frame-row .tag {
  flex: 0 0 80px;
  color: var(--vp-c-text-3);
}
.console-body .err { color: #dc2626; }
.empty { color: var(--vp-c-text-3); padding: 8px; }

/* ---- 移动端适配 ---- */
@media (max-width: 768px) {
  .jvm-viz {
    padding: 8px;
    font-size: 12px;
  }

  /* 工具栏：示例选择独占一行，按钮加大触控热区，速度条占满一行 */
  .toolbar {
    gap: 6px;
  }
  .toolbar select {
    flex: 1 1 100%;
    padding: 8px 10px;
  }
  .toolbar button {
    flex: 1 1 auto;
    padding: 8px 12px; /* ≥36px 触控高度 */
  }
  .speed {
    flex: 1 1 100%;
  }
  .speed input[type='range'] {
    flex: 1;
  }
  .badge, .steps {
    margin-left: auto;
  }

  /* 长命令允许折行，不掕破布局 */
  .cli code {
    word-break: break-all;
    user-select: all;
  }

  /* 面板单列堆叠：字节码 → 帧栈 → 控制台 */
  .panels {
    grid-template-columns: 1fr;
  }
  .panel {
    min-height: 0;
  }
  .code-list, .frames-list, .console-body {
    max-height: 220px; /* 小屏上避免单面板过长 */
    font-size: 11px;
  }
  .console-body {
    max-height: 160px;
  }

  /* 帧卡片内容允许折行（小屏放不下长数组） */
  .frame-row .tag {
    flex: 0 0 64px;
  }
  .frame-row code {
    word-break: break-all;
  }
  .frame-name {
    word-break: break-all;
  }
}

/* 超小屏进一步收紧 */
@media (max-width: 480px) {
  .code-list, .frames-list, .console-body {
    max-height: 180px;
  }
  .toolbar button {
    padding: 8px 8px;
  }
}
</style>
