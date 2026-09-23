package day8;

// 书第9章里程碑：第一个有输出的程序
public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, JVM!");
        System.out.println("fib(10) = " + fib(10)); // 字符串拼接 → StringBuilder native 链
        int[] a = {1, 2, 3};
        int[] b = new int[3];
        System.arraycopy(a, 0, b, 0, 3);
        System.out.println("b[2] = " + b[2]);
    }

    static int fib(int n) {
        return n < 2 ? n : fib(n - 1) + fib(n - 2);
    }
}
