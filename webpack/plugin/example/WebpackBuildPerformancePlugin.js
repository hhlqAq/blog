const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { createHash } = require('crypto');

/**
 * Webpack5 构建性能采集报告插件
 * 核心特性：
 * 1. 采集全生命周期性能指标（初始化、编译、模块处理、输出等阶段耗时）
 * 2. 统计模块/Chunk 信息（数量、大小、类型分布）
 * 3. 支持缓存命中率统计（Webpack5 内存/文件缓存）
 * 4. 生成可视化 HTML 报告 + 结构化 JSON 数据
 * 5. 支持自定义上报（如上传到监控平台）
 * 6. 无侵入式采集（不影响构建性能）
 * 7. 支持过滤冗余数据、自定义报告输出路径
 */
class WebpackBuildPerformancePlugin {
  /**
   * @param {Object} options 插件配置
   * @param {string} [options.outputDir='./build-performance'] 报告输出目录
   * @param {string} [options.reportName='build-report'] 报告文件名前缀（HTML/JSON）
   * @param {boolean} [options.generateHtml=true] 是否生成 HTML 可视化报告
   * @param {boolean} [options.generateJson=true] 是否生成 JSON 数据文件
   * @param {Function} [options.reportUpload] 自定义报告上报函数（接收报告数据）
   * @param {boolean} [options.enableInDev=true] 开发环境是否启用（默认开启）
   * @param {RegExp|Function} [options.ignoreAsset] 忽略统计的资源（如SourceMap）
   * @param {string[]} [options.hooksToTrack] 需采集耗时的钩子（默认采集核心钩子）
   */
  constructor(options = {}) {
    // 合并默认配置
    this.config = {
      outputDir: './build-performance',
      reportName: 'build-report',
      generateHtml: true,
      generateJson: true,
      enableInDev: true,
      ignoreAsset: /\.map$|\.LICENSE$/, // 默认忽略 SourceMap 和 LICENSE 文件
      hooksToTrack: [
        // Webpack 核心钩子（按执行顺序）
        'environment', 'afterEnvironment', 'entryOption', 'afterPlugins',
        'beforeRun', 'run', 'compile', 'compilation', 'make', 'afterCompile',
        'emit', 'afterEmit', 'done'
      ],
      ...options,
    };

    // 性能数据存储
    this.perfData = {
      buildId: this.generateBuildId(), // 唯一构建ID
      timestamp: Date.now(),
      date: new Date().toLocaleString(),
      env: process.env.NODE_ENV || 'production',
      machineInfo: this.getMachineInfo(), // 机器环境信息
      hooksTiming: {}, // 钩子耗时记录 { hookName: { start: number, end: number, duration: number } }
      moduleStats: {}, // 模块统计
      chunkStats: {}, // Chunk 统计
      assetStats: {}, // 资源统计
      cacheStats: { hit: 0, miss: 0, total: 0, hitRate: 0 }, // 缓存统计
      buildDuration: 0, // 总构建耗时（ms）
      webpackVersion: '', // Webpack 版本
    };

    // 记录钩子开始时间的缓存
    this.hookStartTimes = {};
  }

  /**
   * 生成唯一构建ID（基于时间戳 + 随机字符串）
   * @returns {string} 8位构建ID
   */
  generateBuildId() {
    const timestamp = Date.now().toString();
    const randomStr = Math.random().toString(36).substr(2, 4);
    return createHash('md5')
      .update(`${timestamp}-${randomStr}`)
      .digest('hex')
      .slice(0, 8);
  }

  /**
   * 获取机器环境信息（CPU/内存/系统）
   * @returns {Object} 机器信息
   */
  getMachineInfo() {
    return {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0].model
      },
      memory: {
        total: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
        free: (os.freemem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
      },
      nodeVersion: process.version
    };
  }

  /**
   * 插件核心逻辑（注册钩子、采集数据）
   * @param {Compiler} compiler Webpack Compiler实例
   */
  apply(compiler) {
    const isProduction = compiler.options.mode === 'production';
    const shouldEnable = this.config.enableInDev || isProduction;

    // 非启用环境直接返回
    if (!shouldEnable) {
      console.log('[WebpackBuildPerformance] 当前环境未启用，跳过性能采集');
      return;
    }

    // 记录 Webpack 版本
    this.perfData.webpackVersion = compiler.webpack.version;

    // 1. 采集钩子耗时（注册核心钩子的开始/结束事件）
    this.trackHooksTiming(compiler);

    // 2. 采集缓存命中情况（Webpack5 缓存钩子）
    this.trackCacheStats(compiler);

    // 3. 构建完成后（done钩子）：统计模块/Chunk/资源信息，生成报告
    compiler.hooks.done.tapAsync(
      'WebpackBuildPerformancePlugin',
      async (stats, callback) => {
        try {
          // 计算总构建耗时（从 run 钩子开始到 done 结束）
          const runStart = this.perfData.hooksTiming.run?.start || Date.now();
          this.perfData.buildDuration = Date.now() - runStart;

          // 统计模块、Chunk、资源信息
          this.statsModulesChunksAssets(stats);

          // 生成报告文件（HTML/JSON）
          await this.generateReports();

          // 自定义上报（如上传到监控平台）
          if (typeof this.config.reportUpload === 'function') {
            await this.config.reportUpload(this.perfData);
            console.log('[WebpackBuildPerformance] 报告已成功上报');
          }

          // 输出关键信息到控制台
          this.logSummary();
        } catch (error) {
          console.error('[WebpackBuildPerformance] 性能报告生成失败：', error.message);
        } finally {
          callback();
        }
      }
    );
  }

  /**
   * 采集核心钩子的耗时
   * @param {Compiler} compiler Webpack Compiler实例
   */
  trackHooksTiming(compiler) {
    const { hooksToTrack } = this.config;

    hooksToTrack.forEach(hookName => {
      const hook = compiler.hooks[hookName];
      if (!hook) return; // 忽略不存在的钩子

      // 钩子开始时记录时间
      hook.tap('WebpackBuildPerformancePlugin', () => {
        this.hookStartTimes[hookName] = Date.now();
      });

      // 钩子结束时计算耗时（区分同步/异步钩子）
      if (hook.type === 'sync') {
        // 同步钩子：在 tap 后立即记录结束时间（同步执行）
        hook.tap('WebpackBuildPerformancePlugin', () => {
          const start = this.hookStartTimes[hookName];
          const end = Date.now();
          this.perfData.hooksTiming[hookName] = {
            start,
            end,
            duration: end - start
          };
        });
      } else {
        // 异步钩子：使用 tapAsync/tapPromise 记录结束时间
        const tapMethod = hook.promise ? 'tapPromise' : 'tapAsync';
        hook[tapMethod]('WebpackBuildPerformancePlugin', async (...args) => {
          const start = this.hookStartTimes[hookName];
          const callback = args[args.length - 1]; // 异步钩子的回调函数

          try {
            if (hook.promise) {
              await Promise.resolve(); // 等待异步钩子执行完成
            } else {
              await new Promise(resolve => callback(resolve));
            }
          } finally {
            const end = Date.now();
            this.perfData.hooksTiming[hookName] = {
              start,
              end,
              duration: end - start
            };
          }
        });
      }
    });
  }

  /**
   * 采集 Webpack5 缓存命中情况
   * @param {Compiler} compiler Webpack Compiler实例
   */
  trackCacheStats(compiler) {
    // 监听缓存钩子（Webpack5 新增的缓存相关钩子）
    if (compiler.hooks.cacheHit) {
      compiler.hooks.cacheHit.tap('WebpackBuildPerformancePlugin', () => {
        this.perfData.cacheStats.hit++;
        this.perfData.cacheStats.total++;
        this.perfData.cacheStats.hitRate = (this.perfData.cacheStats.hit / this.perfData.cacheStats.total * 100).toFixed(2);
      });
    }

    if (compiler.hooks.cacheMiss) {
      compiler.hooks.cacheMiss.tap('WebpackBuildPerformancePlugin', () => {
        this.perfData.cacheStats.miss++;
        this.perfData.cacheStats.total++;
        this.perfData.cacheStats.hitRate = (this.perfData.cacheStats.hit / this.perfData.cacheStats.total * 100).toFixed(2);
      });
    }
  }

  /**
   * 统计模块、Chunk、资源信息
   * @param {Stats} stats Webpack Stats实例
   */
  statsModulesChunksAssets(stats) {
    const statsJson = stats.toJson({
      all: false,
      modules: true,
      chunks: true,
      assets: true,
      moduleAssets: true
    });

    const { ignoreAsset } = this.config;

    // 1. 模块统计
    this.perfData.moduleStats = {
      total: statsJson.modules?.length || 0,
      byType: this.countByType(statsJson.modules || [], 'type'), // 按模块类型统计（js/css/image等）
      bySize: this.getSizeDistribution(statsJson.modules || [], 'size'), // 按大小分布统计
      averageSize: statsJson.modules?.length 
        ? (statsJson.modules.reduce((sum, mod) => sum + (mod.size || 0), 0) / statsJson.modules.length / 1024).toFixed(2) + ' KB'
        : '0 KB'
    };

    // 2. Chunk 统计
    this.perfData.chunkStats = {
      total: statsJson.chunks?.length || 0,
      entryChunks: statsJson.chunks?.filter(chunk => chunk.entry).length || 0,
      asyncChunks: statsJson.chunks?.filter(chunk => !chunk.entry).length || 0,
      bySize: this.getSizeDistribution(statsJson.chunks || [], 'size'),
      averageSize: statsJson.chunks?.length
        ? (statsJson.chunks.reduce((sum, chunk) => sum + (chunk.size || 0), 0) / statsJson.chunks.length / 1024).toFixed(2) + ' KB'
        : '0 KB'
    };

    // 3. 资源统计（过滤忽略的资源）
    const validAssets = (statsJson.assets || []).filter(asset => !this.shouldIgnore(asset.name));
    this.perfData.assetStats = {
      total: validAssets.length,
      totalSize: (validAssets.reduce((sum, asset) => sum + (asset.size || 0), 0) / 1024 / 1024).toFixed(2) + ' MB',
      byType: this.countByType(validAssets, asset => {
        const ext = path.extname(asset.name).slice(1) || 'other';
        return ext.toLowerCase();
      }), // 按文件后缀统计
      largestAssets: validAssets
        .sort((a, b) => (b.size || 0) - (a.size || 0))
        .slice(0, 5)
        .map(asset => ({
          name: asset.name,
          size: (asset.size / 1024).toFixed(2) + ' KB',
          hash: asset.hash
        })) // Top5 最大资源
    };
  }

  /**
   * 按类型统计数量（通用工具函数）
   * @param {Array} arr 待统计数组
   * @param {string|Function} key 类型字段名或自定义获取函数
   * @returns {Object} 类型统计结果 { type: count }
   */
  countByType(arr, key) {
    return arr.reduce((result, item) => {
      const type = typeof key === 'function' ? key(item) : item[key];
      result[type] = (result[type] || 0) + 1;
      return result;
    }, {});
  }

  /**
   * 按大小分布统计（通用工具函数）
   * @param {Array} arr 待统计数组
   * @param {string} sizeKey 大小字段名
   * @returns {Object} 大小分布统计 { '<10KB': count, '10KB-100KB': count, ... }
   */
  getSizeDistribution(arr, sizeKey) {
    return arr.reduce((result, item) => {
      const size = item[sizeKey] || 0; // 大小单位：字节
      let range = '';
      if (size < 10 * 1024) range = '<10KB';
      else if (size < 100 * 1024) range = '10KB-100KB';
      else if (size < 500 * 1024) range = '100KB-500KB';
      else if (size < 1 * 1024 * 1024) range = '500KB-1MB';
      else range = '>1MB';
      result[range] = (result[range] || 0) + 1;
      return result;
    }, {});
  }

  /**
   * 判断资源是否需要忽略统计
   * @param {string} assetName 资源名称
   * @returns {boolean} 是否忽略
   */
  shouldIgnore(assetName) {
    const { ignoreAsset } = this.config;
    if (typeof ignoreAsset === 'function') {
      return ignoreAsset(assetName);
    } else if (ignoreAsset instanceof RegExp) {
      return ignoreAsset.test(assetName);
    }
    return false;
  }

  /**
   * 生成 HTML + JSON 报告文件
   */
  async generateReports() {
    const { outputDir, reportName, generateHtml, generateJson } = this.config;
    const reportPath = path.resolve(outputDir);

    // 创建输出目录（若不存在）
    try {
      await fs.access(reportPath);
    } catch {
      await fs.mkdir(reportPath, { recursive: true });
    }

    // 1. 生成 JSON 数据文件
    if (generateJson) {
      const jsonPath = path.resolve(reportPath, `${reportName}-${this.perfData.buildId}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(this.perfData, null, 2), 'utf-8');
      console.log(`[WebpackBuildPerformance] JSON 报告已生成：${jsonPath}`);
    }

    // 2. 生成 HTML 可视化报告
    if (generateHtml) {
      const htmlPath = path.resolve(reportPath, `${reportName}-${this.perfData.buildId}.html`);
      const htmlContent = this.generateHtmlReport();
      await fs.writeFile(htmlPath, htmlContent, 'utf-8');
      console.log(`[WebpackBuildPerformance] HTML 报告已生成：${htmlPath}`);
    }
  }

  /**
   * 生成可视化 HTML 报告
   * @returns {string} HTML 内容
   */
  generateHtmlReport() {
    const { perfData } = this;

    // 格式化钩子耗时（按耗时排序，取前10个耗时最长的钩子）
    const sortedHooks = Object.entries(perfData.hooksTiming)
      .map(([name, timing]) => ({ name, duration: timing.duration }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Webpack 构建性能报告 - ${perfData.buildId}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 1.5rem; margin-bottom: 1.5rem; }
    .stat-item { display: flex; align-items: center; margin-bottom: 0.8rem; }
    .stat-label { width: 120px; font-weight: 500; color: #666; }
    .stat-value { flex: 1; color: #333; }
    .chart-container { height: 300px; margin-top: 1rem; }
  </style>
</head>
<body class="bg-gray-50">
  <div class="max-w-7xl mx-auto p-4 md:p-6">
    <!-- 报告头部 -->
    <div class="card bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">Webpack 构建性能报告</h1>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div class="bg-white p-3 rounded-lg shadow-sm">
          <div class="text-sm text-gray-500">构建ID</div>
          <div class="text-lg font-semibold">${perfData.buildId}</div>
        </div>
        <div class="bg-white p-3 rounded-lg shadow-sm">
          <div class="text-sm text-gray-500">构建时间</div>
          <div class="text-lg font-semibold">${perfData.date}</div>
        </div>
        <div class="bg-white p-3 rounded-lg shadow-sm">
          <div class="text-sm text-gray-500">总耗时</div>
          <div class="text-lg font-semibold text-red-500">${(perfData.buildDuration / 1000).toFixed(2)}s</div>
        </div>
      </div>
    </div>

    <!-- 环境信息 -->
    <div class="card">
      <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <i class="fa-solid fa-server mr-2 text-blue-500"></i>环境信息
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div class="stat-item">
            <span class="stat-label">环境</span>
            <span class="stat-value font-medium">${perfData.env}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Webpack 版本</span>
            <span class="stat-value">${perfData.webpackVersion}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Node 版本</span>
            <span class="stat-value">${perfData.machineInfo.nodeVersion}</span>
          </div>
        </div>
        <div>
          <div class="stat-item">
            <span class="stat-label">操作系统</span>
            <span class="stat-value">${perfData.machineInfo.os}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">CPU</span>
            <span class="stat-value">${perfData.machineInfo.cpu.cores}核 · ${perfData.machineInfo.cpu.model}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">内存</span>
            <span class="stat-value">总：${perfData.machineInfo.memory.total} · 空闲：${perfData.machineInfo.memory.free}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 核心性能指标 -->
    <div class="card">
      <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <i class="fa-solid fa-gauge-high mr-2 text-green-500"></i>核心性能指标
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-green-50 p-4 rounded-lg">
          <div class="text-sm text-green-700">模块总数</div>
          <div class="text-2xl font-bold text-green-900">${perfData.moduleStats.total}</div>
        </div>
        <div class="bg-blue-50 p-4 rounded-lg">
          <div class="text-sm text-blue-700">Chunk 总数</div>
          <div class="text-2xl font-bold text-blue-900">${perfData.chunkStats.total}</div>
        </div>
        <div class="bg-purple-50 p-4 rounded-lg">
          <div class="text-sm text-purple-700">输出资源数</div>
          <div class="text-2xl font-bold text-purple-900">${perfData.assetStats.total}</div>
        </div>
      </div>

      <!-- 缓存命中率 -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-700 mb-2">缓存命中率</h3>
        <div class="flex items-center">
          <div class="w-1/3 text-gray-600">
            命中：${perfData.cacheStats.hit} · 未命中：${perfData.cacheStats.miss}
          </div>
          <div class="w-2/3">
            <div class="w-full bg-gray-200 rounded-full h-4">
              <div 
                class="bg-green-500 h-4 rounded-full" 
                style="width: ${perfData.cacheStats.hitRate || 0}%"
              ></div>
            </div>
            <div class="text-right text-sm font-medium mt-1">${perfData.cacheStats.hitRate || 0}%</div>
          </div>
        </div>
      </div>

      <!-- 钩子耗时 Top10 -->
      <div>
        <h3 class="text-lg font-semibold text-gray-700 mb-2">钩子耗时 Top10</h3>
        <div class="chart-container">
          <canvas id="hooksTimingChart"></canvas>
        </div>
      </div>
    </div>

    <!-- 模块统计 -->
    <div class="card">
      <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <i class="fa-solid fa-cubes mr-2 text-orange-500"></i>模块统计
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-700 mb-2">模块类型分布</h3>
          <div class="chart-container">
            <canvas id="moduleTypeChart"></canvas>
          </div>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-700 mb-2">模块大小分布</h3>
          <div class="chart-container">
            <canvas id="moduleSizeChart"></canvas>
          </div>
        </div>
      </div>
      <div class="mt-4 text-gray-600">
        平均模块大小：<span class="font-medium">${perfData.moduleStats.averageSize}</span>
      </div>
    </div>

    <!-- Chunk 统计 -->
    <div class="card">
      <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <i class="fa-solid fa-layer-group mr-2 text-teal-500"></i>Chunk 统计
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-700 mb-2">Chunk 类型分布</h3>
          <div class="chart-container">
            <canvas id="chunkTypeChart"></canvas>
          </div>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-700 mb-2">Chunk 大小分布</h3>
          <div class="chart-container">
            <canvas id="chunkSizeChart"></canvas>
          </div>
        </div>
      </div>
      <div class="mt-4 text-gray-600">
        平均 Chunk 大小：<span class="font-medium">${perfData.chunkStats.averageSize}</span>
      </div>
    </div>

    <!-- 资源统计 -->
    <div class="card">
      <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <i class="fa-solid fa-file mr-2 text-red-500"></i>资源统计
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-700 mb-2">资源类型分布</h3>
          <div class="chart-container">
            <canvas id="assetTypeChart"></canvas>
          </div>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-700 mb-2">Top5 最大资源</h3>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th class="px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件名</th>
                  <th class="px-3 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">大小</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${perfData.assetStats.largestAssets.map(asset => `
                  <tr>
                    <td class="px-3 py-2 text-sm text-gray-900">${asset.name}</td>
                    <td class="px-3 py-2 text-sm text-red-600 font-medium">${asset.size}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="mt-4 text-gray-600">
        总输出大小：<span class="font-medium text-red-600">${perfData.assetStats.totalSize}</span>
      </div>
    </div>

    <!-- 报告底部 -->
    <div class="text-center text-gray-500 text-sm mt-8 pb-4">
      报告生成时间：${new Date().toLocaleString()} · 插件：WebpackBuildPerformancePlugin
    </div>
  </div>

  <!-- 图表初始化脚本 -->
  <script>
    // 通用图表配置
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 15
          }
        }
      }
    };

    // 1. 钩子耗时 Top10 图表
    new Chart(document.getElementById('hooksTimingChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(sortedHooks.map(h => h.name))},
        datasets: [{
          label: '耗时（ms）',
          data: ${JSON.stringify(sortedHooks.map(h => h.duration))},
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }]
      },
      options: {
        ...chartOptions,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: '耗时（ms）' } }
        }
      }
    });

    // 2. 模块类型分布图表
    new Chart(document.getElementById('moduleTypeChart'), {
      type: 'pie',
      data: {
        labels: ${JSON.stringify(Object.keys(perfData.moduleStats.byType))},
        datasets: [{
          data: ${JSON.stringify(Object.values(perfData.moduleStats.byType))},
          backgroundColor: [
            'rgba(251, 146, 60, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(34, 197, 94, 0.7)',
            'rgba(168, 85, 247, 0.7)', 'rgba(239, 68, 68, 0.7)', 'rgba(249, 115, 22, 0.7)'
          ]
        }]
      },
      options: chartOptions
    });

    // 3. 模块大小分布图表
    new Chart(document.getElementById('moduleSizeChart'), {
      type: 'doughnut',
      data: {
        labels: ${JSON.stringify(Object.keys(perfData.moduleStats.bySize))},
        datasets: [{
          data: ${JSON.stringify(Object.values(perfData.moduleStats.bySize))},
          backgroundColor: [
            'rgba(34, 197, 94, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(251, 146, 60, 0.7)',
            'rgba(239, 68, 68, 0.7)', 'rgba(168, 85, 247, 0.7)'
          ]
        }]
      },
      options: chartOptions
    });

    // 4. Chunk 类型分布图表
    new Chart(document.getElementById('chunkTypeChart'), {
      type: 'pie',
      data: {
        labels: ['入口 Chunk', '异步 Chunk'],
        datasets: [{
          data: [${perfData.chunkStats.entryChunks}, ${perfData.chunkStats.asyncChunks}],
          backgroundColor: ['rgba(20, 184, 166, 0.7)', 'rgba(107, 114, 128, 0.7)']
        }]
      },
      options: chartOptions
    });

    // 5. Chunk 大小分布图表
    new Chart(document.getElementById('chunkSizeChart'), {
      type: 'doughnut',
      data: {
        labels: ${JSON.stringify(Object.keys(perfData.chunkStats.bySize))},
        datasets: [{
          data: ${JSON.stringify(Object.values(perfData.chunkStats.bySize))},
          backgroundColor: [
            'rgba(34, 197, 94, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(251, 146, 60, 0.7)',
            'rgba(239, 68, 68, 0.7)', 'rgba(168, 85, 247, 0.7)'
          ]
        }]
      },
      options: chartOptions
    });

    // 6. 资源类型分布图表
    new Chart(document.getElementById('assetTypeChart'), {
      type: 'pie',
      data: {
        labels: ${JSON.stringify(Object.keys(perfData.assetStats.byType))},
        datasets: [{
          data: ${JSON.stringify(Object.values(perfData.assetStats.byType))},
          backgroundColor: [
            'rgba(239, 68, 68, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(34, 197, 94, 0.7)',
            'rgba(168, 85, 247, 0.7)', 'rgba(251, 146, 60, 0.7)', 'rgba(107, 114, 128, 0.7)'
          ]
        }]
      },
      options: chartOptions
    });
  </script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</body>
</html>
    `;
  }

  /**
   * 输出控制台总结信息
   */
  logSummary() {
    const { perfData } = this;
    console.log('\n========================================');
    console.log('[WebpackBuildPerformance] 构建性能总结');
    console.log(`构建ID：${perfData.buildId}`);
    console.log(`构建时间：${perfData.date}`);
    console.log(`总耗时：${(perfData.buildDuration / 1000).toFixed(2)}s`);
    console.log(`模块数：${perfData.moduleStats.total} | Chunk数：${perfData.chunkStats.total} | 资源数：${perfData.assetStats.total}`);
    console.log(`缓存命中率：${perfData.cacheStats.hitRate || 0}%（命中：${perfData.cacheStats.hit} | 未命中：${perfData.cacheStats.miss}）`);
    console.log(`总输出大小：${perfData.assetStats.totalSize}`);
    console.log('========================================\n');
  }
}

module.exports = WebpackBuildPerformancePlugin;
