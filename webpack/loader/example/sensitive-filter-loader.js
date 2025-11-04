// C 端项目中，开发环境可能残留测试用的敏感数据（如真实手机号、身份证号），打包时容易误发布，造成信息泄露。
// 问题：如何在Vue项目中过滤掉开发环境中的敏感数据，避免打包时泄露？
// 解决：使用sensitive-filter-loader加载器，在Vue项目中过滤掉开发环境中的敏感数据。

module.exports = function (source) {
  // 仅生产环境生效
  if (process.env.NODE_ENV !== 'production') return source;

  // 匹配 {{ sensitive(xxx) }} 语法（Vue模板插值）
  const sensitiveRegex = /{{\s*sensitive\((.+?)\)\s*}}/g;

  // 替换为占位符（支持自定义占位符，通过query传入）
  const placeholder = this.query.placeholder || '****';
  return source.replace(sensitiveRegex, placeholder);
};

// 配置（vue.config.js）
module.exports = defineConfig({
  chainWebpack: (config) => {
    // 插入到vue-loader之前（先处理模板内容）
    config.module
      .rule('vue')
      .use('sensitive-filter-loader')
      .loader(path.resolve('./loaders/sensitive-filter-loader.js'))
      .options({ placeholder: '****' })
      .before('vue-loader')
      .end();
  }
});

// <!-- 开发环境显示真实数据，生产环境显示 **** -->
{/* <div>手机号：{{ sensitive(user.phone) }}</div> */}
{/* <div>身份证号：{{ sensitive(user.idCard) }}</div> */}