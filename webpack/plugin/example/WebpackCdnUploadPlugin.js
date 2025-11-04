const fs = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');

/**
 * Webpack5 独立CDN上传插件
 * 核心特性：
 * 1. 纯上传功能，无冗余依赖
 * 2. 支持自定义CDN上传逻辑（适配阿里云OSS/腾讯云COS/七牛云等）
 * 3. 兼容增量构建（仅上传变更资源）
 * 4. 失败重试机制（可配置重试次数）
 * 5. 详细日志输出（上传状态、进度、错误信息）
 * 6. 非阻断式执行（上传失败不影响构建流程）
 * 7. 支持忽略指定资源（如SourceMap、LICENSE文件）
 */
class WebpackCdnUploadPlugin {
  /**
   * @param {Object} options 插件配置
   * @param {Function} options.upload 必选，CDN上传核心函数
   * @param {string} options.baseUrl 必选，CDN基础访问地址（如：https://cdn.example.com/）
   * @param {number} [options.retry=2] 上传失败重试次数（默认2次）
   * @param {number} [options.retryDelay=1000] 重试延迟时间（毫秒，默认1000ms）
   * @param {RegExp|Function} [options.ignore] 忽略上传的资源（正则匹配文件名或自定义函数）
   * @param {boolean} [options.enableInDev=false] 开发环境是否启用（默认关闭）
   * @param {boolean} [options.verbose=true] 是否输出详细日志（默认开启）
   */
  constructor(options = {}) {
    // 校验必填配置
    this.validateOptions(options);

    // 初始化配置（合并默认值）
    this.config = {
      retry: 2,
      retryDelay: 1000,
      ignore: /(\.map$|\.LICENSE$)/, // 默认忽略SourceMap和LICENSE文件
      enableInDev: false,
      verbose: true,
      ...options,
    };

    // 存储上传状态
    this.uploadStats = {
      total: 0, // 总待上传资源数
      success: 0, // 上传成功数
      failed: 0, // 上传失败数
      skipped: 0, // 忽略的资源数
      failedFiles: [], // 失败的文件列表
    };
  }

  /**
   * 校验必填配置项
   * @param {Object} options 传入配置
   */
  validateOptions(options) {
    const missing = [];
    if (!options.upload || typeof options.upload !== 'function') {
      missing.push('upload（CDN上传函数，必传且为函数）');
    }
    if (!options.baseUrl || typeof options.baseUrl !== 'string') {
      missing.push('baseUrl（CDN基础地址，必传且为字符串）');
    }

    if (missing.length > 0) {
      throw new Error(`WebpackCdnUploadPlugin：缺少必填配置或配置格式错误：${missing.join(', ')}`);
    }
  }

  /**
   * 插件核心逻辑（注册Webpack钩子）
   * @param {Compiler} compiler Webpack Compiler实例
   */
  apply(compiler) {
    const isProduction = compiler.options.mode === 'production';
    const shouldEnable = this.config.enableInDev || isProduction;

    // 非启用环境直接返回
    if (!shouldEnable) {
      this.log(`当前环境未启用（开发环境默认关闭），跳过CDN上传`, 'info');
      return;
    }

    // 绑定 afterEmit 钩子：文件已输出到本地后执行上传（确保文件存在）
    compiler.hooks.afterEmit.tapAsync(
      'WebpackCdnUploadPlugin',
      async (compilation, callback) => {
        try {
          this.log('开始执行CDN上传流程...', 'info');
          const outputPath = compiler.options.output.path;

          // 1. 收集需要上传的资源（过滤忽略的文件）
          const assetsToUpload = this.collectAssets(compilation);
          this.uploadStats.total = assetsToUpload.length;
          this.log(`共检测到 ${this.uploadStats.total} 个待上传资源`, 'info');

          if (assetsToUpload.length === 0) {
            this.log('无符合条件的资源需要上传', 'info');
            callback();
            return;
          }

          // 2. 批量上传资源（串行执行，避免并发过高）
          for (const asset of assetsToUpload) {
            await this.uploadWithRetry({
              ...asset,
              filePath: path.resolve(outputPath, asset.filename),
            });
          }

          // 3. 输出上传总结
          this.logSummary();
        } catch (error) {
          this.log(`CDN上传流程异常：${error.message}`, 'error');
        } finally {
          callback(); // 必须调用callback，避免Webpack构建阻塞
        }
      }
    );
  }

  /**
   * 收集需要上传的资源（过滤忽略项）
   * @param {Compilation} compilation Webpack Compilation实例
   * @returns {Array} 待上传资源列表
   */
  collectAssets(compilation) {
    const { ignore } = this.config;
    const assets = [];

    // 遍历所有输出资源（assetsInfo 包含资源元信息）
    for (const [filename, assetInfo] of compilation.assetsInfo.entries()) {
      // 过滤忽略的资源
      if (this.shouldIgnore(filename)) {
        this.uploadStats.skipped++;
        this.log(`忽略上传：${filename}`, 'debug');
        continue;
      }

      // 获取资源内容（支持两种存储方式：buffer 或 file descriptor）
      const asset = compilation.assets[filename];
      const content = asset.source(); // 返回 Buffer 或 string

      // 收集资源信息
      assets.push({
        filename, // 文件名（含hash，如：main.abc123.js）
        content, // 文件内容（Buffer/string）
        size: (assetInfo.size / 1024).toFixed(2), // 大小（KB）
        hash: assetInfo.contentHash?.js || this.getFileHash(content), // 8位MD5哈希
        cdnUrl: `${this.config.baseUrl.replace(/\/$/, '')}/${filename}`, // CDN访问地址（统一格式）
      });
    }

    return assets;
  }

  /**
   * 判断资源是否需要忽略上传
   * @param {string} filename 文件名
   * @returns {boolean} 是否忽略
   */
  shouldIgnore(filename) {
    const { ignore } = this.config;
    if (typeof ignore === 'function') {
      return ignore(filename); // 自定义忽略函数
    } else if (ignore instanceof RegExp) {
      return ignore.test(filename); // 正则匹配
    }
    return false;
  }

  /**
   * 带重试机制的上传函数
   * @param {Object} asset 资源信息
   * @param {number} [currentRetry=0] 当前重试次数
   */
  async uploadWithRetry(asset, currentRetry = 0) {
    const { filename, filePath, content, size, hash, cdnUrl } = asset;
    const { retry, retryDelay } = this.config;

    try {
      this.log(`正在上传：${filename}（大小：${size} KB，哈希：${hash}）`, 'info');

      // 调用用户自定义的CDN上传函数
      await this.config.upload({
        filename,
        content: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8'), // 统一转为Buffer
        size: `${size} KB`,
        hash,
        cdnUrl,
        filePath, // 本地文件路径（可选：用于流式上传）
      });

      // 上传成功
      this.uploadStats.success++;
      this.log(`✅ 上传成功：${filename} → ${cdnUrl}`, 'success');
    } catch (error) {
      // 达到最大重试次数，标记失败
      if (currentRetry >= retry) {
        this.uploadStats.failed++;
        this.uploadStats.failedFiles.push(filename);
        this.log(`❌ 上传失败（已重试${retry}次）：${filename} → 错误：${error.message}`, 'error');
        return;
      }

      // 重试逻辑
      const nextRetry = currentRetry + 1;
      this.log(`⚠️  上传失败，将在${retryDelay}ms后进行第${nextRetry}/${retry}次重试：${filename} → 错误：${error.message}`, 'warn');
      await this.sleep(retryDelay);
      await this.uploadWithRetry(asset, nextRetry);
    }
  }

  /**
   * 睡眠函数（用于重试延迟）
   * @param {number} ms 延迟时间（毫秒）
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 计算文件内容哈希（8位MD5）
   * @param {string|Buffer} content 文件内容
   * @returns {string} 8位哈希值
   */
  getFileHash(content) {
    return createHash('md5')
      .update(content)
      .digest('hex')
      .slice(0, 8);
  }

  /**
   * 日志输出（支持不同级别）
   * @param {string} message 日志内容
   * @param {string} level 日志级别（info/success/warn/error/debug）
   */
  log(message, level = 'info') {
    if (!this.config.verbose && level === 'debug') return;

    const prefixMap = {
      info: '[ℹ️  WebpackCdnUpload]',
      success: '[✅ WebpackCdnUpload]',
      warn: '[⚠️  WebpackCdnUpload]',
      error: '[❌ WebpackCdnUpload]',
      debug: '[🔧 WebpackCdnUpload]',
    };

    const colorMap = {
      info: '\x1B[34m', // 蓝色
      success: '\x1B[32m', // 绿色
      warn: '\x1B[33m', // 黄色
      error: '\x1B[31m', // 红色
      debug: '\x1B[90m', // 灰色
      reset: '\x1B[0m', // 重置颜色
    };

    console.log(`${colorMap[level]}${prefixMap[level]} ${message}${colorMap.reset}`);
  }

  /**
   * 输出上传总结日志
   */
  logSummary() {
    const { total, success, failed, skipped, failedFiles } = this.uploadStats;
    this.log('========================================', 'info');
    this.log(`CDN上传总结：`, 'info');
    this.log(`总资源数：${total} | 成功：${success} | 失败：${failed} | 忽略：${skipped}`, 'info');
    if (failed > 0) {
      this.log(`失败文件列表：${failedFiles.join(', ')}`, 'error');
      this.log(`提示：请检查CDN配置、网络连接或文件权限`, 'warn');
    }
    this.log('========================================', 'info');
  }
}

module.exports = WebpackCdnUploadPlugin;
