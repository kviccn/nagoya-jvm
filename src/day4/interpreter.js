// 书第5章 —— 解释器：取指 → 译码 → 执行
//
// 【架构说明：step/runThread 分离】
// 主循环拆成两个层次：
//   - step(thread)：执行一条指令。这是 web 可视化的基本驱动单元——
//     浏览器 UI 用定时器按可调速度反复调 step()，实现运行/暂停/单步/调速。
//   - runThread(thread)：Node CLI 场景，while 循环调 step() 直到栈空。
// 帧驱动（while 栈非空）的设计使 day6 方法调用、day9 异常展开都无需改动本循环。
//
// 【trace 钩子】
// setTracer(fn) 注入指令执行前回调 (frame, pc, opcode)，web 端借此高亮当前
// 指令并刷新栈帧视图；Node CLI 用 -v 安装默认的文本 tracer。
// 未注入时零开销（一次 null 判断）。
import { BytecodeReader } from './instructions/base.js';
import { getInstruction, opcodeName } from './instructions/factory.js';
import { Thread } from '../day3/rtda/thread.js';

// ---- trace 钩子（模块级单例，一个进程/页面只需一个） ----
let tracer = null;

/**
 * 注入指令级跟踪器；传 null 关闭。
 * @param {null | ((frame: object, pc: number, opcode: number) => void)} fn
 */
export function setTracer(fn) {
  tracer = fn;
}

/** 兼容旧接口：-v 开关 = 安装默认文本 tracer */
export function setVerbose(v) {
  setTracer(v ? defaultTracer : null);
}

/**
 * 解释执行一个方法（自动建帧压栈并跑到栈空）。
 * @param method day4 传伪方法 {maxLocals, maxStack, code}；day5+ 传 heap.Method
 * @param thread 可选，复用已有线程
 */
export function interpret(method, thread = new Thread()) {
  const frame = thread.newFrame(method);
  thread.pushFrame(frame);
  runThread(thread);
  return thread;
}

/**
 * 驱动线程跑到栈空（Node CLI 用）。
 * day10 用：调用方自行建好 main 帧（放入 args）后调用本函数。
 */
export function runThread(thread) {
  try {
    while (!step(thread)) { /* 循环体为空：全部工作都在 step 里 */ }
  } catch (e) {
    // e.exObj 存在说明是 day9 的未捕获 Java 异常，由 main 打印，这里不重复刷栈
    if (!e.exObj) {
      console.error(`[解释器异常] ${e.message}`);
      logFrames(thread);
    }
    throw e;
  }
}

const reader = new BytecodeReader(); // 复用单例，避免每条指令分配

/**
 * 执行一条指令（web 可视化的驱动单元）。
 * @returns {boolean} true 表示线程栈已空（程序结束）
 */
export function step(thread) {
  if (thread.isStackEmpty()) return true;

  const frame = thread.currentFrame();
  const pc = frame.nextPc;
  thread.pc = pc; // 记录当前指令地址：branch/revertNextPC/异常查找都以它为基准

  // 取指 + 译码
  reader.reset(frame.method.code, pc);
  const opcode = reader.readUint8();
  const inst = getInstruction(opcode);
  inst.fetchOperands(reader);
  frame.nextPc = reader.pc; // 下一条指令地址（跳转指令会在 execute 里改写它）

  if (tracer) tracer(frame, pc, opcode);
  inst.execute(frame); // 执行

  return thread.isStackEmpty();
}

// ---- 默认文本 tracer（Node CLI 的 -v 模式） ----
function defaultTracer(frame, pc, opcode) {
  const m = frame.method;
  const owner = m.class ? `${m.class.name}.${m.name}` : m.name ?? '<main>';
  console.log(
    `${owner}() pc=${String(pc).padStart(3)} ${opcodeName(opcode)}` +
    `  | locals=[${frame.localVars}] stack=[${frame.operandStack}]`,
  );
}

function logFrames(thread) {
  console.error('---- JVM 栈状态 ----');
  for (const f of thread.getFrames()) {
    const m = f.method;
    const owner = m.class ? `${m.class.name}.${m.name}${m.descriptor}` : '<day4-pseudo-method>';
    let stackStr;
    try { stackStr = `${f.operandStack}`; } catch { stackStr = '<stack toString 失败>'; }
    console.error(`  ${owner} pc=${f.nextPc} locals=[${f.localVars}] stack=[${stackStr}]`);
  }
}
