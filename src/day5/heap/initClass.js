// 书第7章提前引入的基础设施 / §5.5 —— 类初始化：执行 <clinit>
// 触发点：new/getstatic/putstatic/invokestatic 指令发现类未初始化时，
// 撤销 nextPc（指令稍后重执行），把 <clinit> 帧压栈，解释器循环自然调度
export function initClass(thread, jClass) {
  jClass.initStarted = true; // 先置位，防止 <clinit> 引用自身导致死循环
  if (jClass.superClass && !jClass.superClass.initStarted) {
    initClass(thread, jClass.superClass);
  }
  const clinit = jClass.getClinitMethod();
  if (clinit) {
    thread.pushFrame(thread.newFrame(clinit));
  }
}
