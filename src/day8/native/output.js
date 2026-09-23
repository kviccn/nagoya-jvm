// 【双端兼容说明】可注入的输出汇（sink）
// VM 的所有"对外输出"（PrintStream native、异常调用链打印）都汇到这三个函数上：
//   - Node CLI：默认 sink 直通 console/stdout，行为与之前完全一致
//   - Web 端：setOutputSink() 注入渲染函数，把输出画到页面的终端面板
// 注意模块加载期不能引用 process.stdout（浏览器无此对象），所以默认 sink 用惰性判断。

const defaultSink = {
  /** 输出一行（println） */
  println: (s) => console.log(s),
  /** 不换行输出（print） */
  print: (s) => {
    // Node：写 stdout 保持无换行语义；浏览器：退化为 console.log
    if (typeof process !== 'undefined' && process.stdout) process.stdout.write(s);
    else console.log(s);
  },
  /** 错误输出一行（异常调用链） */
  error: (s) => console.error(s),
};

let sink = { ...defaultSink };

/** 注入输出 sink（web 端在 VM 启动前调用）；可只覆盖部分方法 */
export function setOutputSink(partial) {
  sink = { ...defaultSink, ...partial };
}

/** 恢复默认（web 端 Reset 时用） */
export function resetOutputSink() {
  sink = { ...defaultSink };
}

export function sinkPrintln(s) { sink.println(String(s)); }
export function sinkPrint(s) { sink.print(String(s)); }
export function sinkError(s) { sink.error(String(s)); }
