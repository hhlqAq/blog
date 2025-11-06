# 针对vue项目的xss防护 

# 一、Vue 内置的 XSS 防护机制
Vue 核心已经对 插值渲染 做了安全处理，这是基础防护，需明确其适用场景和局限性：
-  1.文本插值 `{{ }}`：自动转义 HTM,适用场景：纯文本渲染（如用户名、评论内容、普通文案）
```vue
<!-- 安全：用户输入的 <script>alert('xss')</script> 会被转义为文本显示 -->
<div>{{ userInput }}</div>
```
- 2.内置指令的安全限制
  - v-bind 绑定属性时：Vue 会自动转义属性值中的特殊字符（如 href、src 中的 javascript: 伪协议），避免属性注入。
  - v-html：危险指令！会直接将数据渲染为 HTML，完全跳过转义，是 `XSS 高危点`
```vue
<!-- 安全：即使 userUrl 是 "javascript:alert('xss')"，也会被转义为无效链接 -->
<a :href="userUrl">链接</a>
```
# 二、核心防护手段
## 场景 1：必须使用 v-html 渲染 HTML（如富文本）
使用专业 HTML 过滤库（推荐 DOMPurify），全局注册过滤函数
```js
import Vue from 'vue'; // Vue 2
// import { createApp } from 'vue'; // Vue 3
import DOMPurify from 'dompurify';

// 注册全局过滤器：净化 HTML
Vue.filter('sanitizeHtml', (html) => {
  if (!html) return '';
  // 自定义过滤规则：仅允许 <p>、<br>、<strong> 等安全标签，禁用 script、iframe 等
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'img', 'a'], // 白名单标签
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title'], // 白名单属性
    // 额外限制：a 标签仅允许 http/https 协议
    ADD_ATTR: ['target'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
    // 过滤 img 标签的 src 为非 http/https 链接
    hooks: {
      beforeSanitizeAttributes: (node) => {
        if (node.tagName === 'A' && node.hasAttribute('href')) {
          const href = node.getAttribute('href');
          if (!/^https?:\/\//.test(href)) {
            node.setAttribute('href', '#'); // 无效链接替换
          }
        }
        if (node.tagName === 'IMG' && node.hasAttribute('src')) {
          const src = node.getAttribute('src');
          if (!/^https?:\/\//.test(src)) {
            node.removeAttribute('src'); // 移除危险图片链接
          }
        }
      }
    }
  });
});

// Vue 3 需挂载到 app 上
// const app = createApp(App);
// app.config.globalProperties.$sanitizeHtml = (html) => DOMPurify.sanitize(html);
```
```vue
<!-- 先通过过滤器净化，再用 v-html 渲染 -->
<div v-html="userRichText | sanitizeHtml"></div>
```
##  场景 2：用户输入内容绑定到 DOM 属性（非 href/src）
虽然 v-bind 会转义部分特殊字符，但对于 自定义属性 或 特殊场景（如 style），仍需额外防护

举例：
```vue
<!-- 危险：用户输入 `background: url(javascript:alert('xss'))` 可能触发攻击 -->
<div :style="userStyle"></div>
```
防护方案：
- 禁止直接绑定用户输入到 style：若需动态样式，通过预设变量控制（而非用户自由输入）
- 属性值校验：若必须绑定，对输入内容做正则过滤，只保留允许的格式（如颜色、尺寸）

## 场景 3：URL 参数 / 本地存储（localStorage/sessionStorage）
用户输入的内容可能通过 URL 参数（query/hash）或本地存储传递，若直接渲染这些数据，可能触发 XSS
```js
// 危险：直接获取 URL 参数并渲染
this.userName = this.$route.query.name; // 若参数为 <script>alert('xss')</script>
```
```vue
<!-- 若用 v-html 渲染，直接触发 XSS -->
<div v-html="userName"></div>
```
防护方案：
 - URL 参数净化：获取参数后，用 DOMPurify 或简单转义处理：
 - 本地存储数据过滤：存入本地存储前过滤，取出后再次过滤（避免存储已被篡改的恶意内容）
# 三、工程化防护：从构建 / 部署层面减少风险
## 1.启用 CSP（内容安全策略）
```nginx
# Nginx 配置示例（在 nginx.conf 中添加）
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' https://*.example.com; object-src 'none'; base-uri 'self';";
```
关键指令说明：
- default-src 'self'：默认只允许加载当前域名的资源；
- script-src 'self'：只允许执行当前域名的脚本（禁止 inline-script 和 eval，这是 XSS 常用载体）；
- img-src 'self' https://*.example.com：只允许加载当前域名和指定域名的图片；
- object-src 'none'：禁止加载插件（如 Flash），避免插件漏洞。
