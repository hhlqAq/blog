Webpack Plugin 钩子触发顺序
# 一、核心前提
- 钩子分类：
  - Compiler 钩子：作用于 整个构建生命周期（全局唯一，如初始化、启动、完成）；
  - Compilation 钩子：作用于 单次编译过程（watch 模式下每次文件变化会触发新的 Compilation）。
- 触发逻辑：先执行 Compiler 全局钩子，在 compilation 钩子中初始化 Compilation 实例后，再执行 Compilation 相关钩子。
- 异步支持：钩子支持 tap（同步）、tapAsync（回调异步）、tapPromise（Promise 异步），需按实际场景选择。
# 二、完整钩子触发顺序（按构建流程）
## 阶段 1：初始化阶段（构建启动前）
|钩子名称|所属对象|触发时机|核心作用|
|--|--|--|--|
|environment|Compiler|Webpack 初始化环境（文件系统、解析器）后|注入全局配置（如 DefinePlugin 注入环境变量）|
|afterEnvironment|Compiler|环境初始化完成后|补充环境配置（如修改解析器规则）|
|initialize|Compiler|Compiler 实例初始化完成后|初始化插件内部状态（如缓存、工具类）|
## 阶段 2：构建准备阶段（开始编译前）
|钩子名称|所属对象|触发时机|核心作用|
|--|--|--|--|
|beforeRun|Compiler|构建开始前（仅第一次构建，watch 模式不重复触发）|预加载资源、启动外部服务（如 DevServer 预热）|
|run|Compiler|构建正式启动（开始读取入口模块）前|监听构建启动事件（如记录构建开始时间）|
|compile|Compiler|编译开始前（创建 Compilation 实例前）|调整编译配置（如修改入口、禁用缓存）|
|thisCompilation|Compiler|Compilation 实例创建后、初始化前|注册 Compilation 钩子（插件核心注册点）|
|compilation|Compiler|Compilation 实例初始化完成后|操作 Compilation 实例（如添加额外模块）|
|make|Compiler|开始构建模块（从入口模块解析依赖）前|注入额外模块（如 HMR 运行时代码）|
## 阶段 3：模块构建阶段（解析 + 编译模块）
|钩子名称|所属对象|触发时机|核心作用|
|--|--|--|--|
|addEntry|Compilation|添加入口模块时|校验 / 替换入口模块（如开发环境替换 mock 入口）|
|failedEntry|Compilation|入口模块添加失败时|捕获入口错误（如自动修复路径）|
|buildModule|Compilation|单个模块构建前（Loader 执行前）|修改模块构建配置（如禁用缓存、添加 Loader）|
|rebuildModule|Compilation|watch 模式下模块重新构建前|清理模块旧依赖、增量编译优化|
|normalModuleFactory|Compiler|普通模块工厂（处理 JS/TS 等模块）创建时|自定义模块解析规则（如修改模块查找路径）|
|contextModuleFactory|Compiler|上下文模块工厂（处理 require.context）创建时|调整上下文模块解析逻辑|
|succeedModule|Compilation|单个模块构建成功后（Loader 执行完成）|修改模块内容（如注入代码、替换变量）|
|failedModule|Compilation|单个模块构建失败时|捕获模块错误（如提示缺失依赖）|
|finishRebuildingModule|Compilation|watch 模式下模块重新构建完成后|验证重新构建结果（如模块体积检查）|
## 阶段 4：依赖解析与 Chunk 生成阶段
|钩子名称|所属对象|触发时机|核心作用|
|--|--|--|--|
|moduleAsset|Compilation|模块生成独立资源（如图片、字体）时|优化资源（如图片压缩、重命名）|
|chunkAsset|Compilation|Chunk（代码块）生成资源（如 JS/CSS）时|处理 Chunk 产物（如注入版权注释）|
|additionalChunkAssets|Compilation|额外 Chunk 资源（如 runtimeChunk）生成后|优化额外 Chunk（如标记预加载）|
|recordModules|Compilation|记录模块信息（用于缓存）时|自定义模块缓存标识（如结合依赖版本）|
|recordChunks|Compilation|记录 Chunk 信息（用于缓存）时|自定义 Chunk 缓存策略、生成分析报告|
## 阶段 5：产物优化阶段（压缩、Tree-Shaking 等）
|钩子名称|所属对象|触发时机|核心作用|
|--|--|--|--|
|optimize|Compilation|优化阶段开始前|初始化优化工具（如配置 Tree-Shaking 规则）|
|optimizeModulesBasic|Compilation|基础模块优化（排序、简化标识符）|简化模块路径、依赖排序|
|optimizeModulesAdvanced|Compilation|高级模块优化（合并、去重）|合并相似模块、删除重复模块|
|optimizeModules|Compilation|模块优化汇总阶段|最终调整模块集合（如删除未使用模块）|
|optimizeChunksBasic|Compilation|基础 Chunk 优化（命名、依赖梳理|标准化 Chunk 名称、梳理依赖关系|
|optimizeChunksAdvanced|Compilation|高级 Chunk 优化（合并、拆分）|合并小型 Chunk、拆分大型 Chunk|
|optimizeChunks|Compilation|Chunk 优化汇总阶段|最终调整 Chunk 结构（如调整加载顺序）|
|optimizeTree|Compilation|模块依赖树优化时|修改依赖关系（如替换依赖、删除循环依赖）|
|optimizeAssets|Compilation|输出资源优化时（核心优化钩子）|压缩资源（JS/CSS/HTML）、添加哈希、Base64 转换|
|afterOptimizeAssets|Compilation|资源优化完成后|验证优化结果、生成资源清单（如 manifest.json）|
## 阶段 6：输出阶段（产物写入磁盘）
|钩子名称|所属对象|触发时机|核心作用|
|--|--|--|--|
|shouldEmit|Compiler|准备输出产物前（可阻止输出）|条件判断是否输出（如构建有错误时取消输出）|
|emit|Compiler|产物写入磁盘前（核心输出钩子）|最后修改产物（如复制静态资源、删除临时文件）|
|afterEmit|Compiler|所有产物写入磁盘后|触发后续操作（如上传 CDN、通知测试环境）|

## 阶段 7：构建完成 / 失败阶段
|钩子名称|所属对象|触发时机|核心作用|
|--|--|--|--|
|done|Compiler|构建成功完成后（无论是否有警告）|输出构建统计（如耗时、产物大小）、生成分析报告|
|failed|Compiler|构建过程中抛出异常时（有错误）|错误处理（如告警通知、清理半成品产物）|
|invalid|Compiler|watch 模式下文件变化导致构建失效时|监听文件变化（如提示哪些文件触发重建）|
|watchClose|Compiler|watch 模式关闭时|清理资源（如关闭服务、释放缓存）|

# 三、关键钩子记忆
environment → compile → thisCompilation → make → buildModule → succeedModule → chunkAsset → optimizeAssets → emit → done
# 四、其他
- 核心钩子与 Plugin 关联：
  - 注入环境变量：DefinePlugin 用 environment；
  - 压缩产物：TerserPlugin/CssMinimizerPlugin 用 optimizeAssets；
  - 生成 HTML：HtmlWebpackPlugin 用 compilation + 专属钩子；
  - 复制静态资源：CopyWebpackPlugin 用 emit。
- thisCompilation vs compilation：
  - 两者均用于注册 Compilation 钩子，区别是 thisCompilation 触发更早（Compilation 初始化前），适合修改 Compilation 配置；compilation 触发更晚（初始化后），适合操作已有 Compilation 实例。
- optimizeAssets 与 emit 区别：
  - optimizeAssets：产物优化阶段，专注资源内容修改（压缩、哈希）；
  - emit：输出前最终干预，适合复制、删除、移动产物（不修改内容）。
- Webpack 5 变化：
  - optimizeChunkAssets 已废弃，统一用 optimizeAssets；
  - 生产模式默认启用 TerserPlugin，无需手动配置；
  - output.clean: true 替代 CleanWebpackPlugin，内部监听 emit 前清理。
