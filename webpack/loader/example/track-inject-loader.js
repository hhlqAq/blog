// C 端需统计按钮点击、页面曝光等行为，手动写trackEvent('xxx')冗余且易遗漏，维护成本高。
// 问题：如何在Vue项目中自动注入统计代码，避免手动编写？
// 解决：使用track-inject-loader加载器，在Vue项目中自动注入统计代码。

module.exports = function (source) {
  // 匹配Vue模板中带有 data-track 属性的元素
  // 例：<button data-track="首页-点击-登录"> → 注入 @click="trackEvent('首页-点击-登录')"
  const trackRegex = /<(\w+)(\s+[^>]*?)data-track=["']([^"']+)["']([^>]*?)>/g;

  return source.replace(trackRegex, (match, tag, prefix, trackKey, suffix) => {
    // 已存在 @click 则追加，否则添加 @click
    const clickAttr = prefix.match(/@click=["']([^"']+)["']/) 
      ? `${prefix.replace(/@click=["']([^"']+)["']/, `@click="$1;trackEvent('${trackKey}')"`)}`
      : `${prefix} @click="trackEvent('${trackKey}')"`;

    return `<${tag}${clickAttr}${suffix}>`;
  });
};

// 注意：
// 1. 仅对Vue模板中的元素生效（如 <button>, <div>, <a> 等）
// 2. 已存在 @click 事件的元素，会在其基础上追加统计代码
// 3. 统计事件名称格式为：“模块-操作-元素”（如：“首页-点击-登录”）

// 配置（vue.config.js）
module.exports = defineConfig({
  chainWebpack: (config) => {
    config.module
      .rule('vue')
      .use('track-inject-loader')
      .loader(path.resolve('./loaders/track-inject-loader.js'))
      .before('vue-loader')
      .end();
  }
});

// 全局埋点函数（main.js）
// 全局注册埋点函数
Vue.prototype.trackEvent = function (eventName) {
  // 对接第三方统计SDK（如百度统计、神策）
  window.sensor?.track(eventName, {
    page: window.location.pathname,
    time: new Date().getTime()
  });
};

// 使用

// <!-- 编译前 -->
// <button data-track="首页-点击-登录">登录</button>
// <a data-track="首页-点击-下载APP" @click="openDownload">下载APP</a>

// <!-- 编译后（自动注入埋点） -->
// <button @click="trackEvent('首页-点击-登录')">登录</button>
// <a @click="openDownload;trackEvent('首页-点击-下载APP')">下载APP</a>