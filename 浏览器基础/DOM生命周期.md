# DOM 生命周期

# 初始化阶段
## navigationStart（导航开始）
含义：作为浏览器性能计时的起始点，标记用户开始导航到当前页面的时间（如点击链接、输入 URL 回车、刷新页面等）。

特点：早于 DOM 的实际创建，是所有后续 DOM 相关时间节点的参考基准。

## domLoading（DOM 加载开始）
含义：浏览器开始解析 HTML 文档，构建 DOM 树的起始时间点。此时浏览器已接收 HTML 字节流，并开始将其转换为 DOM 节点。

关键行为：尚未完成 DOM 树构建，`<script>标签的加载和执行可能会阻塞该过程`。

# 构建与解析阶段
## domInteractive（DOM 交互就绪）
含义：浏览器完成 HTML 文档解析并构建出完整的 DOM 树，此时 DOM 结构已定型，但外部资源（如图片、样式表、非同步脚本）可能尚未加载完成。

核心特征：用户无法与页面交互（因样式未完全加载可能导致布局未稳定），但可以通过 JS 访问和操作 DOM 节点。

## domContentLoaded（DOM 内容加载完成）
含义：DOM 树构建完成且所有同步 CSS 样式表加载解析完毕，此时页面核心内容已具备渲染条件，无需等待外部资源（图片、字体等）加载。

关键价值：标志着页面可交互的最早时间点，适合在此触发首屏核心内容的初始化逻辑（如绑定事件、渲染动态数据）

注意：`若存在阻塞性 JS（未加defer/async的<script>），会延迟该事件的触发。`

# 渲染与资源加载阶段
## load（页面完全加载）
含义：除 DOM 和 CSS 外，页面所有外部资源（图片、视频、字体、异步脚本等）均加载完成，页面呈现最终状态。

与 domContentLoaded 的区别：load需等待所有资源加载，domContentLoaded仅关注 DOM 和同步 CSS，因此load事件触发时间通常晚于domContentLoaded。
# 更新阶段
## DOM 结构更新
含义：页面加载完成后，通过 JS 动态操作 DOM（如appendChild、removeChild、修改元素属性等）导致 DOM 树结构变化的阶段。

关联行为：DOM 更新可能触发浏览器的[重排（Reflow）](./重绘和重排.md)和[重绘（Repaint）](./重绘和重排.md)，影响页面性能。

## resize/scroll触发的 DOM 状态变化
含义：用户调整窗口尺寸（resize事件）或滚动页面（scroll事件）时，DOM 元素的位置、尺寸等状态发生变化的阶段。

应用场景：常用于响应式布局调整、滚动加载等功能。

# 卸载阶段
## beforeunload（卸载前）
含义：页面即将被卸载（如关闭标签页、导航到其他页面）前触发，可用于提示用户保存未提交的内容。

注意：避免在此事件中执行复杂逻辑，可能影响页面关闭效率，部分浏览器对弹窗提示有限制。

## unload（卸载完成）
含义：页面开始卸载，DOM 结构被销毁，所有资源（脚本、样式、图片）将被释放。

局限性：此阶段执行的 JS 代码可能被浏览器中断，不适合进行数据上报等关键操作（建议优先使用beforeunload或visibilitychange事件）。

## visibilitychange（页面可见性变化）
含义：页面可见状态改变时触发（如切换标签页、最小化窗口），虽不直接属于 DOM 卸载，但关联页面资源的生命周期管理。

应用场景：暂停 / 恢复视频播放、调整数据请求频率等，间接优化 DOM 资源的使用效率。

```js
// 示例：获取各生命周期节点的时间（相对于navigationStart的差值）
const timing = performance.timing;
console.log('DOM加载开始时间：', timing.domLoading - timing.navigationStart, 'ms');
console.log('DOM交互就绪时间：', timing.domInteractive - timing.navigationStart, 'ms');
console.log('DOM内容加载完成时间：', timing.domContentLoadedEventStart - timing.navigationStart, 'ms');
console.log('页面完全加载时间：', timing.loadEventStart - timing.navigationStart, 'ms');
```