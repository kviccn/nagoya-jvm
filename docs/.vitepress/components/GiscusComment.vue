<script setup>
// Giscus 评论组件：基于 GitHub Discussions，随页面底部加载
import { computed, onMounted, ref, watch } from 'vue';
import { useData, useRoute } from 'vitepress';

const { isDark, frontmatter } = useData();
const route = useRoute();

// 在页面 frontmatter 里写 `comment: false` 可关闭该页评论
const enabled = computed(
  () => frontmatter.value.comment !== false && frontmatter.value.layout !== 'home',
);

const container = ref(null);
const currentTheme = () => (isDark.value ? 'dark' : 'light');

function mount() {
  if (!enabled.value || !container.value) return;
  // 清空旧内容，避免重复挂载
  container.value.innerHTML = '';
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  const attrs = {
    'data-repo': 'kviccn/nagoya-jvm',
    'data-repo-id': 'R_kgDOUneZxA',
    'data-category': 'General',
    'data-category-id': 'DIC_kwDOUneZxM4DGRGX',
    'data-mapping': 'pathname',
    'data-strict': '0',
    'data-reactions-enabled': '1',
    'data-emit-metadata': '0',
    'data-input-position': 'top',
    'data-theme': currentTheme(),
    'data-lang': 'zh-CN',
    'data-loading': 'lazy',
  };
  for (const [key, value] of Object.entries(attrs)) {
    script.setAttribute(key, value);
  }
  container.value.appendChild(script);
}

onMounted(mount);

// SPA 路由切换时重新加载评论
watch(() => route.path, mount);

// 跟随 VitePress 明暗主题切换
watch(isDark, () => {
  const iframe = document.querySelector('iframe.giscus-frame');
  iframe?.contentWindow?.postMessage(
    { giscus: { setConfig: { theme: currentTheme() } } },
    'https://giscus.app',
  );
});
</script>

<template>
  <div v-if="enabled" ref="container" class="giscus-wrapper" />
</template>

<style scoped>
.giscus-wrapper {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--vp-c-divider);
}
</style>
