// 解决低版本浏览器不支持ES6+语法的问题
// 问题：C端用户可能使用 IE11 等低版本浏览器，不支持Promise、async/await等 ES6 + 语法，导致页面报错。
// 解决：使用es6-polyfill-loader加载器，在Vue项目中自动注入ES6+语法的polyfill。


// 优势
// 按需开启：仅对需要兼容的环境注入 polyfill；
// 全局生效：无需在每个文件手动导入 core-js；
// 体积优化：使用 minified 版本的 core-js，减小打包体积。
const coreJsPath = require.resolve('core-js-bundle/minified.js'); // core-js打包文件

module.exports = function (source) {
  // 仅对生产环境、且目标浏览器包含IE11时生效
  if (process.env.NODE_ENV !== 'production' || !this.query.needPolyfill) {
    return source;
  }

  // 在入口文件顶部注入core-js（全局polyfill）
  if (this.resourcePath.includes('src/main.js')) {
    return `import '${coreJsPath}';\n${source}`;
  }

  return source;
};

//。配置（vue.config.js）

// 检测是否需要兼容IE11（可通过环境变量控制）
const needPolyfill = process.env.VUE_APP_TARGET_BROWSER === 'ie11';

module.exports = defineConfig({
  configureWebpack: {
    module: {
      rules: [
        {
          test: /\.js$/,
          include: path.resolve('src'),
          use: [
            {
              loader: path.resolve('./loaders/es6-polyfill-loader.js'),
              options: { needPolyfill }
            }
          ]
        }
      ]
    }
  },
  // 配合babel-loader确保语法转换
  transpileDependencies: true
});