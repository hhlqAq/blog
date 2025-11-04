 Compiler 钩子贯穿整个构建生命周期，从初始化到构建完成的全流程均可通过插件干预。
 以下是 所有核心 Compiler 钩子 的真实处理场景、代码示例（插件形式），涵盖资源优化、日志输出、自定义构建逻辑等实用场景，直接可用于开发 Webpack 插件。

- 钩子执行顺序：初始化（initialize）→ 入口处理（entryOption）→ 环境准备（environment）→ 构建（run/watchRun）→ 编译（compile/compilation）→ 产物输出（emit/afterEmit）→ 完成（done）。
- 异步处理：涉及文件操作、网络请求的场景，使用 tapAsync（回调）或 tapPromise（Promise）。

-  实用场景优先级：
  - 资源优化：emit（修改产物）、afterCompile（优化编译结果）。
  - 日志 / 监控：done（总结）、failed（告警）、watchRun（增量构建）。
  - 配置修改：entryOption（入口）、afterResolvers（解析规则）、normalModuleFactory（模块规则）。

- 兼容性：所有示例基于 Webpack 5，使用 Tapable 最新 API，不兼容 Webpack 4 及以下版本。

# 一、Compiler 核心钩子分类与说明

Compiler 钩子按执行阶段分为：**初始化阶段**、**构建阶段**、**输出阶段**、**完成阶段**，所有钩子均基于 Tapable 实现，支持 tap（同步）、tapAsync（异步回调）、tapPromise（异步 Promise）三种注册方式。

# 二、全钩子真实场景 + 插件代码示例
## 1.initialize - 初始化阶段（最早执行）
- 场景：初始化插件依赖的全局变量、读取配置文件、注册自定义工具函数。
- 时机：Compiler 实例创建后立即执行，`此时配置已合并但未开始构建`。
```js
class InitPlugin {
  apply(compiler) {
    // 同步钩子，直接 tap 注册
    compiler.hooks.initialize.tap('InitPlugin', () => {
      console.log('📌 插件初始化：初始化全局配置');
      // 真实场景：读取环境变量、初始化日志工具、校验配置合法性
      compiler.$customData = {
        buildStartTime: Date.now(),
        env: process.env.NODE_ENV || 'development'
      };
      // 校验必要配置（如 output.path 必须存在）
      if (!compiler.options.output.path) {
        throw new Error('❌ 输出目录 output.path 未配置');
      }
    });
  }
}

module.exports = InitPlugin;
```
## 2. entryOption - 入口配置处理
- 场景：动态修改入口文件、校验入口合法性、添加多入口。
- 时机：Webpack 处理完 entry 配置后触发，可修改 compiler.options.entry。
```js
class DynamicEntryPlugin {
  apply(compiler) {
    // 同步钩子，支持修改 entry 配置
    compiler.hooks.entryOption.tap('DynamicEntryPlugin', (context, entry) => {
      console.log('📌 处理入口配置：动态添加入口');
      // 真实场景 1：根据环境添加不同入口（如生产环境添加统计脚本）
      if (compiler.$customData.env === 'production') {
        // 多入口格式：{ main: './src/index.js', stats: './src/stats.js' }
        if (typeof entry === 'object' && !Array.isArray(entry)) {
          compiler.options.entry.stats = './src/stats.js';
        }
      }

      // 真实场景 2：校验入口文件是否存在
      const checkEntry = (entryValue) => {
        if (typeof entryValue === 'string') {
          const entryPath = require('path').resolve(context, entryValue);
          if (!require('fs').existsSync(entryPath)) {
            throw new Error(`❌ 入口文件不存在：${entryPath}`);
          }
        }
      };

      if (Array.isArray(entry)) entry.forEach(checkEntry);
      else checkEntry(entry);
    });
  }
}

module.exports = DynamicEntryPlugin;
```
## 3. afterPlugins - 所有插件初始化后
- 场景：依赖其他插件初始化完成后执行逻辑（如使用 HtmlWebpackPlugin 的配置）。
- 时机：所有插件的 apply 方法执行完毕后触发。
```js
class AfterPluginsPlugin {
  apply(compiler) {
    compiler.hooks.afterPlugins.tap('AfterPluginsPlugin', () => {
      console.log('📌 所有插件初始化完成：读取其他插件配置');
      // 真实场景：获取 HtmlWebpackPlugin 的配置并修改
      const htmlPlugin = compiler.options.plugins.find(
        plugin => plugin.constructor.name === 'HtmlWebpackPlugin'
      );
      if (htmlPlugin) {
        // 动态修改 HTML 标题
        htmlPlugin.userOptions.title = `My App - ${compiler.$customData.env}`;
      }
    });
  }
}

module.exports = AfterPluginsPlugin;
```
## 4. afterResolvers - Resolver 初始化后
- 场景：自定义模块解析规则、添加别名、修改解析路径。
- 时机：Webpack 的 Resolver（模块解析器）初始化完成后触发。
```js
class CustomResolverPlugin {
  apply(compiler) {
    compiler.hooks.afterResolvers.tap('CustomResolverPlugin', (compiler) => {
      console.log('📌 Resolver 初始化完成：添加自定义解析规则');
      // 真实场景 1：添加模块别名（替代 webpack.config.js 中的 resolve.alias）
      compiler.options.resolve.alias['@utils'] = require('path').resolve(__dirname, 'src/utils');

      // 真实场景 2：限制只允许解析 src/ 目录下的模块（防止引入外部无关模块）
      const originalResolve = compiler.resolverFactory.hooks.resolve.tap(
        'CustomResolverPlugin', (resolve) => {
          return (data, callback) => {
            const requestPath = data.request;
            const srcPath = require('path').resolve(__dirname, 'src');
            // 排除 node_modules 和自定义别名
            if (
              !requestPath.startsWith('node_modules') &&
              !requestPath.startsWith('@') &&
              !requestPath.includes(srcPath)
            ) {
              return callback(new Error(`❌ 禁止引入 src 目录外的模块：${requestPath}`));
            }
            return resolve(data, callback);
          };
        }
      );
    });
  }
}

module.exports = CustomResolverPlugin;
```
## 5. environment - 环境准备阶段
- 场景：设置构建环境变量、注册 Node.js 模块钩子（如 fs、path）。
- 时机：Webpack 准备好构建环境后触发，此时可访问 compiler.inputFileSystem 等。
```js
class EnvironmentPlugin {
  apply(compiler) {
    compiler.hooks.environment.tap('EnvironmentPlugin', () => {
      console.log('📌 准备构建环境：设置环境变量和文件系统钩子');
      // 真实场景 1：设置全局环境变量（供业务代码使用）
      compiler.options.plugins.push(
        new require('webpack').DefinePlugin({
          'process.env.BUILD_TIME': JSON.stringify(new Date().toLocaleString()),
          'process.env.BUILD_ENV': JSON.stringify(compiler.$customData.env)
        })
      );

      // 真实场景 2：拦截文件读取（如替换测试环境的接口配置文件）
      const originalReadFile = compiler.inputFileSystem.readFile;
      compiler.inputFileSystem.readFile = function(path, callback) {
        if (path.includes('config/api.js') && compiler.$customData.env === 'test') {
          // 测试环境替换为测试接口配置
          const testConfig = `export default { baseUrl: 'https://test-api.example.com' }`;
          return callback(null, testConfig);
        }
        return originalReadFile.call(this, path, callback);
      };
    });
  }
}

module.exports = EnvironmentPlugin;
```
## 6. afterEnvironment - 环境准备完成后
- 场景：验证环境配置、初始化构建依赖（如缓存目录）。
- 时机：environment 钩子执行完毕后触发。
```js
class AfterEnvironmentPlugin {
  apply(compiler) {
    compiler.hooks.afterEnvironment.tap('AfterEnvironmentPlugin', () => {
      console.log('📌 环境准备完成：初始化缓存和日志');
      // 真实场景 1：创建缓存目录（用于缓存构建产物）
      const cacheDir = require('path').resolve(__dirname, '.webpack-cache');
      if (!require('fs').existsSync(cacheDir)) {
        require('fs').mkdirSync(cacheDir, { recursive: true });
        console.log(`✅ 缓存目录创建成功：${cacheDir}`);
      }

      // 真实场景 2：初始化日志文件（记录构建过程）
      const logPath = require('path').resolve(cacheDir, 'build.log');
      compiler.$customData.logFile = logPath;
      require('fs').writeFileSync(logPath, `[${new Date().toLocaleString()}] 构建开始\n`);
    });
  }
}

module.exports = AfterEnvironmentPlugin;
```
## 7. beforeRun - 构建开始前（异步支持）
- 场景：构建前执行预处理（如清理输出目录、拉取远程资源）。
- 时机：run 命令触发后，构建开始前，支持异步操作。
```js
class BeforeRunPlugin {
  apply(compiler) {
    // 异步钩子：使用 tapAsync 注册，通过 callback 结束
    compiler.hooks.beforeRun.tapAsync('BeforeRunPlugin', (compiler, callback) => {
      console.log('📌 构建开始前：清理输出目录 + 拉取远程资源');
      const outputPath = compiler.options.output.path;
      const logFile = compiler.$customData.logFile;

      // 真实场景 1：清理输出目录（替代 clean-webpack-plugin）
      const cleanOutputDir = () => {
        if (require('fs').existsSync(outputPath)) {
          require('fs').rmSync(outputPath, { recursive: true, force: true });
          console.log(`✅ 清理输出目录：${outputPath}`);
          require('fs').appendFileSync(logFile, `[${new Date().toLocaleString()}] 清理输出目录\n`);
        }
      };

      // 真实场景 2：拉取远程配置文件（异步操作）
      const fetchRemoteConfig = () => {
        return new Promise((resolve, reject) => {
          const https = require('https');
          https.get('https://config.example.com/build-config.json', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              compiler.$customData.remoteConfig = JSON.parse(data);
              console.log('✅ 拉取远程配置成功');
              require('fs').appendFileSync(logFile, `[${new Date().toLocaleString()}] 拉取远程配置成功\n`);
              resolve();
            });
          }).on('error', (err) => {
            console.error('❌ 拉取远程配置失败', err);
            reject(err);
          });
        });
      };

      // 执行异步操作
      cleanOutputDir();
      fetchRemoteConfig().then(() => callback()).catch((err) => callback(err));
    });
  }
}

module.exports = BeforeRunPlugin;
```
## 8. run - 构建开始（异步支持）
- 场景：记录构建开始时间、启动监控（如文件变化监听）。
- 时机：beforeRun 完成后，构建正式开始，支持异步。
```js
class RunPlugin {
  apply(compiler) {
    // 异步 Promise 钩子：使用 tapPromise 注册
    compiler.hooks.run.tapPromise('RunPlugin', (compiler) => {
      console.log('📌 构建正式开始：记录时间 + 启动监控');
      return new Promise((resolve) => {
        // 真实场景 1：更新构建开始时间（精确到毫秒）
        compiler.$customData.buildStartTime = Date.now();

        // 真实场景 2：启动文件变化监控（仅开发环境）
        if (compiler.$customData.env === 'development') {
          const watchDir = require('path').resolve(__dirname, 'src');
          require('chokidar').watch(watchDir).on('change', (path) => {
            console.log(`🔄 文件变化：${path}，等待重新构建`);
          });
        }

        // 写入日志
        const logFile = compiler.$customData.logFile;
        require('fs').appendFileSync(
          logFile,
          `[${new Date().toLocaleString()}] 构建开始，环境：${compiler.$customData.env}\n`
        );

        resolve();
      });
    });
  }
}

module.exports = RunPlugin;
```
## 9. watchRun - 监听模式构建开始（异步支持）
- 场景：监听模式下的特殊处理（如热更新预热、增量构建校验）。
- 时机：watch 模式下，文件变化触发重新构建时（替代 run 钩子）。

```js
class WatchRunPlugin {
  apply(compiler) {
    compiler.hooks.watchRun.tapAsync('WatchRunPlugin', (compiler, callback) => {
      console.log('📌 监听模式构建开始：增量构建处理');
      const logFile = compiler.$customData.logFile;

      // 真实场景 1：识别变化的文件（增量构建优化）
      const changedFiles = compiler.watchFileSystem?.watcher?.getChangedFiles();
      if (changedFiles) {
        const changedList = Array.from(changedFiles);
        console.log(`✅ 变化文件：${changedList.join(', ')}`);
        require('fs').appendFileSync(
          logFile,
          `[${new Date().toLocaleString()}] 增量构建，变化文件：${changedList.join(', ')}\n`
        );
      }

      // 真实场景 2：热更新预热（如清理旧的热更新缓存）
      if (compiler.options.devServer?.hot) {
        const hotCacheDir = require('path').resolve(__dirname, '.webpack-cache/hot');
        if (require('fs').existsSync(hotCacheDir)) {
          require('fs').rmSync(hotCacheDir, { recursive: true, force: true });
        }
      }

      callback();
    });
  }
}

module.exports = WatchRunPlugin;
```
## 10. normalModuleFactory - 普通模块工厂创建
- 场景：修改普通模块（JS/TS 等）的构建规则、添加 loader、拦截模块编译。
- 时机：NormalModuleFactory 实例创建后触发，可通过工厂钩子干预模块处理。
```js
class NormalModulePlugin {
  apply(compiler) {
    compiler.hooks.normalModuleFactory.tap('NormalModulePlugin', (nmf) => {
      console.log('📌 普通模块工厂创建：修改模块编译规则');
      // 真实场景 1：为 JS 文件添加自定义 loader（动态注入）
      nmf.hooks.beforeResolve.tap('NormalModulePlugin', (data) => {
        if (data.request.endsWith('.js')) {
          // 给所有 JS 文件添加自定义 loader（需提前安装：npm i babel-loader @babel/core）
          data.loaders.push({
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          });
        }
      });

      // 真实场景 2：拦截模块编译，替换模块内容（如 mock 测试模块）
      nmf.hooks.createModule.tap('NormalModulePlugin', (data) => {
        if (data.request.includes('mock/api.js')) {
          // 替换模块内容为 mock 数据
          data._source = {
            source: () => `export default { getUser: () => ({ id: 1, name: 'mock-user' }) }`,
            size: () => 50
          };
        }
        return data;
      });
    });
  }
}

module.exports = NormalModulePlugin;
```
## 11. contextModuleFactory - 上下文模块工厂创建
- 场景：处理上下文模块（如 require.context）、限制上下文扫描范围。
- 时机：ContextModuleFactory 实例创建后触发，用于干预上下文模块解析。
```js
class ContextModulePlugin {
  apply(compiler) {
    compiler.hooks.contextModuleFactory.tap('ContextModulePlugin', (cmf) => {
      console.log('📌 上下文模块工厂创建：优化 require.context 解析');
      // 真实场景 1：限制 require.context 的扫描范围（避免扫描 node_modules）
      cmf.hooks.beforeResolve.tap('ContextModulePlugin', (data) => {
        // 禁止扫描 node_modules 目录
        if (data.request.includes('node_modules')) {
          throw new Error(`❌ 禁止在 node_modules 中使用 require.context`);
        }
        // 限制扫描深度为 3 级
        data.recursive = false; // 关闭递归扫描
        data.regExp = /\.vue$/; // 仅匹配 .vue 文件
      });

      // 真实场景 2：优化上下文模块缓存（减少重复解析）
      cmf.hooks.module.tap('ContextModulePlugin', (module) => {
        module.cacheable = true; // 开启缓存
        module.buildInfo.cacheIdentifier = `context-${Date.now()}`; // 自定义缓存标识
      });
    });
  }
}

module.exports = ContextModulePlugin;
```
## 12. beforeCompile - 编译开始前
- 场景：修改编译参数、注入全局依赖、暂停编译（如等待配置加载）。
- 时机：编译开始前，模块工厂已创建，支持异步。
```js
class BeforeCompilePlugin {
  apply(compiler) {
    compiler.hooks.beforeCompile.tapAsync('BeforeCompilePlugin', (params, callback) => {
      console.log('📌 编译开始前：修改编译参数 + 注入依赖');
      // 真实场景 1：修改编译参数（如添加自定义解析器）
      params.compilationDependencies.push(require('path').resolve(__dirname, 'src/config.js'));

      // 真实场景 2：注入全局依赖（如自动引入 polyfill）
      compiler.options.entry = {
        main: ['core-js/stable', 'regenerator-runtime/runtime', './src/index.js']
      };

      // 真实场景 3：异步等待配置加载（如从接口获取编译参数）
      setTimeout(() => {
        console.log('✅ 编译参数准备完成');
        callback();
      }, 500);
    });
  }
}

module.exports = BeforeCompilePlugin;
```
## 13. compile - 编译开始
- 场景：记录编译开始时间、启动编译监控（如编译进度）。
- 时机：beforeCompile 完成后，编译正式开始。
```js
class CompilePlugin {
  apply(compiler) {
    compiler.hooks.compile.tap('CompilePlugin', (params) => {
      console.log('📌 编译正式开始：记录编译信息');
      const logFile = compiler.$customData.logFile;
      // 记录编译参数（如模块工厂类型）
      require('fs').appendFileSync(
        logFile,
        `[${new Date().toLocaleString()}] 编译开始，模块工厂：${params.normalModuleFactory.constructor.name}\n`
      );

      // 真实场景：启动编译进度监控（模拟进度条）
      compiler.$customData.compileStartTime = Date.now();
      console.log('🔄 编译中...');
    });
  }
}

module.exports = CompilePlugin;
```
## 14. thisCompilation - 当前编译实例创建（最早的编译钩子）
- 场景：初始化编译相关数据、注册 Compilation 钩子（最早时机）。
- 时机：Compilation 实例创建后立即触发，早于 compilation 钩子。

```js
class ThisCompilationPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ThisCompilationPlugin', (compilation) => {
      console.log('📌 当前编译实例创建：初始化编译数据');
      // 真实场景 1：为 Compilation 添加自定义数据（供后续 Compilation 钩子使用）
      compilation.$customData = {
        assetsCount: 0, // 统计输出资源数量
        chunkCount: 0 // 统计 chunk 数量
      };

      // 真实场景 2：注册 Compilation 钩子（最早时机，优先于其他插件）
      compilation.hooks.assetEmitted.tap('ThisCompilationPlugin', (filename) => {
        compilation.$customData.assetsCount++;
        console.log(`📦 输出资源：${filename}`);
      });
    });
  }
}

module.exports = ThisCompilationPlugin;
```
## 15. compilation - 编译实例创建
- 场景：注册 Compilation 钩子（通用时机）、修改编译配置。
- 时机：thisCompilation 之后，Compilation 实例完全初始化。
```js
class CompilationPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap('CompilationPlugin', (compilation, params) => {
      console.log('📌 编译实例初始化完成：注册编译钩子');
      // 真实场景 1：监听 chunk 生成（统计 chunk 数量）
      compilation.hooks.chunkAsset.tap('CompilationPlugin', (chunk, filename) => {
        compilation.$customData.chunkCount++;
        console.log(`📦 生成 Chunk：${chunk.name} -> ${filename}`);
      });

      // 真实场景 2：修改模块规则（如为 CSS 文件添加 postcss-loader）
      const cssRule = compilation.options.module.rules.find(rule => rule.test.test('.css'));
      if (cssRule) {
        cssRule.use.push('postcss-loader');
      }
    });
  }
}

module.exports = CompilationPlugin;
```
## 16. make - 模块构建阶段（异步支持）
- 场景：手动添加模块、干预模块构建流程、处理循环依赖。
- 时机：Webpack 开始构建模块（递归解析依赖），支持异步。
```js
class MakePlugin {
  apply(compiler) {
    compiler.hooks.make.tapAsync('MakePlugin', (compilation, callback) => {
      console.log('📌 模块构建阶段：手动添加模块 + 处理依赖');
      const NormalModule = require('webpack/lib/NormalModule');

      // 真实场景 1：手动添加一个全局模块（如全局样式）
      const styleModule = new NormalModule(
        './src/global.css', // 模块路径
        null,
        { type: 'css/mini-extract' }, // 模块类型
        compiler.options.module.rules,
        compiler.resolverFactory.get('normal'),
        compiler.inputFileSystem,
        compiler.outputFileSystem
      );

      // 将模块添加到编译中
      compilation.addModule(styleModule);
      compilation.buildModule(styleModule, (err) => {
        if (err) return callback(err);
        console.log('✅ 手动添加全局样式模块成功');

        // 真实场景 2：处理循环依赖（打印警告）
        compilation.hooks.dependencyReference.tap('MakePlugin', (module, dependency) => {
          if (module.rawRequest === dependency.request) {
            console.warn(`⚠️  循环依赖警告：${module.rawRequest}`);
          }
        });

        callback();
      });
    });
  }
}

module.exports = MakePlugin;
```
## 17. afterCompile - 编译完成后
- 场景：优化编译产物、分析模块依赖、修改输出资源。
- 时机：所有模块构建完成，产物已生成，支持异步。
```js
class AfterCompilePlugin {
  apply(compiler) {
    compiler.hooks.afterCompile.tapAsync('AfterCompilePlugin', (compilation, callback) => {
      console.log('📌 编译完成：优化产物 + 分析依赖');
      const logFile = compiler.$customData.logFile;

      // 真实场景 1：分析模块依赖（输出依赖树）
      const dependencyTree = {};
      compilation.modules.forEach(module => {
        if (module.resource) {
          const modulePath = module.resource;
          dependencyTree[modulePath] = module.dependencies
            .filter(dep => dep.request)
            .map(dep => dep.request);
        }
      });
      // 写入依赖树到日志
      require('fs').appendFileSync(
        logFile,
        `[${new Date().toLocaleString()}] 模块依赖树：${JSON.stringify(dependencyTree, null, 2)}\n`
      );

      // 真实场景 2：优化输出资源（如压缩 JSON 文件）
      Object.keys(compilation.assets).forEach(filename => {
        if (filename.endsWith('.json')) {
          const asset = compilation.assets[filename];
          const source = asset.source();
          // 压缩 JSON
          const minifiedSource = JSON.stringify(JSON.parse(source));
          compilation.assets[filename] = {
            source: () => minifiedSource,
            size: () => minifiedSource.length
          };
          console.log(`✅ 压缩 JSON 资源：${filename}`);
        }
      });

      callback();
    });
  }
}

module.exports = AfterCompilePlugin;
```
## 18. shouldEmit - 决定是否输出产物
- 场景：根据编译结果判断是否输出（如编译错误时不输出、满足条件才输出）。
- 时机：编译完成后，输出产物前，返回 boolean 决定是否输出。
```js
class ShouldEmitPlugin {
  apply(compiler) {
    compiler.hooks.shouldEmit.tap('ShouldEmitPlugin', (compilation) => {
      console.log('📌 决定是否输出产物：校验编译结果');
      const logFile = compiler.$customData.logFile;

      // 真实场景 1：有错误时不输出产物
      if (compilation.errors.length > 0) {
        console.error('❌ 编译存在错误，取消输出产物');
        require('fs').appendFileSync(
          logFile,
          `[${new Date().toLocaleString()}] 编译错误：${compilation.errors.join('\n')}\n`
        );
        return false; // 取消输出
      }

      // 真实场景 2：警告数量超过阈值时提示（但仍输出）
      if (compilation.warnings.length > 5) {
        console.warn(`⚠️  警告数量超过 5 个：${compilation.warnings.length} 个`);
      }

      // 真实场景 3：生产环境必须有 chunk 才输出
      if (compiler.$customData.env === 'production' && compilation.chunks.length === 0) {
        console.error('❌ 生产环境无 Chunk，取消输出');
        return false;
      }

      return true; // 允许输出
    });
  }
}

module.exports = ShouldEmitPlugin;
```
## 19. emit - 输出产物前（核心钩子）
- 场景：修改输出资源、添加额外资源（如 LICENSE 文件）、删除无用资源。
- 时机：产物已准备好，即将写入磁盘，支持异步。
```js
class EmitPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('EmitPlugin', (compilation, callback) => {
      console.log('📌 输出产物前：修改资源 + 添加额外文件');
      const logFile = compiler.$customData.logFile;

      // 真实场景 1：添加 LICENSE 文件到输出目录
      const licenseContent = `MIT License\nCopyright (c) ${new Date().getFullYear()} My Company\n`;
      compilation.assets['LICENSE'] = {
        source: () => licenseContent,
        size: () => licenseContent.length
      };
      console.log('✅ 添加 LICENSE 文件');

      // 真实场景 2：删除无用资源（如 .map 源映射文件，生产环境）
      if (compiler.$customData.env === 'production') {
        Object.keys(compilation.assets).forEach(filename => {
          if (filename.endsWith('.map')) {
            delete compilation.assets[filename];
            console.log(`✅ 删除源映射文件：${filename}`);
          }
        });
      }

      // 真实场景 3：修改 HTML 文件内容（如注入构建信息）
      Object.keys(compilation.assets).forEach(filename => {
        if (filename.endsWith('.html')) {
          const asset = compilation.assets[filename];
          let html = asset.source();
          // 注入构建时间和环境
          html = html.replace(
            '</body>',
            `<div style="display:none">BUILD_TIME: ${compiler.$customData.buildStartTime}, ENV: ${compiler.$customData.env}</div></body>`
          );
          compilation.assets[filename] = {
            source: () => html,
            size: () => html.length
          };
        }
      });

      require('fs').appendFileSync(logFile, `[${new Date().toLocaleString()}] 产物准备完成，资源数：${Object.keys(compilation.assets).length}\n`);
      callback();
    });
  }
}

module.exports = EmitPlugin;
```
## 20. afterEmit - 输出产物后
- 场景：产物输出后的后续操作（如上传 CDN、通知测试环境、生成构建报告）。
- 时机：产物已写入磁盘，支持异步。
```js
class AfterEmitPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync('AfterEmitPlugin', (compilation, callback) => {
      console.log('📌 产物输出完成：上传 CDN + 生成报告');
      const outputPath = compiler.options.output.path;
      const logFile = compiler.$customData.logFile;

      // 真实场景 1：生成构建报告（JSON 格式）
      const buildReport = {
        time: Date.now() - compiler.$customData.buildStartTime, // 构建耗时（毫秒）
        env: compiler.$customData.env,
        assets: Object.keys(compilation.assets).map(filename => ({
          name: filename,
          size: compilation.assets[filename].size() / 1024 + 'KB'
        })),
        chunks: compilation.$customData.chunkCount,
        errors: compilation.errors.length,
        warnings: compilation.warnings.length
      };
      const reportPath = require('path').resolve(outputPath, 'build-report.json');
      require('fs').writeFileSync(reportPath, JSON.stringify(buildReport, null, 2));
      console.log(`✅ 生成构建报告：${reportPath}`);

      // 真实场景 2：上传 CDN（模拟异步上传）
      const uploadToCDN = () => {
        return new Promise((resolve) => {
          // 实际场景：使用 axios 或 CDN SDK 上传 outputPath 下的文件
          setTimeout(() => {
            console.log('✅ 产物上传 CDN 成功（模拟）');
            require('fs').appendFileSync(logFile, `[${new Date().toLocaleString()}] 产物上传 CDN 成功\n`);
            resolve();
          }, 1000);
        });
      };

      uploadToCDN().then(() => callback());
    });
  }
}

module.exports = AfterEmitPlugin;
```
## 21. done - 构建完成（最终钩子）
- 场景：输出构建总结、发送构建通知（如邮件、钉钉）、清理临时文件。
- 时机：所有构建流程（包括输出、上传）完成，是最终钩子。
```js
class DonePlugin {
  apply(compiler) {
    compiler.hooks.done.tap('DonePlugin', (stats) => {
      console.log('📌 构建完全结束：输出总结 + 发送通知');
      const logFile = compiler.$customData.logFile;
      const buildTime = Date.now() - compiler.$customData.buildStartTime;

      // 真实场景 1：输出构建总结
      console.log('\n=====================================');
      console.log(`构建总结（${compiler.$customData.env}）`);
      console.log(`耗时：${buildTime}ms`);
      console.log(`状态：${stats.hasErrors() ? '失败' : '成功'}`);
      console.log(`错误数：${stats.hasErrors() ? stats.errorsCount : 0}`);
      console.log(`警告数：${stats.hasWarnings() ? stats.warningsCount : 0}`);
      console.log('=====================================\n');

      // 真实场景 2：发送钉钉通知（模拟）
      const sendDingTalkNotice = () => {
        const noticeContent = `
【Webpack 构建通知】
环境：${compiler.$customData.env}
状态：${stats.hasErrors() ? '❌ 失败' : '✅ 成功'}
耗时：${buildTime}ms
错误数：${stats.errorsCount}
警告数：${stats.warningsCount}
时间：${new Date().toLocaleString()}
        `;
        console.log('📤 发送钉钉通知：', noticeContent);
        // 实际场景：使用 axios 调用钉钉机器人 API
      };

      sendDingTalkNotice();

      // 真实场景 3：清理临时文件（如缓存目录中的日志外文件）
      const cacheDir = require('path').resolve(__dirname, '.webpack-cache');
      require('fs').readdirSync(cacheDir).forEach(file => {
        if (file !== 'build.log') {
          require('fs').rmSync(require('path').resolve(cacheDir, file), { recursive: true, force: true });
        }
      });

      // 写入最终日志
      require('fs').appendFileSync(
        logFile,
        `[${new Date().toLocaleString()}] 构建完全结束，状态：${stats.hasErrors() ? '失败' : '成功'}\n`
      );
    });
  }
}

module.exports = DonePlugin;
```
## 22. failed - 构建失败
- 场景：构建失败时的异常处理（如记录错误日志、发送告警、清理半成品产物）。
- 时机：构建过程中抛出异常时触发。
```js
class FailedPlugin {
  apply(compiler) {
    compiler.hooks.failed.tap('FailedPlugin', (err) => {
      console.error('📌 构建失败：处理异常 + 发送告警');
      const logFile = compiler.$customData.logFile || require('path').resolve(__dirname, '.webpack-cache/build.log');

      // 真实场景 1：记录详细错误日志
      const errorLog = `
[${new Date().toLocaleString()}] 构建失败
错误信息：${err.message}
堆栈跟踪：${err.stack}
      `;
      require('fs').appendFileSync(logFile, errorLog);
      console.error('❌ 错误日志已写入：', logFile);

      // 真实场景 2：发送告警（如邮件 + 钉钉）
      console.log('📤 发送构建失败告警（模拟）：', err.message);
      // 实际场景：调用邮件 SDK 和钉钉 API 发送告警

      // 真实场景 3：清理半成品产物（避免残留）
      const outputPath = compiler.options.output.path;
      if (require('fs').existsSync(outputPath)) {
        require('fs').rmSync(outputPath, { recursive: true, force: true });
        console.log('✅ 清理半成品产物成功');
      }
    });
  }
}

module.exports = FailedPlugin;
```
## 23. invalid - 监听模式下文件无效
- 场景：监听模式下文件修改后，标记文件无效并触发重新构建前的处理。
- 时机：watch 模式下，文件变化触发重新构建时，先触发 invalid。
```js
class InvalidPlugin {
  apply(compiler) {
    compiler.hooks.invalid.tap('InvalidPlugin', (filename, changeTime) => {
      console.log('📌 文件无效：触发重新构建前处理');
      const logFile = compiler.$customData.logFile;

      // 真实场景 1：记录文件变化信息
      const changeInfo = `[${new Date(changeTime).toLocaleString()}] 文件变化：${filename} 无效，准备重新构建`;
      console.log(changeInfo);
      require('fs').appendFileSync(logFile, changeInfo + '\n');

      // 真实场景 2：暂停服务（如开发环境的 devServer）
      if (compiler.options.devServer) {
        console.log('⏸️  暂停 devServer 服务，等待重新构建');
      }
    });
  }
}

module.exports = InvalidPlugin;
```
## 24. watchClose - 监听模式关闭
- 场景：监听模式退出时的清理操作（如关闭服务、释放端口、保存缓存）。
- 时机：watch 模式被终止（如 Ctrl+C）时触发。
```js
class WatchClosePlugin {
  apply(compiler) {
    compiler.hooks.watchClose.tap('WatchClosePlugin', () => {
      console.log('📌 监听模式关闭：清理资源');
      const logFile = compiler.$customData.logFile;

      // 真实场景 1：保存构建缓存（供下次启动使用）
      const cacheData = {
        lastBuildTime: Date.now(),
        env: compiler.$customData.env
      };
      require('fs').writeFileSync(
        require('path').resolve(__dirname, '.webpack-cache/cache.json'),
        JSON.stringify(cacheData)
      );

      // 真实场景 2：关闭 devServer 服务（模拟）
      if (compiler.options.devServer) {
        console.log('🛑 关闭 devServer 服务');
        // 实际场景：调用 devServer.close() 方法
      }

      // 真实场景 3：释放端口（如避免端口占用）
      console.log('✅ 释放端口 8080（模拟）');

      require('fs').appendFileSync(
        logFile,
        `[${new Date().toLocaleString()}] 监听模式关闭\n`
      );
    });
  }
}

module.exports = WatchClosePlugin;
```