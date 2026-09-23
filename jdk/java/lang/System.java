package java.lang;

import java.io.PrintStream;

// 迷你 JDK 桩：System。out 由 VM 启动时直接注入（见 day8 native/systemInit.js）
public class System {
    public static PrintStream out;

    public static native void arraycopy(Object src, int srcPos, Object dest, int destPos, int length);

    public static native long currentTimeMillis();
}
