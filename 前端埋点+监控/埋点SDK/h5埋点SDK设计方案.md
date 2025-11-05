前端 H5 埋点 SDK 设计方案
# 一、方案概述
## 设计目标
- 轻量无侵入：SDK 体积控制在 5KB 以内（gzip 后），不干扰业务代码逻辑，接入成本低。
- 高可靠性：支持离线缓存、失败重试、流量控制，确保埋点数据不丢失。
- 灵活可扩展：支持自定义事件、自定义属性，适配不同业务场景的埋点需求。
- 性能友好：异步发送请求、批量上报，避免阻塞页面渲染和交互。
- 易用性：提供简洁的 API，支持自动埋点 + 手动埋点结合，降低接入和使用成本。
## 核心功能
- 自动埋点：页面曝光（PV/UV）、元素点击、页面离开、错误捕获。
- 手动埋点：自定义事件上报、自定义属性扩展。
- 数据处理：数据格式化、字段补全、敏感信息过滤。
- 传输策略：批量上报、离线缓存、失败重试、域名配置。
- 配置能力：开关控制、采样率设置、上报频率调整。
# 二、架构设计
## 1. 整体架构分层
SDK 采用分层设计，自上而下分为「API 层」「核心层」「传输层」「存储层」「工具层」，各层职责单一，便于维护和扩展：
|分层|核心职责|
|--|--|
|API 层|对外提供简洁接口（如 track「手动事件」、init「初始化」、setUserInfo「用户信息」）|
|核心层|事件调度、数据格式化、自动埋点逻辑、配置管理、采样控制|
|传输层|批量上报、失败重试、请求发送、流量控制、跨域处理|
|存储层|离线缓存（localStorage）、临时队列（内存）、用户标识存储|
|工具层|设备信息获取、URL 解析、时间格式化、敏感信息过滤、兼容性处理|
## 2. 核心流程
初始化配置 → 监听事件（自动/手动）→ 收集原始数据 → 数据格式化补全 → 加入发送队列 → 满足条件上报（批量/定时）→ 失败缓存重试
# 三、详细设计
## 1. 初始化配置（init 方法）
SDK 需通过 init 方法初始化，支持灵活配置，默认值适配通用场景：
```js
// 初始化示例
TrackingData.init({
  appId: "your-app-id", // 必传，应用唯一标识
  reportUrl: "https://api.xxx.com/tracking-point", // 必传，上报接口地址
  autoTrack: { // 自动埋点开关，默认开启核心事件
    pv: true, // 页面PV上报
    click: true, // 元素点击上报
    pageLeave: true, // 页面离开上报
    error: true // 错误捕获上报
  },
  sampleRate: 100, // 采样率（0-100），默认100%全量上报
  batchSize: 10, // 批量上报阈值，默认10条/次
  reportInterval: 3000, // 定时上报间隔（ms），默认3s
  cacheLimit: 100, // 离线缓存上限，默认100条（超出丢弃最旧数据）
  debug: false, // 调试模式，默认关闭（开启后打印日志）
  filterSensitiveKeys: ["password", "cardNo"], // 敏感字段过滤，默认过滤常见敏感词
  customProps: { // 全局自定义属性（所有事件都会携带）
    platform: "h5",
    appVersion: "1.0.0"
  }
});
```
## 2. 数据模型设计
所有埋点事件统一数据格式，确保后端解析一致性，核心字段如下（扩展字段通过 customProps 补充）

|字段名|类型|说明|来源|
|--|--|--|--|
|eventId|string|事件唯一标识（自动事件：pv/click/pageLeave/error；手动事件：自定义）|接口传入 / 自动生成|
|appId|string|应用 ID|初始化配置|
|userId|string|用户唯一标识（登录后设置）|setUserInfo 接口|
|deviceId|string|设备唯一标识（浏览器指纹）|工具层生成|
|sessionId|string|会话 ID（页面打开时生成，有效期 30 分钟）|工具层生成|
|timestamp|number|事件发生时间戳（ms）|事件触发时获取|
|pageUrl|string|事件发生页面 URL|工具层获取|
|pageTitle|string|页面标题|工具层获取|
|referrer|string|来源页面 URL|工具层获取|
|userAgent|string|浏览器 UA|工具层获取|
|screenSize|string|屏幕分辨率（如 1920x1080）|工具层获取|
|networkType|string|网络类型（wifi/4g/5g/unknown）|工具层获取|
|customProps|object|自定义属性（全局 + 事件级）|初始化配置 / 接口传入|
// 自动事件扩展字段 //			
|targetText|string|点击事件：目标元素文本|点击事件触发时获取|
|targetSelector|string|点击事件：目标元素选择器（如.btn-submit）|点击事件触发时获取|
|errorMsg|string|错误事件：错误信息|错误捕获时获取|
|errorStack|string|错误事件：错误堆栈|错误捕获时获取|
|errorUrl|string|错误事件：错误发生文件 URL|错误捕获时获取|
|errorLine|number	|错误事件：错误行号	|错误捕获时获取|
## 3. 核心功能实现
### （1）自动埋点
- PV 上报：监听 DOMContentLoaded 事件（页面加载完成），触发 PV 事件；支持单页应用（SPA）路由变化监听（监听 hashchange/popstate 事件，或适配 Vue Router/React Router）。
- 元素点击上报：通过事件委托监听 document 点击事件，过滤非交互元素（如 script/style），获取目标元素的文本、选择器等信息，触发 click 事件。
- 页面离开上报：监听 beforeunload 事件，触发 pageLeave 事件（通过 navigator.sendBeacon 发送，确保页面卸载时数据不丢失）。
- 错误捕获：
  - 监听 window.onerror 捕获 JS 运行时错误。
  - 监听 window.unhandledrejection 捕获未处理的 Promise 错误。
  - 过滤脚本加载错误（如跨域脚本 script error），通过 crossorigin 属性优化。
### （2）手动埋点
提供简洁 API 支持业务自定义事件上报：
```js
// 1. 基础自定义事件
TrackingData.track("pay_success", {
  orderId: "123456",
  amount: 99.9,
  payType: "wechat"
});

// 2. 设置用户信息（登录后调用，用户ID会携带到所有后续事件）
TrackingData.setUserInfo({
  userId: "user_123",
  userName: "张三",
  phone: "138****1234" // 敏感字段会被自动过滤
});

// 3. 追加全局自定义属性（后续所有事件都会携带）
TrackingData.setGlobalProps({
  channel: "applet",
  version: "2.1.0"
});
```
### （3）数据处理
- 字段补全：自动填充 deviceId「设备 ID」、sessionId「会话 ID」、timestamp「时间戳」等公共字段。
- 敏感信息过滤：对 customProps「自定义属性」和 userInfo「用户信息」中的敏感字段（如密码、手机号、身份证号）进行脱敏处理（替换为 ***）。
- 采样控制：根据 sampleRate「采样率」随机过滤部分事件（如采样率 50% 时，仅 50% 的事件会被上报），降低服务器压力。
### （4）传输策略
- 批量上报：事件加入内存队列，当队列长度达到 batchSize「批量阈值」时，触发上报。
- 定时上报：即使队列未达阈值，每隔 reportInterval「定时间隔」也会触发上报，避免数据长期滞留。
- 离线缓存：当网络不可用（通过 navigator.onLine 判断）时，将事件存入 localStorage，待网络恢复后自动读取并上报；缓存数量超过 cacheLimit「缓存上限」时，丢弃最旧数据。
- 失败重试：上报请求失败时（HTTP 状态码非 2xx），将事件重新加入队列，下次上报时重试；重试 3 次失败后，存入离线缓存。
- 请求优化：
  - 使用 fetch API 发送请求（降级兼容 XMLHttpRequest），配置 keepalive: true 确保页面卸载时请求能正常发送。
  - 上报接口支持 POST 方法，数据格式为 JSON；设置 Content-Type: application/json。
  - 跨域场景下，确保后端接口支持 CORS（返回 Access-Control-Allow-Origin 等响应头）。
### （5）设备标识生成（deviceId）
通过浏览器指纹生成唯一、稳定的设备标识，避免用户清除缓存后标识变更：
```js
// 简化逻辑（实际需结合更多特征）
function generateDeviceId() {
  const key = "tracking_data_device_id";
  // 优先从localStorage读取
  const storedId = localStorage.getItem(key);
  if (storedId) return storedId;
  // 生成指纹：结合userAgent、屏幕分辨率、时区等特征
  const fingerprint = [
    navigator.userAgent,
    screen.width + "x" + screen.height,
    new Date().getTimezoneOffset(),
    navigator.language
  ].join("_");
  // 简单哈希（实际可用MD5，需引入轻量哈希库）
  const deviceId = btoa(fingerprint).replace(/[+/=]/g, "");
  localStorage.setItem(key, deviceId);
  return deviceId;
}
```
## 4. 兼容性处理
- 浏览器兼容：支持 IE11+ 及所有现代浏览器（Chrome/Firefox/Safari/Edge）。
- 降级策略：
  - IE11 不支持 fetch，降级为 XMLHttpRequest。
  - 不支持 localStorage 时，关闭离线缓存，仅内存队列上报。
  - 不支持 navigator.sendBeacon 时，页面离开上报降级为普通异步请求。
- 单页应用适配：支持 Vue/React/Angular 等 SPA 框架，通过监听路由变化触发 PV 上报：
```js
// Vue Router 示例
import router from "./router";
router.afterEach((to, from) => {
  TrackingData.track("page_view", {
    pagePath: to.path,
    referrer: from.path
  });
});
```
##  5. 调试与监控
- 调试模式：debug: true 时，控制台打印上报日志（事件数据、请求状态、缓存情况）。
- 自检机制：初始化时检查 appId「应用 ID」、reportUrl「上报地址」等必填配置，缺失时抛出警告。
- 上报状态回调：支持配置 onReportSuccess「上报成功回调」、onReportFail「上报失败回调」，便于业务监控埋点状态。
# 四、接入流程
## 1. 引入SDK 
- 方式 1：直接引入脚本
```js
<script src="https://cdn.xxx.com/tracking-data-sdk/1.0.0/tracking-data.min.js"></script>
```
- 方式 2：npm 引入（适合工程化项目）
```bash
npm install tracking-data-sdk
```
```js
import TrackingData from "tracking-data-sdk";
```
## 2. 初始化配置
```js
// 页面加载后初始化
window.onload = function() {
  TrackingData.init({
    appId: "your-app-id",
    reportUrl: "https://api.xxx.com/bury-point",
    debug: process.env.NODE_ENV === "development" // 开发环境开启调试
  });
};
```
## 3. 业务埋点
```js
// 1. 登录后设置用户信息
function loginSuccess(userInfo) {
  TrackingData.setUserInfo({
    userId: userInfo.id,
    userName: userInfo.name
  });
}

// 2. 自定义事件上报（如支付成功）
function paySuccess(orderInfo) {
  TrackingData.track("pay_success", {
    orderId: orderInfo.id,
    amount: orderInfo.amount,
    payType: orderInfo.payType
  });
}

// 3. SPA 路由适配（Vue示例）
import router from "./router";
router.afterEach((to, from) => {
  TrackingData.track("pv", {
    pagePath: to.path,
    fromPath: from.path
  });
});
```
# 五、性能优化
- 体积优化：
   - 剔除冗余代码，仅保留核心功能。
   - 使用 Tree-Shaking 移除未使用的模块。
   - 压缩代码（Terser）+ gzip 传输。
- 运行时优化：
   - 事件监听使用事件委托，避免大量元素绑定事件。
   - 上报请求使用异步非阻塞方式，不影响页面渲染。
   - 批量上报减少 HTTP 请求次数，降低网络开销。
   - 离线缓存使用 localStorage，避免频繁读写。
- 资源占用优化:
   - 内存队列定期清空，避免内存泄漏。
   - 离线缓存设置上限，避免占用过多本地存储。
# 六、扩展能力
- 插件机制：支持通过插件扩展功能（如埋点加密、自定义传输协议）。
- 多环境配置：支持区分开发 / 测试 / 生产环境，配置不同的上报地址和采样率。
- 自定义存储：支持替换默认存储方案（如使用 IndexedDB 替代 localStorage）。
- 事件过滤：支持配置事件过滤规则，忽略不需要上报的事件（如特定元素的点击）。
# 七、风险与防护
## 1.数据安全：
- 敏感信息自动脱敏，避免用户隐私泄露。
- 上报接口建议使用 HTTPS，防止数据传输过程中被篡改。
## 2.性能风险：
- 采样率控制，避免高流量场景下埋点上报占用过多带宽和服务器资源。
- 限制离线缓存数量，避免本地存储溢出。
## 3.兼容性风险：
- 对低版本浏览器进行降级处理，确保核心功能可用。
- 避免使用实验性 API，降低兼容性风险。