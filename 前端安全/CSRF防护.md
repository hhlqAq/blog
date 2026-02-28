# 一、CSRF 攻击的本质

- 攻击原理：攻击者诱导用户在已登录目标网站的情况下，访问攻击者控制的恶意页面，利用用户的登录态（Cookie/Session）向目标网站发起非用户本意的请求。
- 核心漏洞：HTTP 请求的「身份认证信息（Cookie）」与「操作意愿」分离 —— 服务器只验证请求是否携带合法的登录态，但无法验证请求是否是用户主动发起的。
- 典型场景：用户登录银行网站后，点击恶意链接，该链接自动发起转账请求（携带用户的银行 Cookie），银行服务器验证 Cookie 合法后执行转账。

# 二、CSRF Token 实现机制

CSRF Token 的核心思路是：给每个用户会话绑定一个随机、唯一、不可预测的 Token，服务器不仅验证登录态，还验证该 Token，只有 Token 合法的请求才被处理。

## 步骤 1：Token 生成（核心要求：随机性 + 唯一性）

- 生成规则
  - 基于加密安全的随机数生成器（如 Node.js 中的 crypto.randomBytes()、Java 的 SecureRandom），避免使用 Math.random() 等弱随机函数（可预测）。
  - Token 长度至少 16 字节（128 位），通常 32 字节（256 位），如 crypto.randomBytes(32).toString('hex')。
- 生成时机
  - 用户会话创建时（登录 / 首次访问）生成初始 Token；
  - 每次敏感请求后（如提交表单）刷新 Token（防止复用）；
  - 短期有效期（如 1 小时），超时自动失效。

## 步骤 2：Token 存储（核心要求：防窃取 + 与用户绑定）

Token 必须存储在「攻击者无法直接获取」且「能与用户会话绑定」的位置，常见方案对比

|存储位置|实现方式|优点|风险点|生产建议|
|--|--|--|--|--|
|Cookie（推荐）|存储在 Secure Cookie 中|自动携带、与用户绑定|需配置 SameSite=Strict|生产首选|
|Session|服务端存储，关联用户 ID|完全可控|服务端开销大|分布式场景慎用|
|前端存储（LocalStorage）|前端存储 Token|前后端分离适配|XSS 攻击易窃取|仅无 Cookie 时用|

## 步骤 3：Token 传递（核心要求：请求中携带 + 与登录态分离）

Token 必须通过「攻击者无法伪造的方式」随请求传递，且不能与登录态（Cookie）同渠道传递

- AJAX 请求：请求头 X-CSRF-Token: xxx（与 Cookie 分离，非同源网站无法读取cookie内容，不能自动添加到请求header中）；

## 步骤 4：Token 验证（核心要求：全链路校验）

- 服务器接收到请求后，执行严格校验：
  - 存在性校验：非安全请求（GET/HEAD/OPTIONS 除外）必须携带 Token，无 Token 直接拒绝；
  - 一致性校验：对比请求中的 Token 与服务器存储的 Token（Cookie/Session 中），不一致则拒绝；
  - 时效性校验：检查 Token 是否超时，超时则拒绝并刷新 Token；
  - 使用后失效：敏感请求验证通过后，立即刷新 Token（防止重复使用）。

# 三、安全防护的核心手段

## 1. Token 层面的强化防护

- 必须使用加密安全的随机数生成器
- Token 绑定用户 / IP：将 Token 与用户 ID、客户端 IP 绑定，非绑定 IP 请求直接拒绝（防止 Token 泄露后跨 IP 使用）；
- 防重放攻击：记录近期使用过的 Token，拒绝重复使用（可结合 Redis 实现）

## 2. Cookie 安全配置

Cookie 是 Token 存储的核心载体，需配置以下参数：

- HttpOnly: true：禁止前端 JS 读取 Cookie（防 XSS 窃取 Token）；
- Secure: true：仅在 HTTPS 下传输 Cookie（防中间人劫持）；
- SameSite: Strict/Lax：
  - Strict：仅同源请求携带 Cookie（完全禁止跨站请求）；
  - Lax：允许部分安全的跨站请求（如链接跳转），生产推荐；
- Max-Age：设置合理有效期（如 3600 秒），避免永久有效；
- Path=/：限制 Cookie 生效路径，仅核心业务路径可用。

## 3. 请求层面的防护

- 区分安全 / 非安全请求
  - 仅对「修改数据的请求」（POST/PUT/DELETE/PATCH）校验 Token；
  - GET/HEAD/OPTIONS 等「只读请求」不修改数据，无需校验（但需防止 GET 用于敏感操作）；
- 请求头校验：验证 Origin/Referer 头（兜底防护）：
  - Origin：必须是可信域名（如 https://your-domain.com）；
  - Referer：必须包含可信域名（防止跨站伪造）；
  - 部分场景（如原生 App）无 Referer，需预留白名单。

## 4. 结合其他安全机制

- XSS 防护：CSRF Token 易被 XSS 攻击窃取，需同时防护 XSS：
  - 输入过滤 / 输出转义（如 React/Vue 自动转义）；
  - 启用 CSP（内容安全策略），限制脚本执行；
