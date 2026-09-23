package java.lang;

// 迷你 JDK 桩：字符串。value 由 VM 直接填充（day7 字符串池）
public class String {
    private char[] value;

    public String() {
    }

    // 普通 Java 方法，在我们的 VM 上运行（arraylength 指令）
    public int length() {
        return value.length;
    }
}
