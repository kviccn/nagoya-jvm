#!/usr/bin/env bash
# 构建脚本：
# 1) 编译迷你 JDK 桩类（--patch-module 绕过模块系统的 java.base 包冲突）
# 2) 编译测试类（-XDstringConcat=inline 让字符串拼接走 StringBuilder 而非 invokedynamic）
set -e
cd "$(dirname "$0")/.."

echo "== 编译 JDK 桩类 =="
mkdir -p build/jdk
JDK_SOURCES=$(find jdk -name '*.java')
javac -encoding UTF-8 --patch-module java.base=jdk -d build/jdk $JDK_SOURCES

echo "== 编译测试类 =="
mkdir -p build/classes
find java -name '*.java' | while read -r f; do
  javac -encoding UTF-8 -XDstringConcat=inline -g -d build/classes "$f"
done
echo "== 完成 =="
