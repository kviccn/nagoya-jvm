// 自定义主题：在默认主题基础上注册全局组件
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import JvmVisualizer from '../components/JvmVisualizer.vue';
import GiscusComment from '../components/GiscusComment.vue';

export default {
  extends: DefaultTheme,
  // 在每篇文档正文之后挂载 Giscus 评论区
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'doc-after': () => h(GiscusComment),
    });
  },
  enhanceApp({ app }) {
    // 注册后，任何 .md 页面都可以直接写 <JvmVisualizer />
    app.component('JvmVisualizer', JvmVisualizer);
  },
};
