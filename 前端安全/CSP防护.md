# 前端 CSP（内容安全策略）防护方案 + 具体配置
CSP（Content Security Policy）核心是通过 白名单机制 限制页面可加载的资源（脚本、样式、图片等），阻断 XSS、恶意脚本注入等攻击，以下是可直接落地的完整方案，包含配置示例、适配场景和避坑指南。
# 一、CSP 核心防护目标
- 禁止加载未授权域名的脚本（阻断 存储型 、 反射型 XSS）
- 禁止内联脚本（`<script> `标签、onclick/onload 事件、javascript: 伪协议）
- 禁止未授权的资源（图片、样式、字体、AJAX 请求）加载
- 限制 eval()、new Function() 等危险函数（防止动态执行恶意代码）
# 二、CSP 配置方式
HTTP 响应头配置

由后端在响应头中返回 Content-Security-Policy（强制生效）或 Content-Security-Policy-Report-Only

# 三、通用场景 CSP 具体配置
## 场景 1：常规 Web 应用（最常用，平衡安全与兼容性）
适合大多数不含复杂内联脚本、资源来自已知域名的应用，推荐 HTTP 响应头配置
```nginx
# 强制生效（生产环境用）
Content-Security-Policy: default-src 'self'; script-src 'self' https://xxx.com https://yyy.com 'nonce-随机字符串' 'strict-dynamic'; style-src 'self' 'unsafe-inline' https://xxx.com https://yyy.com; img-src 'self' data: https://*.png.com https://*.jpg.com; connect-src 'self' https://api.xxx.com; font-src 'self' https://xxx.com; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; report-uri /api/csp-report;

# 测试环境（仅上报不拦截，收集违规日志）
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' https://xxx.com 'nonce-随机字符串' 'strict-dynamic'; ......
```
## 场景 2：纯静态页面（无后端 API，仅加载自身资源）
```nginx
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self';
```
## 场景 3：需要内联脚本
不推荐直接开 unsafe-inline，优先用 nonce 或 hash 授权合法内联脚本：
```nginx
# 方式 1：nonce 授权（推荐，动态生成随机串，每次请求不同）
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-66e5286a-596b-490d-831a-85495005d207' 'strict-dynamic'; 

# 方式 2：hash 授权（内联脚本内容固定时用，计算脚本的 SHA-256 哈希）
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-abc123xyz...' 'strict-dynamic';
```
# 四、配置指令详解
| 指令 | 作用 | 常用值示例 | 安全说明 |
| --- | --- | --- | --- |
| default-src	|所有资源的默认白名单（未单独配置时生效）	|'self'（自身域名）、'none'（禁止所有）	|优先设为 'self'，最小权限原则 |
| script-src	|脚本（`<script>`、AJAX 动态加载脚本）	|'self'、CDN 域名、'nonce-xxx'、'strict-dynamic'	|禁止 'unsafe-inline'（内联脚本）、'unsafe-eval'（危险函数） |
| style-src	|样式（`<style>`、link 样式）	|'self'、CDN 域名、'unsafe-inline'	|兼容老项目可开 'unsafe-inline'（样式风险低于脚本） |
| img-src	|图片（`<img>`、背景图）	|'self'、data:（Base64 图片）、图片 CDN	|限制图片域名，防止恶意图片注入 |
| connect-src	|AJAX/fetch、WebSocket、EventSource	|'self'、后端 API 域名（https://api.xxx.com）	|阻断跨域恶意请求 |
| font-src	|字体文件（@font-face）	|'self'、字体 CDN	|避免加载恶意字体文件 |
| object-src	|插件（`<object>`、`<embed>`、`<applet>`）	|'none'（几乎不用插件，直接禁用）	|防止恶意插件执行 |
| frame-src	|嵌套页面（`<iframe>`）	|'none' 或信任的域名（如微信登录 iframe）	|禁止嵌套未知页面，防止点击劫持 |
| base-uri	|限制 `<base>` 标签的 href	|'self' 或禁止（'none'）	|防止篡改页面基准 URL |
| form-action	|限制 `<form>` 表单提交的目标地址	|'self'、后端接口域名	|防止表单提交到恶意域名 |
| upgrade-insecure-requests	|自动将 HTTP 资源升级为 HTTPS	|-	|兼容老项目的 HTTP 资源，避免混合内容警告 |
| report-uri	|违规行为上报接口	|/api/csp-report（后端接收日志的接口）	|生产环境必开，用于监控攻击尝试 |
# 五、关键配置细节（避坑核心）
## 1. 如何安全授权内联脚本
### 方式 1：nonce 授权（动态随机串，推荐）
- 后端每次返回页面时，生成随机 nonce（如 UUID），同时在 CSP 头和内联脚本中添加

```nginx
# 后端响应头
Content-Security-Policy: script-src 'self' 'nonce-66e5286a-596b-490d-831a-85495005d207';
```
```html
<!-- 前端内联脚本（需带 nonce 属性，与响应头一致） -->
<script nonce="66e5286a-596b-490d-831a-85495005d207">
  console.log("合法内联脚本，仅当前请求有效");
</script>
```
### 方式 2：hash 授权（内联脚本内容固定时）
- 计算内联脚本的 SHA-256 哈希（工具：https://report-uri.com/home/hash），示例：
  - 内联脚本：console.log('test')
  - 哈希结果：sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=
  - CSP 配置：script-src 'self' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
## 2. 兼容第三方脚本（如百度统计、支付 SDK）
将第三方域名加入对应指令的白名单，避免直接配置 *
```nginx
# 允许百度统计脚本和支付 SDK 脚本
script-src 'self' https://hm.baidu.com https://pay.xxx.com;
# 允许第三方图片（如微信头像）
img-src 'self' https://thirdwx.qlogo.cn;
```
# 六、后端具体配置示例
## 1. Nginx 配置（推荐，全局生效）
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 生产环境：强制生效 CSP
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://xxx.com 'nonce-$request_id' 'strict-dynamic'; style-src 'self' 'unsafe-inline' https://xxx.com; img-src 'self' data: https://*.qlogo.cn; connect-src 'self' https://api.your-domain.com; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; report-uri /api/csp-report;" always;

    # 测试环境：仅上报不拦截（替换上面的 add_header）
    # add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' https://xxx.com; ..." always;

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
```
## 2. Node.js（Express/Koa）配置
```js
const express = require('express');
const app = express();
const { v4: uuidv4 } = require('uuid'); // 需安装：npm install uuid

// 全局 CSP 中间件
app.use((req, res, next) => {
  const nonce = uuidv4(); // 生成随机 nonce
  // 设置 CSP 响应头
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' https://xxx.com 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline' https://xxx.com; img-src 'self' data:; connect-src 'self' https://api.your-domain.com; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; report-uri /api/csp-report;`
  );
  // 将 nonce 传递给模板（如 EJS/Vue）
  res.locals.nonce = nonce;
  next();
});

// CSP 违规上报接口（保存日志到数据库）
app.post('/api/csp-report', express.json(), (req, res) => {
  const cspReport = req.body['csp-report'];
  console.log('CSP 违规日志：', cspReport);
  // 可将日志写入数据库（如 MongoDB），用于后续分析
  res.sendStatus(204); // 上报成功返回 204 No Content
});

app.listen(3000);
```
# 七、测试与排错流程
- 先测试后上线：先用 Content-Security-Policy-Report-Only 配置，观察上报日志（/api/csp-report），修复所有违规项
- 常见报错及解决
  - 报错：Refused to load the script 'xxx' because it violates the following Content Security Policy directive: "script-src 'self'" → 把 xxx 域名加入 script-src。
  - 报错：Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'self'" → 用 nonce 或 hash 授权该内联脚本。
  - 报错：Refused to load the image 'data:image/png;base64,...' → 把 data: 加入 img-src 白名单
- 浏览器调试：Chrome 开发者工具 → Security 面板 → View Certificate 下方查看 CSP 配置是否生效，Console 面板查看具体违规信息。