package day10;

// 书第11章收官用例：综合运用——main 参数、字符串拼接、递归、数组、foreach、
// switch（tableswitch）、try/catch/finally、除零异常
public class JvmDemo {
    public static void main(String[] args) {
        System.out.println("=== mini JVM (Node.js) ===");
        System.out.println("args.length = " + args.length);
        for (int i = 0; i < args.length; i++) {
            System.out.println("args[" + i + "] = " + args[i]);
        }
        System.out.println("fib(10) = " + fib(10));

        int[] primes = {2, 3, 5, 7};
        int sum = 0;
        for (int p : primes) {
            sum += p;
        }
        System.out.println("sum(primes) = " + sum);

        System.out.println("grade(85) = " + grade(85));
        System.out.println("grade(62) = " + grade(62));

        try {
            risky();
        } catch (ArithmeticException e) {
            System.out.println("caught ArithmeticException");
        } finally {
            System.out.println("finally done");
        }
        System.out.println("=== bye ===");
    }

    static int fib(int n) {
        return n < 2 ? n : fib(n - 1) + fib(n - 2);
    }

    static String grade(int score) {
        switch (score / 10) {
            case 9:
            case 10:
                return "A";
            case 8:
                return "B";
            case 7:
                return "C";
            default:
                return "D";
        }
    }

    static void risky() {
        int x = 1 / 0;
    }
}
