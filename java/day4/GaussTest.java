package day4;

// 书第5章经典用例：只用 load/store/算术/跳转指令，无方法调用、无对象
public class GaussTest {
    public static void main(String[] args) {
        int sum = 0;
        for (int i = 1; i <= 100; i++) {
            sum += i;
        }
        // day4 还没有 System.out，用指令跟踪观察 sum 最终应为 5050
        int result = sum;
    }
}
