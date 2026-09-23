package java.io;

// 迷你 JDK 桩：全部方法 native，由 VM 注册表实现（day8）
public class PrintStream {
    public PrintStream() {
    }

    public native void println();

    public native void println(boolean x);

    public native void println(char x);

    public native void println(int x);

    public native void println(long x);

    public native void println(float x);

    public native void println(double x);

    public native void println(String x);

    public native void print(String x);

    public native void print(int x);
}
