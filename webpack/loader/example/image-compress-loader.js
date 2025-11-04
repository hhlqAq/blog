// 场景：C 端项目图片资源多，设计师导出的图片体积过大，导致页面加载速度慢、流量消耗高，手动压缩效率低。
// 问题：如何在Vue项目中压缩图片资源，避免手动压缩效率低？
// 解决：使用image-compress-loader加载器，在Vue项目中压缩图片资源。

const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
const cache = new Map(); // 缓存已压缩的图片内容

module.exports = async function (source) {
  const callback = this.async(); // 异步Loader
  const { quality = 80 } = this.query;

  // 缓存key：文件内容hash + 压缩质量
  const cacheKey = `${Buffer.from(source).toString('base64')}-${quality}`;
  if (cache.has(cacheKey)) {
    return callback(null, cache.get(cacheKey));
  }

  try {
    // 压缩图片
    const compressed = await imagemin.buffer(source, {
      plugins: [
        imageminMozjpeg({ quality }), // JPG压缩
        imageminPngquant({ quality: [quality / 100, quality / 100] }) // PNG压缩
      ]
    });

    cache.set(cacheKey, compressed);
    callback(null, compressed);
  } catch (err) {
    callback(err);
  }
};

// 标记为二进制Loader（处理图片缓冲区）
module.exports.raw = true;

//。配置（vue.config.js）
module.exports = defineConfig({
  configureWebpack: {
    module: {
      rules: [
        {
          test: /\.(jpe?g|png)$/i,
          use: [
            {
              loader: 'url-loader', // 配合url-loader处理小图片转base64
              options: { limit: 8192 }
            },
            {
              loader: path.resolve('./loaders/image-compress-loader.js'),
              options: { quality: 75 } // 压缩质量（0-100）
            }
          ]
        }
      ]
    }
  }
});
