# webpack 执行流程

## 1. 初始化阶段：读取配置，准备构建环境 
- 输入：源码（src/）、Webpack 配置文件（webpack.*.conf.js）
  - 加载并合并配置（基础配置 + 环境配置，如 webpack-merge）
  - 解析命令行参数（如 --mode production）覆盖配置 
  - 初始化 Compiler 实例（构建核心对象，统筹全流程） 
  - 加载所有配置的插件（Plugin）并触发 plugin.apply()
## 2.模块处理阶段：递归解析依赖，转化模块代码 
- 从 entry 配置的入口文件（如 src/main.js）开始，创建 EntryChunk
- 调用 loader 解析模块：
  - 匹配文件规则（如 .vue → vue-loader，.js → babel-loader）
  - 按 loader 配置顺序执行（从后往前），转化代码（如 ES6→ES5、SFC解析）
- 依赖收集：解析转化后代码中的 import/require，递归处理依赖模块
- 每个模块生成唯一 moduleId，存入 Compiler 的模块缓存
## 3. Chunk 优化阶段：合并模块，优化代码（生产环境核心）
- Chunk 生成：将关联模块归类到对应 Chunk（入口 Chunk + 异步 Chunk
- 代码分割（SplitChunksPlugin）：
  - 拆分第三方库（如 node_modules 内容 → vendors.chunk.js）
  - 拆分重复代码、异步加载模块（如 import() 语法生成独立 Chunk）
- 代码优化：
  - 生产环境：TerserPlugin 压缩 JS、CssMinimizerPlugin 压缩 CSS
  - 移除死代码（tree-shaking，依赖 ES6 模块化）
  - 变量替换（DefinePlugin 替换环境变量，如 process.env.NODE_ENV
- Chunk 命名：按配置生成带 hash 的文件名（如 [name].[contenthash].js
## 产物输出阶段：生成最终文件，写入目标目录 
- 准备输出目录：CleanWebpackPlugin 清空 dist 目录（生产环境）
- 资源处理：
  - 提取 CSS（MiniCssExtractPlugin → .css 文件）
  - 处理静态资源（图片、字体 → 输出到指定目录，如 dist/img）
  - 生成源码映射（source-map → .map 文件，生产环境可选）
- 生成 HTML：HtmlWebpackPlugin 注入 Chunk 资源（JS/CSS 路径）
- 写入文件：将所有 Chunk 及资源写入 output.path 配置的目录（如 dist）