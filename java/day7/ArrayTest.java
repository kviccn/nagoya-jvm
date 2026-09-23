package day7;

// 书第8章用例：基本类型数组、引用数组、多维数组、arraylength
public class ArrayTest {
    static int RESULT;

    public static void main(String[] args) {
        int[] a = new int[10];
        for (int i = 0; i < a.length; i++) {
            a[i] = i * i;
        }
        long[] l = new long[3];
        l[0] = 100L;
        int[][] m = new int[2][3];
        m[1][2] = 7;
        String[] s = new String[2];
        s[0] = "x";
        RESULT = a[9] + (int) l[0] + m[1][2] + s.length; // 81 + 100 + 7 + 2 = 190
    }
}
