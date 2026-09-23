// 书第2章：类路径 Entry —— 目录项 / 组合项 / 通配符项
// （真实 JVM 还支持 zip/jar，本实现只支持解压后的目录，JDK 类用我们自己写的桩类）
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PATH_SEPARATOR = ';';

export function newEntry(path) {
  if (path.includes(PATH_SEPARATOR)) {
    return new CompositeEntry(path);
  }
  if (path.endsWith('*')) {
    return new WildcardEntry(path);
  }
  return new DirEntry(path);
}

class DirEntry {
  constructor(absDir) {
    this.absDir = absDir;
  }
  readClass(className) {
    const file = join(this.absDir, className + '.class');
    if (!existsSync(file)) return { data: null, entry: this };
    return { data: readFileSync(file), entry: this };
  }
  toString() {
    return this.absDir;
  }
}

class CompositeEntry {
  constructor(pathList) {
    this.entries = pathList.split(PATH_SEPARATOR).map(newEntry);
  }
  readClass(className) {
    for (const entry of this.entries) {
      const { data, entry } = entry.readClass(className);
      if (data) return { data, entry };
    }
    return { data: null, entry: this };
  }
  toString() {
    return this.entries.map(String).join(PATH_SEPARATOR);
  }
}

// 通配符：foo/* —— 只展开其中的子目录（jar 不支持，学习用目录即可）
class WildcardEntry {
  constructor(path) {
    const baseDir = path.slice(0, -1); // 去掉末尾 *
    const entries = [];
    if (existsSync(baseDir)) {
      for (const name of readdirSync(baseDir)) {
        const sub = join(baseDir, name);
        if (statSync(sub).isDirectory()) entries.push(new DirEntry(sub));
        // .jar/.zip 省略：我们把 JDK 桩类编译成目录形式
      }
    }
    this.composite = new CompositeEntry('');
    this.composite.entries = entries;
  }
  readClass(className) {
    return this.composite.readClass(className);
  }
  toString() {
    return this.composite.toString();
  }
}
