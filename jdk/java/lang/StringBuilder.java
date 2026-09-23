package java.lang;

// 迷你 JDK 桩：字符串拼接（javac -XDstringConcat=inline 会生成对它的调用链）
// buf 字段存的是 VM 侧的 JS 字符串，由 native 方法直接操作
public class StringBuilder {
    private Object buf;

    public StringBuilder() {
    }

    public native StringBuilder append(String s);

    public native StringBuilder append(int i);

    public native StringBuilder append(long l);

    public native StringBuilder append(char c);

    public native StringBuilder append(boolean b);

    public native StringBuilder append(Object o);

    public native String toString();
}
