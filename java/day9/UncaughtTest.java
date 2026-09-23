package day9;

// 书第10章用例：athrow + 未捕获异常 —— 逐帧展开后打印调用链
public class UncaughtTest {
    public static void main(String[] args) {
        bar();
    }

    static void bar() {
        baz();
    }

    static void baz() {
        throw new RuntimeException();
    }
}
