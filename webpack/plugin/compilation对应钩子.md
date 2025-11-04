Webpack 5 的 Compilation 钩子聚焦于模块构建、依赖解析、产物优化的核心流程，是干预编译细节的关键入口。

# 一、Compilation 钩子核心说明
- 作用域：仅作用于单次编译过程（watch 模式下每次文件变化会触发新的 Compilation 实例）。
- 依赖关系：依赖 Compiler 钩子（如 thisCompilation/compilation）注册，需在 Compiler 钩子中监听 Compilation 事件。
- 异步支持：同样支持 tap（同步）、tapAsync（回调异步）、tapPromise（Promise 异步）。
- 核心数据：compilation 实例包含 modules所有已加载的模块（可修改源代码、依赖关系）、chunks代码块（可合并、拆分、调整依赖）、assets 输出资源（可压缩、重命名、添加额外资源）等核心数据，是插件操作的核心对象。
- Compilation 钩子执行顺序：
  - 模块构建（buildModule→succeedModule）→ Chunk 生成（chunkAsset→additionalChunkAssets）→ 优化阶段（optimize→optimizeAssets）→ 完成（afterCompile）。
- 高频实用钩子：
  - 资源处理：moduleAsset（模块资源生成）、optimizeAssets（资源优化）。
  - 模块修改：succeedModule（注入代码）、optimizeModules（模块去重）。
  - Chunk 优化：chunkAsset（Chunk 资源生成）、optimizeChunks（Chunk 合并）。
- 异步处理原则：涉及文件操作、网络请求、压缩等耗时操作，必须使用 tapAsync 或 tapPromise，避免阻塞构建流程。
- 兼容性：所有示例基于 Webpack 5，依赖 Tapable 4.x API，不兼容 Webpack 4 及以下版本。

# 二、全钩子真实场景 + 插件代码示例

## 1. addEntry - 添加入口模块时
- 场景：拦截入口模块添加过程，校验入口合法性、替换入口模块内容。
- 时机：Webpack 向 Compilation 添加入口模块（如 entry 配置的模块）时触发。
```js
class EntryValidationPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('EntryValidationPlugin', (compilation) => {
      // 同步钩子：tap 注册
      compilation.hooks.addEntry.tap('EntryValidationPlugin', (context, entry, name) => {
        console.log(`📌 添加入口模块：${name} -> ${entry.request}`);
        
        // 真实场景 1：校验入口模块是否为 JS/TS 文件
        if (!/\.jsx?$|\.tsx?$/.test(entry.request)) {
          compilation.errors.push(new Error(`❌ 入口模块必须是 JS/TS 文件：${entry.request}`));
        }

        // 真实场景 2：开发环境替换入口为模拟数据（如 mock 入口）
        if (compiler.options.mode === 'development' && name === 'main') {
          entry.request = './src/mock-entry.js'; // 替换为模拟入口
          console.log(`✅ 开发环境替换入口为：${entry.request}`);
        }
      });
    });
  }
}

module.exports = EntryValidationPlugin;
```
## 2. failedEntry - 入口模块添加失败时
- 场景：捕获入口模块加载失败的异常，提供友好错误提示、自动修复（如路径补全）。
- 时机：入口模块添加失败（如文件不存在、解析错误）时触发。
```js
class EntryFailRecoveryPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('EntryFailRecoveryPlugin', (compilation) => {
      compilation.hooks.failedEntry.tap('EntryFailRecoveryPlugin', (name, err) => {
        console.error(`📌 入口模块添加失败：${name} -> ${err.message}`);
        
        // 真实场景：自动修复常见路径错误（如补全 src/ 前缀）
        if (err.message.includes('Module not found') && !err.message.includes('src/')) {
          const originalEntry = compiler.options.entry[name];
          const fixedEntry = `./src/${originalEntry.replace('./', '')}`;
          const fixedPath = require('path').resolve(compiler.context, fixedEntry);
          
          if (require('fs').existsSync(fixedPath)) {
            // 修复入口配置
            compiler.options.entry[name] = fixedEntry;
            // 重新添加入口（需手动触发）
            compilation.addEntry(compiler.context, { request: fixedEntry }, name);
            console.log(`✅ 自动修复入口路径：${originalEntry} -> ${fixedEntry}`);
          } else {
            compilation.errors.push(new Error(`❌ 无法自动修复入口：${fixedPath} 不存在`));
          }
        }
      });
    });
  }
}

module.exports = EntryFailRecoveryPlugin;
```
## 3. buildModule - 模块构建前
- 场景：修改模块构建配置（如添加 loader、禁用缓存）、过滤不需要构建的模块。
- 时机：Webpack 开始构建单个模块（编译源代码）前触发，可修改模块属性。
```js
class ModuleBuildOptimizePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ModuleBuildOptimizePlugin', (compilation) => {
      compilation.hooks.buildModule.tap('ModuleBuildOptimizePlugin', (module) => {
        console.log(`📌 开始构建模块：${module.resource || module.rawRequest}`);
        
        // 真实场景 1：对大型第三方模块禁用缓存（强制每次构建重新编译）
        if (module.resource?.includes('node_modules/large-lib')) {
          module.cacheable = false;
          console.log(`⚠️  禁用大型第三方模块缓存：${module.resource}`);
        }

        // 真实场景 2：为 CSS 模块添加 sourceMap（开发环境）
        if (compiler.options.mode === 'development' && module.type === 'css/mini-extract') {
          module.buildOptions.sourceMap = true;
        }

        // 真实场景 3：过滤无用模块（如测试文件）
        if (module.rawRequest?.includes('.test.')) {
          module.skipBuild = true; // 跳过构建
          console.log(`✅ 跳过测试模块构建：${module.rawRequest}`);
        }
      });
    });
  }
}

module.exports = ModuleBuildOptimizePlugin;
```
## 4. rebuildModule - 模块重新构建前
-  场景：监听模式下模块重新构建时的特殊处理（如增量编译优化、清理旧产物）。
- 时机：watch 模式下，模块发生变化需要重新构建前触发。
```js
class ModuleRebuildPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ModuleRebuildPlugin', (compilation) => {
      compilation.hooks.rebuildModule.tap('ModuleRebuildPlugin', (module) => {
        console.log(`📌 重新构建模块：${module.resource}`);
        
        // 真实场景 1：清理模块旧的依赖缓存（避免增量编译残留）
        if (module.dependencies) {
          module.dependencies = module.dependencies.filter(dep => !dep.request?.includes('cache/'));
        }

        // 真实场景 2：记录重新构建次数（用于统计热更新频率）
        module.rebuildCount = (module.rebuildCount || 0) + 1;
        if (module.rebuildCount > 5) {
          compilation.warnings.push(new Warning(`⚠️  模块 ${module.resource} 已重新构建 5 次，可能存在循环依赖`));
        }
      });
    });
  }
}

module.exports = ModuleRebuildPlugin;
```
## 5. finishRebuildingModule - 模块重新构建完成后
- 场景：模块重新构建完成后，验证构建结果、优化产物。
- 时机：watch 模式下，模块重新构建完成后触发。
```js
class ModuleRebuildFinishPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ModuleRebuildFinishPlugin', (compilation) => {
      compilation.hooks.finishRebuildingModule.tap('ModuleRebuildFinishPlugin', (module) => {
        console.log(`📌 模块重新构建完成：${module.resource}`);
        
        // 真实场景：验证重新构建后的模块大小（避免产物膨胀）
        const moduleSize = module._source?.size() || 0;
        if (moduleSize > 1024 * 100) { // 超过 100KB
          compilation.warnings.push(new Warning(`⚠️  模块 ${module.resource} 体积过大：${(moduleSize / 1024).toFixed(2)}KB`));
        }
      });
    });
  }
}

module.exports = ModuleRebuildFinishPlugin;
```
## 6. succeedModule - 模块构建成功时
- 场景：模块构建成功后，修改模块内容（如注入代码、替换变量）、分析模块依赖。
- 时机：单个模块构建成功（无错误）后触发，可访问模块的源代码。
```js
class ModuleCodeInjectPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ModuleCodeInjectPlugin', (compilation) => {
      compilation.hooks.succeedModule.tap('ModuleCodeInjectPlugin', (module) => {
        // 仅处理 JS 模块
        if (!module.resource?.endsWith('.js')) return;
        
        console.log(`📌 模块构建成功：${module.resource}`);
        const source = module._source?.source();
        if (!source) return;
        
        // 真实场景 1：注入构建信息（如模块路径、构建时间）
        const injectCode = `
// 注入的构建信息
const __MODULE_INFO__ = {
  path: '${module.resource}',
  buildTime: '${new Date().toLocaleString()}',
  env: '${compiler.options.mode}'
};
`;
        const newSource = injectCode + source;
        module._source = {
          source: () => newSource,
          size: () => newSource.length
        };

        // 真实场景 2：替换环境变量（如将 process.env.API_BASE 替换为真实地址）
        if (compiler.options.mode === 'production') {
          const replacedSource = newSource.replace(
            /process\.env\.API_BASE/g,
            JSON.stringify('https://prod-api.example.com')
          );
          module._source = {
            source: () => replacedSource,
            size: () => replacedSource.length
          };
        }
      });
    });
  }
}

module.exports = ModuleCodeInjectPlugin;
```
## 7. failedModule - 模块构建失败时
- 场景：捕获模块构建失败的异常，提供错误定位、自动修复（如安装缺失依赖）。
- 时机：单个模块构建失败（如语法错误、loader 异常）时触发。
```js
class ModuleFailHandlerPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ModuleFailHandlerPlugin', (compilation) => {
      compilation.hooks.failedModule.tap('ModuleFailHandlerPlugin', (module, err) => {
        const modulePath = module.resource || module.rawRequest;
        console.error(`📌 模块构建失败：${modulePath} -> ${err.message}`);
        
        // 真实场景 1：识别缺失依赖错误，提示安装命令
        if (err.message.includes('Cannot find module') && err.message.includes('from')) {
          const depName = err.message.match(/Cannot find module '([^']+)'/)?.[1];
          if (depName) {
            compilation.warnings.push(new Warning(`⚠️  缺失依赖 ${depName}，请执行：npm install ${depName} --save`));
          }
        }

        // 真实场景 2：语法错误定位（提取错误行号和代码）
        if (err.message.includes('SyntaxError')) {
          const lineMatch = err.message.match(/Line (\d+):/);
          if (lineMatch) {
            const lineNum = lineMatch[1];
            const sourceLines = module._source?.source()?.split('\n') || [];
            const errorLine = sourceLines[lineNum - 1] || '';
            compilation.errors.push(new Error(`❌ 语法错误：第 ${lineNum} 行 -> ${errorLine}\n${err.stack}`));
          }
        }
      });
    });
  }
}

module.exports = ModuleFailHandlerPlugin;
```
## 8. moduleAsset - 模块生成资源时
- 场景：模块生成独立资源（如图片、字体）时，修改资源名称、优化资源内容（如压缩图片）。
- 时机：非 JS 模块（如图片、CSS）构建后生成独立资源时触发。
```js
const sharp = require('sharp'); // 需安装：npm install sharp --save-dev

class AssetOptimizePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('AssetOptimizePlugin', (compilation) => {
      // 异步钩子：使用 tapAsync 处理图片压缩（异步操作）
      compilation.hooks.moduleAsset.tapAsync('AssetOptimizePlugin', (module, filename, asset, callback) => {
        console.log(`📌 模块生成资源：${filename}`);
        
        // 真实场景 1：压缩图片资源（JPG/PNG）
        if (/\.jpe?g$|\.png$/.test(filename)) {
          const source = asset.source(); // 图片二进制数据
          
          sharp(source)
            .resize(1920, null, { fit: 'inside' }) // 限制最大宽度 1920px
            .jpeg({ quality: 80 })
            .png({ quality: 80 })
            .toBuffer()
            .then((compressedBuffer) => {
              // 替换资源为压缩后的内容
              compilation.assets[filename] = {
                source: () => compressedBuffer,
                size: () => compressedBuffer.length
              };
              console.log(`✅ 压缩图片：${filename}（原大小：${source.length}B → 新大小：${compressedBuffer.length}B）`);
              callback();
            })
            .catch((err) => {
              console.error(`❌ 图片压缩失败：${filename} -> ${err.message}`);
              callback();
            });
        }

        // 真实场景 2：修改资源文件名（添加 hash 防缓存）
        else if (/\.woff2?$|\.ttf$/.test(filename)) {
          const hash = require('crypto').createHash('md5').update(asset.source()).digest('hex').slice(0, 8);
          const newFilename = `${filename.replace(/(\.\w+)$/, `-${hash}$1`)}`;
          // 替换资源名称
          delete compilation.assets[filename];
          compilation.assets[newFilename] = asset;
          console.log(`✅ 字体资源重命名：${filename} -> ${newFilename}`);
          callback();
        } else {
          callback();
        }
      });
    });
  }
}

module.exports = AssetOptimizePlugin;
```
## 9. chunkAsset - 代码块生成资源时
- 场景：代码块（Chunk）生成最终 JS/CSS 资源时，修改资源内容（如注入版权信息）、过滤无用代码。
- 时机：Chunk 合并模块后生成最终资源（如 main.js、chunk-1.js）时触发。
```js
class ChunkAssetModifyPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ChunkAssetModifyPlugin', (compilation) => {
      compilation.hooks.chunkAsset.tap('ChunkAssetModifyPlugin', (chunk, filename) => {
        console.log(`📌 代码块生成资源：${chunk.name || chunk.id} -> ${filename}`);
        const asset = compilation.assets[filename];
        if (!asset) return;
        
        // 真实场景 1：注入版权注释（生产环境）
        if (compiler.options.mode === 'production' && filename.endsWith('.js')) {
          const source = asset.source();
          const copyright = `
/*!
 * 产品名称：My App
 * 版本：${compiler.options.output.version || '1.0.0'}
 * 构建时间：${new Date().toLocaleString()}
 * 版权所有：© ${new Date().getFullYear()} My Company
 */
`;
          const newSource = copyright + source;
          compilation.assets[filename] = {
            source: () => newSource,
            size: () => newSource.length
          };
        }

        // 真实场景 2：过滤开发环境代码（如去掉 console.log）
        if (compiler.options.mode === 'production' && filename.endsWith('.js')) {
          const source = asset.source();
          const cleanedSource = source.replace(/console\.log\([^)]*\);?/g, '');
          compilation.assets[filename] = {
            source: () => cleanedSource,
            size: () => cleanedSource.length
          };
          console.log(`✅ 清理 console.log：${filename}`);
        }

        // 真实场景 3：CSS 资源添加浏览器前缀（补全 autoprefixer 功能）
        if (filename.endsWith('.css')) {
          const postcss = require('postcss');
          const autoprefixer = require('autoprefixer'); // 需安装：npm install postcss autoprefixer --save-dev
          
          postcss([autoprefixer])
            .process(asset.source(), { from: filename })
            .then((result) => {
              compilation.assets[filename] = {
                source: () => result.css,
                size: () => result.css.length
              };
            });
        }
      });
    });
  }
}

module.exports = ChunkAssetModifyPlugin;
```
## 10. additionalChunkAssets - 额外代码块资源生成后
- 场景：添加额外的 Chunk 资源（如公共依赖 Chunk、动态导入 Chunk）后，优化资源加载顺序。
- 时机：Webpack 生成额外 Chunk 资源（如 runtimeChunk、splitChunk 拆分的 Chunk）后触发。
```js
class AdditionalChunkOptPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('AdditionalChunkOptPlugin', (compilation) => {
      compilation.hooks.additionalChunkAssets.tap('AdditionalChunkOptPlugin', (chunks) => {
        console.log(`📌 生成额外代码块资源：共 ${chunks.length} 个 Chunk`);
        
        // 真实场景 1：标记 runtimeChunk 为预加载（提升加载速度）
        chunks.forEach((chunk) => {
          if (chunk.name === 'runtime') {
            chunk.files.forEach((filename) => {
              const asset = compilation.assets[filename];
              if (asset) {
                // 为 runtime.js 添加 preload 注释（供 HtmlWebpackPlugin 识别）
                asset._preload = true;
                console.log(`✅ 标记 runtime 资源为预加载：${filename}`);
              }
            });
          }
        });

        // 真实场景 2：合并小型 Chunk（避免过多小文件）
        const smallChunks = chunks.filter(chunk => {
          const chunkSize = chunk.files.reduce((sum, file) => sum + (compilation.assets[file]?.size() || 0), 0);
          return chunkSize < 1024 * 10; // 小于 10KB 的 Chunk
        });

        if (smallChunks.length > 3) {
          console.log(`⚠️  存在 ${smallChunks.length} 个小型 Chunk，建议合并`);
          // 实际场景：可通过 compilation.mergeChunks() 合并（需手动处理依赖）
        }
      });
    });
  }
}

module.exports = AdditionalChunkOptPlugin;
```
## 11. recordModules - 记录模块信息时
- 场景：自定义模块缓存标识、记录模块构建元信息（如构建时间、依赖版本）。
- 时机：Webpack 记录模块信息（用于缓存）时触发，可修改模块的 buildInfo。
```js
class ModuleRecordPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ModuleRecordPlugin', (compilation) => {
      compilation.hooks.recordModules.tap('ModuleRecordPlugin', (modules, records) => {
        console.log(`📌 记录模块信息：共 ${modules.length} 个模块`);
        
        // 真实场景 1：自定义模块缓存标识（结合依赖版本）
        modules.forEach((module) => {
          if (module.resource?.includes('node_modules')) {
            const depName = module.resource.match(/node_modules\/([^/]+)/)?.[1];
            if (depName) {
              // 读取依赖版本（从 package.json）
              const pkgPath = require('path').resolve(compiler.context, 'node_modules', depName, 'package.json');
              let depVersion = 'unknown';
              try {
                depVersion = require(pkgPath).version;
              } catch (e) {}
              
              // 自定义缓存标识：模块路径 + 依赖版本
              module.buildInfo.cacheIdentifier = `${module.resource}-${depVersion}`;
            }
          }
        });

        // 真实场景 2：记录模块构建元信息到 records（供下次构建使用）
        records.moduleMeta = records.moduleMeta || {};
        modules.forEach((module) => {
          if (module.resource) {
            records.moduleMeta[module.resource] = {
              buildTime: Date.now(),
              size: module._source?.size() || 0,
              rebuildCount: module.rebuildCount || 0
            };
          }
        });
      });
    });
  }
}

module.exports = ModuleRecordPlugin;
```
## 12. recordChunks - 记录代码块信息时
- 场景：记录 Chunk 依赖关系、输出 Chunk 分析报告、自定义 Chunk 缓存策略。
- 时机：Webpack 记录 Chunk 信息（用于缓存）时触发，可修改 Chunk 的 buildInfo。
```js
class ChunkRecordPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ChunkRecordPlugin', (compilation) => {
      compilation.hooks.recordChunks.tap('ChunkRecordPlugin', (chunks, records) => {
        console.log(`📌 记录代码块信息：共 ${chunks.length} 个 Chunk`);
        
        // 真实场景 1：生成 Chunk 分析报告（输出依赖模块数、大小）
        const chunkReport = chunks.map((chunk) => ({
          name: chunk.name || chunk.id,
          files: chunk.files,
          moduleCount: chunk.modules.length,
          size: chunk.files.reduce((sum, file) => sum + (compilation.assets[file]?.size() || 0), 0) / 1024 + 'KB',
          modules: chunk.modules.map(m => m.resource || m.rawRequest)
        }));
        
        // 写入报告文件
        const reportPath = require('path').resolve(compiler.options.output.path, 'chunk-report.json');
        compilation.assets['chunk-report.json'] = {
          source: () => JSON.stringify(chunkReport, null, 2),
          size: () => JSON.stringify(chunkReport).length
        };
        console.log(`✅ 生成 Chunk 分析报告：chunk-report.json`);

        // 真实场景 2：自定义 Chunk 缓存标识（结合模块哈希）
        chunks.forEach((chunk) => {
          const moduleHashes = chunk.modules.map(m => m.buildInfo.hash || '').join('');
          chunk.buildInfo.cacheIdentifier = require('crypto').createHash('md5').update(moduleHashes).digest('hex');
        });
      });
    });
  }
}

module.exports = ChunkRecordPlugin;
```
## 13. beforeChunkAssets - 生成 Chunk 资源前
- 场景：修改 Chunk 结构（如添加 / 删除模块）、调整 Chunk 名称、拆分大型 Chunk。
- 时机：Webpack 开始生成 Chunk 资源前触发，此时 Chunk 已合并模块但未生成文件。
```js
class ChunkPreprocessPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ChunkPreprocessPlugin', (compilation) => {
      compilation.hooks.beforeChunkAssets.tap('ChunkPreprocessPlugin', () => {
        console.log(`📌 生成 Chunk 资源前：预处理 Chunk 结构`);
        
        // 真实场景 1：拆分大型 Chunk（超过 500KB 拆分公共模块）
        compilation.chunks.forEach((chunk) => {
          const chunkSize = chunk.modules.reduce((sum, module) => sum + (module._source?.size() || 0), 0);
          if (chunkSize > 1024 * 500) { // 超过 500KB
            // 提取公共模块（如 lodash、axios）
            const commonModules = chunk.modules.filter(m => m.resource?.includes('node_modules/lodash') || m.resource?.includes('node_modules/axios'));
            if (commonModules.length > 0) {
              // 创建新 Chunk 存放公共模块
              const commonChunk = compilation.addChunk('common-' + chunk.name);
              commonModules.forEach(module => {
                chunk.removeModule(module);
                commonChunk.addModule(module);
                module.addChunk(commonChunk);
              });
              console.log(`✅ 拆分大型 Chunk：${chunk.name} -> 公共模块 Chunk：common-${chunk.name}`);
            }
          }
        });

        // 真实场景 2：修改 Chunk 名称（添加环境前缀）
        compilation.chunks.forEach((chunk) => {
          if (chunk.name) {
            chunk.name = `${compiler.options.mode}-${chunk.name}`;
            // 更新 Chunk 文件名
            chunk.files = chunk.files.map(file => file.replace(chunk.id, chunk.name));
          }
        });
      });
    });
  }
}

module.exports = ChunkPreprocessPlugin;
```
## 14. afterChunkAssets - 生成 Chunk 资源后
- 场景：优化 Chunk 资源内容（如代码压缩、Tree-Shaking 补充）、修改资源文件名。
- 时机：Webpack 生成 Chunk 资源（JS/CSS 文件）后触发，可直接修改输出资源。
```js
const Terser = require('terser'); // 需安装：npm install terser --save-dev

class ChunkPostOptPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ChunkPostOptPlugin', (compilation) => {
      // 异步钩子：代码压缩是异步操作
      compilation.hooks.afterChunkAssets.tapAsync('ChunkPostOptPlugin', (callback) => {
        console.log(`📌 生成 Chunk 资源后：优化资源内容`);
        const jsAssets = Object.keys(compilation.assets).filter(file => file.endsWith('.js'));
        
        // 批量压缩 JS 资源
        Promise.all(
          jsAssets.map(async (filename) => {
            const asset = compilation.assets[filename];
            const source = asset.source();
            
            // 真实场景 1：使用 Terser 压缩 JS（替代 TerserPlugin）
            const minified = await Terser.minify(source, {
              compress: { drop_console: true }, // 移除 console
              mangle: true // 混淆变量名
            });
            
            if (minified.error) throw minified.error;
            
            // 替换为压缩后的资源
            compilation.assets[filename] = {
              source: () => minified.code,
              size: () => minified.code.length
            };
            console.log(`✅ 压缩 JS 资源：${filename}（原大小：${source.length}B → 新大小：${minified.code.length}B）`);
          })
        )
          .then(() => callback())
          .catch((err) => {
            compilation.errors.push(new Error(`❌ JS 压缩失败：${err.message}`));
            callback();
          });
      });
    });
  }
}

module.exports = ChunkPostOptPlugin;
```
## 15. optimize - 优化阶段开始
- 场景：初始化优化工具、配置优化参数（如 Tree-Shaking 规则、代码分割策略）。
- 时机：Webpack 进入优化阶段（包括模块优化、Chunk 优化、资源优化）前触发。
```js
class OptimizeInitPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('OptimizeInitPlugin', (compilation) => {
      compilation.hooks.optimize.tap('OptimizeInitPlugin', () => {
        console.log(`📌 进入优化阶段：配置优化规则`);
        
        // 真实场景 1：启用 Tree-Shaking（强制删除未使用代码）
        compilation.options.optimization.usedExports = true;
        compilation.options.optimization.sideEffects = true;

        // 真实场景 2：配置代码分割策略（动态导入Chunk命名规则）
        compilation.options.optimization.splitChunks = {
          chunks: 'all',
          minSize: 1024 * 20, // 20KB 以上才分割
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10
            }
          }
        };

        // 真实场景 3：初始化自定义优化工具（如 CSS 提取工具）
        if (!compilation.$optimizeTools) {
          compilation.$optimizeTools = {
            cssExtract: require('mini-css-extract-plugin').loader, // 需安装 mini-css-extract-plugin
            startedAt: Date.now()
          };
        }
      });
    });
  }
}

module.exports = OptimizeInitPlugin;
```
## 16. optimizeModules - 优化模块时
- 场景：模块级别优化（如去重重复模块、删除未使用模块、合并相似模块）。
- 时机：Webpack 优化模块集合时触发，可遍历 compilation.modules 进行修改。
```js
class ModuleOptimizePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ModuleOptimizePlugin', (compilation) => {
      compilation.hooks.optimizeModules.tap('ModuleOptimizePlugin', (modules) => {
        console.log(`📌 优化模块：共 ${modules.length} 个模块`);
        
        // 真实场景 1：去重重复模块（相同资源的模块只保留一个）
        const moduleMap = new Map();
        const duplicateModules = [];
        
        modules.forEach((module) => {
          if (module.resource) {
            if (moduleMap.has(module.resource)) {
              duplicateModules.push(module);
            } else {
              moduleMap.set(module.resource, module);
            }
          }
        });
        
        // 删除重复模块
        duplicateModules.forEach((module) => {
          compilation.modules = compilation.modules.filter(m => m !== module);
          console.log(`✅ 移除重复模块：${module.resource}`);
        });

        // 真实场景 2：删除未使用模块（Tree-Shaking 补充）
        const unusedModules = modules.filter(module => !module.used && module.resource?.includes('src/'));
        unusedModules.forEach((module) => {
          compilation.modules = compilation.modules.filter(m => m !== module);
          console.log(`✅ 移除未使用模块：${module.resource}`);
        });
      });
    });
  }
}

module.exports = ModuleOptimizePlugin;
```
## 17. optimizeModulesBasic - 基础模块优化时
- 场景：基础级别模块优化（如模块依赖排序、简化模块标识符），适合简单优化逻辑。
- 时机：optimizeModules 之前的基础优化阶段，优先级高于复杂优化。
```js
class BasicModuleOptPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('BasicModuleOptPlugin', (compilation) => {
      compilation.hooks.optimizeModulesBasic.tap('BasicModuleOptPlugin', (modules) => {
        console.log(`📌 基础模块优化：简化模块标识符`);
        
        // 真实场景：简化模块标识符（缩短模块路径，减少产物体积）
        modules.forEach((module) => {
          if (module.resource) {
            // 将绝对路径替换为相对路径（相对于项目根目录）
            const relativePath = require('path').relative(compiler.context, module.resource);
            module.identifier = () => relativePath; // 重写模块标识符
          }
        });
      });
    });
  }
}

module.exports = BasicModuleOptPlugin;
```
## 18. optimizeModulesAdvanced - 高级模块优化时
- 场景：复杂模块优化（如模块合并、依赖注入优化、动态导入处理）。
- 时机：optimizeModulesBasic 之后，optimizeModules 之前的高级优化阶段。
```js
class AdvancedModuleOptPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('AdvancedModuleOptPlugin', (compilation) => {
      compilation.hooks.optimizeModulesAdvanced.tap('AdvancedModuleOptPlugin', (modules) => {
        console.log(`📌 高级模块优化：合并相似模块`);
        
        // 真实场景：合并小型工具模块（如多个工具函数模块合并为一个）
        const toolModules = modules.filter(module => 
          module.resource?.includes('src/utils/') && module._source?.size() < 1024 * 5 // 小于 5KB
        );
        
        if (toolModules.length > 3) {
          // 创建合并后的模块
          const mergedSource = toolModules.map(module => module._source?.source() || '').join('\n');
          const mergedModule = compilation.createModule({
            resource: './src/utils/merged-utils.js',
            type: 'javascript/auto'
          });
          mergedModule._source = {
            source: () => mergedSource,
            size: () => mergedSource.length
          };
          
          // 替换原有工具模块
          toolModules.forEach(module => {
            compilation.modules = compilation.modules.filter(m => m !== module);
          });
          compilation.modules.push(mergedModule);
          console.log(`✅ 合并 ${toolModules.length} 个工具模块为：merged-utils.js`);
        }
      });
    });
  }
}

module.exports = AdvancedModuleOptPlugin;
```
## 19. optimizeChunks - 优化代码块时
- 场景：Chunk 级别优化（如合并 Chunk、拆分 Chunk、调整 Chunk 依赖）。
- 时机：Webpack 优化 Chunk 集合时触发，可遍历 compilation.chunks 进行修改。
```js
class ChunkOptimizePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('ChunkOptimizePlugin', (compilation) => {
      compilation.hooks.optimizeChunks.tap('ChunkOptimizePlugin', (chunks) => {
        console.log(`📌 优化代码块：共 ${chunks.length} 个 Chunk`);
        
        // 真实场景 1：合并小型 Chunk（小于 10KB 的 Chunk 合并为 common.js）
        const smallChunks = Array.from(chunks).filter(chunk => {
          const size = chunk.files.reduce((sum, file) => sum + (compilation.assets[file]?.size() || 0), 0);
          return size < 1024 * 10 && !chunk.name?.includes('runtime');
        });
        
        if (smallChunks.length > 2) {
          const commonChunk = compilation.addChunk('common');
          smallChunks.forEach(chunk => {
            // 转移模块到 commonChunk
            chunk.modules.forEach(module => {
              commonChunk.addModule(module);
              module.addChunk(commonChunk);
            });
            // 删除原小型 Chunk
            compilation.chunks.delete(chunk);
            // 删除原 Chunk 资源
            chunk.files.forEach(file => delete compilation.assets[file]);
          });
          console.log(`✅ 合并 ${smallChunks.length} 个小型 Chunk 为：common.js`);
        }

        // 真实场景 2：调整 Chunk 依赖顺序（runtimeChunk 优先加载）
        const runtimeChunk = Array.from(chunks).find(chunk => chunk.name === 'runtime');
        if (runtimeChunk) {
          chunks.delete(runtimeChunk);
          chunks.add(runtimeChunk); // 移到最后，确保输出时优先处理
        }
      });
    });
  }
}

module.exports = ChunkOptimizePlugin;
```
## 20. optimizeChunksBasic - 基础代码块优化时
- 场景：基础级别 Chunk 优化（如 Chunk 名称标准化、依赖关系梳理）。
- 时机：optimizeChunks 之前的基础优化阶段。
```js
class BasicChunkOptPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('BasicChunkOptPlugin', (compilation) => {
      compilation.hooks.optimizeChunksBasic.tap('BasicChunkOptPlugin', (chunks) => {
        console.log(`📌 基础代码块优化：标准化 Chunk 名称`);
        
        // 真实场景：为无名称 Chunk 分配有意义的名称（基于模块内容）
        Array.from(chunks).forEach((chunk, index) => {
          if (!chunk.name) {
            const moduleHashes = Array.from(chunk.modules)
              .map(m => m.buildInfo.hash || '')
              .join('');
            const chunkHash = require('crypto').createHash('md5').update(moduleHashes).digest('hex').slice(0, 6);
            chunk.name = `chunk-${chunkHash}`;
            console.log(`✅ 为无名称 Chunk 分配名称：${chunk.name}`);
          }
        });
      });
    });
  }
}

module.exports = BasicChunkOptPlugin;
```
## 21. optimizeChunksAdvanced - 高级代码块优化时
- 场景：复杂 Chunk 优化（如动态导入依赖处理、Chunk 预加载配置）。
- 时机：optimizeChunksBasic 之后，optimizeChunks 之前的高级优化阶段。
```js
class AdvancedChunkOptPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('AdvancedChunkOptPlugin', (compilation) => {
      compilation.hooks.optimizeChunksAdvanced.tap('AdvancedChunkOptPlugin', (chunks) => {
        console.log(`📌 高级代码块优化：配置 Chunk 预加载`);
        
        // 真实场景：为动态导入的 Chunk 添加预加载注释（供 HtmlWebpackPlugin 识别）
        Array.from(chunks).forEach((chunk) => {
          if (chunk.name?.startsWith('chunk-') && !chunk.name.includes('runtime')) {
            chunk.files.forEach((filename) => {
              const asset = compilation.assets[filename];
              if (asset) {
                asset._preload = {
                  rel: 'prefetch', // prefetch 预加载（空闲时加载）
                  as: 'script'
                };
                console.log(`✅ 为 Chunk ${chunk.name} 添加 prefetch 预加载`);
              }
            });
          }
        });
      });
    });
  }
}

module.exports = AdvancedChunkOptPlugin;
```
## 22. optimizeTree - 优化模块依赖树时
- 场景：修改模块依赖关系（如替换依赖、删除循环依赖）、优化依赖树结构。
- 时机：Webpack 优化模块依赖树时触发，是干预依赖关系的关键钩子。
```js
class DependencyTreeOptPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('DependencyTreeOptPlugin', (compilation) => {
      // 异步钩子：处理依赖树可能涉及异步操作
      compilation.hooks.optimizeTree.tapAsync('DependencyTreeOptPlugin', (chunks, modules, callback) => {
        console.log(`📌 优化模块依赖树：共 ${modules.length} 个模块`);
        
        // 真实场景 1：替换生产环境依赖（如将 lodash 替换为 lodash-es，减小体积）
        modules.forEach((module) => {
          if (module.resource?.includes('node_modules/lodash/')) {
            // 替换模块路径为 lodash-es
            const newResource = module.resource.replace('lodash/', 'lodash-es/');
            if (require('fs').existsSync(newResource)) {
              module.resource = newResource;
              console.log(`✅ 替换依赖：lodash -> lodash-es（${module.resource}）`);
            }
          }
        });

        // 真实场景 2：检测并警告循环依赖
        const dependencyGraph = new Map();
        modules.forEach((module) => {
          const deps = module.dependencies
            .filter(dep => dep.module)
            .map(dep => dep.module.resource || dep.module.rawRequest);
          dependencyGraph.set(module.resource || module.rawRequest, deps);
        });

        // 简单循环依赖检测（深度优先搜索）
        const detectCycle = (node, path = []) => {
          if (path.includes(node)) {
            const cycle = [...path.slice(path.indexOf(node)), node].join(' → ');
            compilation.warnings.push(new Warning(`⚠️  循环依赖 detected：${cycle}`));
            return;
          }
          const deps = dependencyGraph.get(node) || [];
          deps.forEach(dep => detectCycle(dep, [...path, node]));
        };

        dependencyGraph.forEach((_, node) => detectCycle(node));

        callback();
      });
    });
  }
}

module.exports = DependencyTreeOptPlugin;
```
## 23. optimizeAssets - 优化输出资源时
- 场景：资源级别优化（如压缩、混淆、添加哈希、替换内容），是最常用的钩子之一。
- 时机：所有资源生成后，输出到磁盘前触发，可修改 compilation.assets。
```js
const cssnano = require('cssnano'); // 需安装：npm install cssnano --save-dev

class AssetOptimizeFinalPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('AssetOptimizeFinalPlugin', (compilation) => {
      // 异步钩子：处理资源优化（如 CSS 压缩、图片Base64编码）
      compilation.hooks.optimizeAssets.tapAsync('AssetOptimizeFinalPlugin', (assets, callback) => {
        console.log(`📌 优化输出资源：共 ${Object.keys(assets).length} 个资源`);
        const assetKeys = Object.keys(assets);
        
        Promise.all(
          assetKeys.map(async (filename) => {
            const asset = assets[filename];
            const source = asset.source();
            
            // 真实场景 1：压缩 CSS 资源
            if (filename.endsWith('.css')) {
              const minified = await cssnano.process(source, { preset: 'default' });
              compilation.assets[filename] = {
                source: () => minified.css,
                size: () => minified.css.length
              };
              console.log(`✅ 压缩 CSS 资源：${filename}（原大小：${source.length}B → 新大小：${minified.css.length}B）`);
            }

            // 真实场景 2：小图片转为 Base64（减少 HTTP 请求）
            if (/\.jpe?g$|\.png$/.test(filename) && source.length < 1024 * 8) { // 小于 8KB
              const base64 = `data:image/${filename.split('.').pop()};base64,${source.toString('base64')}`;
              // 替换资源为 Base64（需同步修改引用该图片的模块）
              compilation.assets[filename] = {
                source: () => base64,
                size: () => base64.length
              };
              console.log(`✅ 小图片转 Base64：${filename}`);
            }

            // 真实场景 3：为资源添加内容哈希（防缓存）
            if (!filename.includes('[hash]') && (filename.endsWith('.js') || filename.endsWith('.css'))) {
              const hash = require('crypto').createHash('md5').update(source).digest('hex').slice(0, 8);
              const newFilename = filename.replace(/(\.\w+)$/, `-${hash}$1`);
              // 替换资源名称
              delete compilation.assets[filename];
              compilation.assets[newFilename] = asset;
              console.log(`✅ 资源添加哈希：${filename} -> ${newFilename}`);
            }
          })
        )
          .then(() => callback())
          .catch((err) => {
            compilation.errors.push(new Error(`❌ 资源优化失败：${err.message}`));
            callback();
          });
      });
    });
  }
}

module.exports = AssetOptimizeFinalPlugin;
```
## 24. afterOptimizeAssets - 优化输出资源后
- 场景：验证优化结果、清理临时资源、生成资源清单（如 manifest.json）。
- 时机：所有资源优化完成后触发。
```js
class AfterAssetOptPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('AfterAssetOptPlugin', (compilation) => {
      compilation.hooks.afterOptimizeAssets.tap('AfterAssetOptPlugin', (assets) => {
        console.log(`📌 资源优化完成：验证结果 + 生成清单`);
        
        // 真实场景 1：验证资源大小（禁止过大资源）
        Object.entries(assets).forEach(([filename, asset]) => {
          const size = asset.size();
          if (size > 1024 * 1024) { // 超过 1MB
            compilation.warnings.push(new Warning(`⚠️  资源 ${filename} 体积过大：${(size / 1024).toFixed(2)}KB`));
          }
        });

        // 真实场景 2：生成资源清单（manifest.json）
        const manifest = {
          buildTime: new Date().toLocaleString(),
          env: compiler.options.mode,
          assets: Object.entries(assets).map(([filename, asset]) => ({
            filename,
            size: asset.size() + 'B',
            hash: require('crypto').createHash('md5').update(asset.source()).digest('hex').slice(0, 16)
          }))
        };
        
        compilation.assets['manifest.json'] = {
          source: () => JSON.stringify(manifest, null, 2),
          size: () => JSON.stringify(manifest).length
        };
        console.log(`✅ 生成资源清单：manifest.json`);

        // 真实场景 3：清理临时资源（如 .map 文件，生产环境）
        if (compiler.options.mode === 'production') {
          Object.keys(assets).forEach((filename) => {
            if (filename.endsWith('.map')) {
              delete compilation.assets[filename];
              console.log(`✅ 清理临时资源：${filename}`);
            }
          });
        }
      });
    });
  }
}

module.exports = AfterAssetOptPlugin;
```
## 25. afterCompile - Compilation 完成后
- 场景：Compilation 流程全部完成后，进行最终清理、统计编译结果。
- 时机：Compilation 所有阶段（构建、优化、资源生成）完成后触发，是 Compilation 的最终钩子。
```js
class CompilationFinishPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('CompilationFinishPlugin', (compilation) => {
      compilation.hooks.afterCompile.tap('CompilationFinishPlugin', () => {
        console.log(`📌 Compilation 流程完成：统计编译结果`);
        
        // 真实场景 1：输出编译统计信息
        const stats = {
          modules: compilation.modules.length,
          chunks: compilation.chunks.size,
          assets: Object.keys(compilation.assets).length,
          errors: compilation.errors.length,
          warnings: compilation.warnings.length,
          totalSize: Object.values(compilation.assets).reduce((sum, asset) => sum + asset.size(), 0) / 1024 / 1024 + 'MB'
        };
        
        console.log('\n=====================================');
        console.log('Compilation 统计结果');
        console.log(`模块数：${stats.modules}`);
        console.log(`Chunk 数：${stats.chunks}`);
        console.log(`资源数：${stats.assets}`);
        console.log(`总大小：${stats.totalSize}`);
        console.log(`错误数：${stats.errors}`);
        console.log(`警告数：${stats.warnings}`);
        console.log('=====================================\n');

        // 真实场景 2：清理 Compilation 临时数据（释放内存）
        delete compilation.$optimizeTools;
        delete compilation.$customData;

        // 真实场景 3：如果有错误，停止构建流程
        if (compilation.errors.length > 0) {
          throw new Error(`❌ Compilation 失败：共 ${compilation.errors.length} 个错误`);
        }
      });
    });
  }
}

module.exports = CompilationFinishPlugin;
```