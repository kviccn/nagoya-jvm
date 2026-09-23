// 书第9章基础设施（day6 先建注册表，day8 填充实现）—— native 方法注册表
// key 形式: "java/lang/System~arraycopy~(Ljava/lang/Object;ILjava/lang/Object;II)V"
const registry = new Map();

export function registerNative(key, impl) {
  registry.set(key, impl);
}

export function findNativeMethod(key) {
  return registry.get(key);
}
