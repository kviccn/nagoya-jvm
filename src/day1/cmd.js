// 书第1章：命令行工具 —— 解析 -cp/-classpath、主类名和程序参数
// 用法: node src/dayN/main.js [-cp <path>] <className> [args...]
export function parseCmd(argv) {
  const cmd = { cpOption: '.', className: null, args: [], help: false };
  const rest = [...argv];
  while (rest.length > 0) {
    const arg = rest.shift();
    if (arg === '-cp' || arg === '-classpath') {
      cmd.cpOption = rest.shift();
    } else if (arg === '-h' || arg === '--help') {
      cmd.help = true;
    } else if (arg === '-v' || arg === '--verbose') {
      cmd.verbose = true;
    } else if (cmd.className === null) {
      cmd.className = arg; // 第一个非选项参数是主类
    } else {
      cmd.args.push(arg); // 其余是传给 main(String[]) 的参数
    }
  }
  return cmd;
}

export function printUsage() {
  console.log('用法: node src/dayN/main.js [-options] class [args...]');
  console.log('  -cp/-classpath <path>   类搜索路径，用 ; 分隔，支持目录');
  console.log('  -v/--verbose            打印每条执行的指令');
}
