package java.lang;

// 迷你 JDK 桩：异常基类。调用栈由 VM 记录在对象的 extra 扩展位（day9）
public class Throwable {
    public Throwable() {
    }

    public native void printStackTrace();
}
