package day5;

// 书第6章用例：类加载、<clinit>、static final 常量
// 注：实例字段/new 的指令虽在 day5 实现，但 <init> 调用（invokespecial）属于 day7 章（day6），
// 所以本用例只覆盖静态部分；实例相关验证见 day6.VirtualDispatchTest
public class StaticFieldTest {
    static int COUNT;
    static final int ANSWER = 42; // ConstantValue 属性，prepare 阶段直接初始化
    static int RESULT;

    static {
        COUNT = 41; // 由 <clinit> 执行，应被第一条 getstatic 触发
    }

    public static void main(String[] args) {
        COUNT++;                     // 42
        COUNT++;                     // 43
        RESULT = COUNT + ANSWER;     // 43 + 42 = 85
    }
}
