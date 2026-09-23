// 自定义主题：在默认主题基础上注册全局组件
import DefaultTheme from 'vitepress/theme';
import JvmVisualizer from '../components/JvmVisualizer.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 注册后，任何 .md 页面都可以直接写 <JvmVisualizer />
    app.component('JvmVisualizer', JvmVisualizer);
  },
};
