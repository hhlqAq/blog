// 场景：在Vue项目中，根据环境变量动态配置API基础URL和统计域名
// 问题：如何在Vue项目中根据不同环境（如开发、生产）动态配置API基础URL和统计域名？
// 解决：使用env-inject-loader加载器，在Vue项目中根据环境变量动态替换代码中的占位符。

module.exports = function (source) {
  // 接收Webpack配置的options（环境变量映射）
  const { envMap } = this.query;
  if (!envMap) return source;

  // 正则匹配 __ENV__['XXX'] 或 __ENV__["XXX"] 或 __ENV__.XXX
  const envRegex = /__ENV__(\['([^']+)'|"([^"]+)"|.([a-zA-Z0-9_]+)\])/g;

  return source.replace(envRegex, (match, keyPart, key1, key2, key3) => {
    const key = key1 || key2 || key3;
    // 替换为环境变量值（支持字符串/数字/布尔）
    const value = envMap[key];
    return typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
  });
};

// 在vue.config.js中配置loader
module.exports = {
  chainWebpack: config => {
    config.module
      .rule('env-inject')
      .test(/\.(vue|js|jsx)$/)
      .use('env-inject-loader')
      .loader(path.resolve('./loaders/env-inject-loader.js'))
      .options({
        envMap: {
          API_BASE_URL: process.env.VUE_APP_API_BASE_URL,
          IS_PROD: process.env.NODE_ENV === 'production',
          STAT_DOMAIN: process.env.VUE_APP_STAT_DOMAIN
        }
      });
  }
};


// 编译后自动替换为对应环境值
axios.defaults.baseURL = __ENV__.API_BASE_URL;
if (__ENV__.IS_PROD) {
  initStat(__ENV__.STAT_DOMAIN);
}