// 书第2章：Classpath —— bootClasspath（JDK 桩类）+ userClasspath（用户类）
import { newEntry } from './entry.js';

export class Classpath {
  constructor(userCpOption, bootCpOption = 'build/jdk') {
    this.bootClasspath = newEntry(bootCpOption);
    this.userClasspath = newEntry(userCpOption || '.');
  }

  // className 是内名形式，如 "java/lang/Object"、"day8/HelloWorld"
  readClass(className) {
    // 先搜 bootClasspath（java.* 等），再搜 userClasspath
    let { data } = this.bootClasspath.readClass(className);
    if (data) return data;
    ({ data } = this.userClasspath.readClass(className));
    if (data) return data;
    throw new Error(`ClassNotFoundException: ${className}`);
  }
}
