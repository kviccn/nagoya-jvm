// day3 验收：演示局部变量表、操作数栈、帧栈的行为（书第4章）
// 运行: node src/day3/main.js
import { Thread } from './rtda/thread.js';

const thread = new Thread();
// 伪方法：maxLocals=2, maxStack=2
const frame = thread.newFrame({ maxLocals: 2, maxStack: 2 });
thread.pushFrame(frame);

// 模拟: iconst_5; istore_0; ldc 100L; lstore_1?（演示即可）
frame.operandStack.pushInt(5);
frame.localVars.setInt(0, frame.operandStack.popInt());
frame.operandStack.pushLong(100n);
frame.localVars.setLong(1, frame.operandStack.popLong());

console.log('localVars:', frame.localVars.toString()); // 5,100,0
console.log('int@0 =', frame.localVars.getInt(0));     // 5
console.log('long@1 =', frame.localVars.getLong(1));   // 100n

// 帧栈 push/pop
const frame2 = thread.newFrame({ maxLocals: 1, maxStack: 1 });
thread.pushFrame(frame2);
console.log('currentFrame is frame2:', thread.currentFrame() === frame2);
thread.popFrame();
console.log('currentFrame is frame:', thread.currentFrame() === frame);
