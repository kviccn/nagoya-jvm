package day7;

// 书第8章用例：字符串字面量通过 ldc 入池驻留
public class StringTest {
    static int RESULT;

    public static void main(String[] args) {
        String a = "hello";
        String b = "hello";
        RESULT = (a == b) ? 1 : 0; // 同一字面量 → 同一对象 → 1
        RESULT += a.length();      // String.length() 读 char[] 长度 → +5 = 6
    }
}
