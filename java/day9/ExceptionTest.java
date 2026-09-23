package day9;

// 书第10章用例：try/catch/finally + 除零异常 + printStackTrace
public class ExceptionTest {
    static int RESULT;

    public static void main(String[] args) {
        int r = 0;
        try {
            r = 1;
            dangerous(10, 0); // 除零 → ArithmeticException
            r = 2;            // 不应到达
        } catch (ArithmeticException e) {
            r += 100;
            e.printStackTrace();
        } finally {
            r += 1000;        // finally 总会执行
        }
        RESULT = r; // 1 + 100 + 1000 = 1101
    }

    static int dangerous(int a, int b) {
        return a / b;
    }
}
