package day6;

// 书第7章用例：invokestatic 递归调用
public class FibonacciTest {
    static int RESULT;

    public static void main(String[] args) {
        RESULT = fib(10); // 期望 55
    }

    static int fib(int n) {
        if (n < 2) {
            return n;
        }
        return fib(n - 1) + fib(n - 2);
    }
}
