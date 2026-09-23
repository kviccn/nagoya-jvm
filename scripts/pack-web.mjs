// 构建期脚本：把编译好的 class 文件打包成浏览器可用的 ESM bundle
//
// 【为什么需要它】
// 浏览器没有文件系统，而 VM 的 ClassLoader 是同步设计。解法：构建期把
// build/classes（测试类）+ build/jdk（桩 JDK 类）全部 class 打成 base64 的
// Map<类内名, base64>，web 端用一个"查表式假 Classpath"同步喂给 ClassLoader。
//
// 用法：node scripts/pack-web.mjs   （需先执行 bash scripts/build.sh）
// 产物：docs/.vitepress/vm/classes-bundle.js（被 .gitignore 忽略，CI 中重新生成）
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'docs/.vitepress/vm');
const OUT_FILE = join(OUT_DIR, 'classes-bundle.js');

// 递归收集目录下全部 .class 文件：{ 类内名: 绝对路径 }
function collectClasses(dir) {
  const result = {};
  function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.class')) {
        // 相对路径转类内名：day4/GaussTest.class → day4/GaussTest
        const className = relative(dir, p).replaceAll('\\', '/').replace(/\.class$/, '');
        result[className] = p;
      }
    }
  }
  walk(dir);
  return result;
}

const bundle = {
  ...collectClasses(join(ROOT, 'build/jdk')),
  ...collectClasses(join(ROOT, 'build/classes')),
};

const entries = Object.entries(bundle)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, path]) => `  '${name}': '${readFileSync(path).toString('base64')}',`)
  .join('\n');

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_FILE,
  `// 【自动生成，请勿手改】由 scripts/pack-web.mjs 生成\n` +
  `// 共 ${Object.keys(bundle).length} 个类（含桩 JDK）\n` +
  `export const CLASS_BUNDLE = {\n${entries}\n};\n`,
);

console.log(`已打包 ${Object.keys(bundle).length} 个类 → ${OUT_FILE}`);
