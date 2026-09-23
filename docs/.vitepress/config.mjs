// VitePress 站点配置
import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  title: 'nagoya-jvm',
  description: '用 Node.js 自己动手写 Java 虚拟机——逐章实现 + 浏览器可视化解释器',
  // 【注意】部署到 GitHub Pages 的项目页（user.github.io/<repo>/），
  // base 必须是仓库名子路径，否则静态资源 404
  base: '/nagoya-jvm/',

  vite: {
    resolve: {
      alias: {
        // 让 docs 里的组件能直接 import 仓库根下的 VM 内核源码（src/dayN/...）
        '@vm': fileURLToPath(new URL('../../src', import.meta.url)),
      },
    },
    server: {
      // 允许 dev server 访问 docs/ 之外的仓库文件（@vm alias 目标）
      fs: { allow: ['../..'] },
    },
  },

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '教程', link: '/guide/day1' },
      { text: '在线解释器', link: '/playground' },
      { text: 'GitHub', link: 'https://github.com/kviccn/nagoya-jvm' },
    ],

    // 页面底部版权信息（文档页与首页统一显示）
    footer: {
      message: '基于 <a href="https://github.com/kviccn/nagoya-jvm/blob/main/LICENSE" target="_blank">MIT 协议</a>发布',
      copyright: 'Copyright © 2026-present <a href="https://github.com/kviccn" target="_blank">kviccn</a> · nagoya-jvm',
    },
    sidebar: [
      {
        text: '准备工作',
        items: [
          { text: '环境与构建', link: '/guide/setup' },
        ],
      },
      {
        text: '逐章实现',
        items: [
          { text: 'day1 命令行与类路径', link: '/guide/day1' },
          { text: 'day2 解析 class 文件', link: '/guide/day2' },
          { text: 'day3 运行时数据区', link: '/guide/day3' },
          { text: 'day4 指令集与解释器', link: '/guide/day4' },
          { text: 'day5 类和对象', link: '/guide/day5' },
          { text: 'day6 方法调用', link: '/guide/day6' },
          { text: 'day7 数组和字符串', link: '/guide/day7' },
          { text: 'day8 native 方法', link: '/guide/day8' },
          { text: 'day9 异常处理', link: '/guide/day9' },
          { text: 'day10 完整 JVM', link: '/guide/day10' },
        ],
      },
      {
        text: '动手试试',
        items: [
          { text: '🎮 在线解释器', link: '/playground' },
        ],
      },
    ],
    outline: { level: [2, 3], label: '本页目录' },
  },
});
