Loader（加载器）是处理非 JavaScript 资源的核心工具

Webpack 本身仅能解析 JavaScript 和 JSON 文件，而 Loader 能将其他类型资源（如 CSS、图片、TS、Vue 组件等）转换为 Webpack 可识别的模块，并注入到构建流程中。

简单说：Loader 是 “资源转换器”，负责将源文件按规则处理后，交给 Webpack 进行后续的打包、优化。

# 一、Loader 的核心角色定位
- 资源翻译官：将非 JS 资源（如 .css、.ts、.png）翻译成 Webpack 能理解的 “模块代码”（最终通常是 JS 模块，或可被 JS 引用的资源 URL）。
- 预处理工具：在模块构建前对源文件进行编译（如 TS→JS、Sass→CSS）、压缩（如图片压缩）、校验（如 ESLint 代码检查）、注入（如 CSS 前缀补全）等操作。
- 桥梁作用：连接第三方工具（如 Babel、PostCSS、Terser）与 Webpack 构建流程，让 Webpack 无需关心具体资源的处理细节，只需调用对应的 Loader 即可。
- 链式执行：多个 Loader 可按顺序串联处理同一资源（如 sass-loader→css-loader→style-loader），每个 Loader 专注于单一职责，符合 “单一职责原则”。
# 二、Loader 的核心特性（决定其角色边界）
- 单一职责：一个 Loader 只做一件事（如 sass-loader 仅将 Sass 编译为 CSS，css-loader 仅处理 CSS 中的 @import 和 url()），通过链式组合实现复杂需求。
- 链式执行：对同一资源的多个 Loader，按 Webpack 配置中的 从右到左（或从后到前） 顺序执行（如 use: ['style-loader', 'css-loader', 'sass-loader'] 实际执行顺序：sass-loader → css-loader → style-loader）。
- 同步 / 异步支持：Loader 可是同步（返回处理后内容）或异步（通过回调 / Promise 返回结果），适配不同处理场景（如图片压缩、远程资源加载等异步操作）
- 接受选项：通过 options 配置 Loader 的行为（如 babel-loader 指定预设、url-loader 指定图片转 Base64 的阈值），灵活性极高。
- 可缓存：默认情况下，Webpack 会缓存 Loader 处理结果，仅当源文件变化时才重新处理，提升构建速度。
# 三、常见 Loader 及其角色示例（实际业务场景）
- 脚本类 Loader：将高级 / 非标准 JS 转为标准 JS
  - 核心角色：编译、转译脚本，确保浏览器兼容性。
  - 代表 Loader：babel-loader（如使用 ES6+ 语法，需配置 @babel/preset-env）、ts-loader（如使用 TypeScript，需安装 typescript 及相关插件）。
- 样式类 Loader：处理 CSS 及预处理器
  - 核心角色：编译样式预处理器、解析 CSS 依赖、注入样式到页面。
  - 代表 Loader：css-loader（解析 CSS 中的 @import 和 url()，返回处理后的 CSS 代码）、sass-loader（将 Sass 编译为 CSS）、postcss-loader（添加浏览器前缀、压缩 CSS）、style-loader（将 CSS 注入到页面的 `<style>` 标签中）。
- 资源类 Loader：处理图片、字体、音频等静态资源
  - 将静态资源转为可被 JS 引用的形式（如 URL 路径、Base64 编码），或优化资源体积
  - 代表 Loader：url-loader（将小于指定大小的图片转为 Base64 编码，大于指定大小的图片则使用 file-loader 处理）、file-loader（将文件输出到指定目录，返回文件路径）、svg-url-loader（将 SVG 转为 Data URL）。
- 校验 / 格式化类 Loader：代码质量检查、格式化
  - 核心角色：在模块构建前校验代码语法、规范，提前暴露问题。
  - 代表 Loader：eslint-loader（如使用 ESLint 校验 JS 代码，需安装 eslint 及相关插件）、prettier-loader（如使用 Prettier 格式化代码，需安装 prettier 及相关插件）。
- 模板类 Loader：处理 HTML、Vue 等模板文件
  - 核心角色：编译模板文件为 JS 模块（如 Vue 组件、HTML 模板）。
  - 代表 Loader：vue-loader（如使用 Vue 单文件组件，需安装 vue-loader 及相关插件）、html-loader（如使用 HTML 模板，需安装 html-loader）。

  # 四、Loader 的工作原理
  Loader 本质是一个 Node.js 模块，暴露一个函数，接收三个核心参数：
  - content：源文件的内容（如 .scss 文件的原始代码）。
  - map：SourceMap 数据（用于调试，保留原始文件的行号、列号）。
  - meta：额外的元数据（如其他 Loader 传递的信息）。

  Loader 函数的返回值可以是：
  - 处理后的文件内容（字符串 / Buffer）。
  - 包含 code（处理后内容）、map（SourceMap）、meta（元数据）的对象。
  - 异步回调（this.callback(null, content, map, meta)）或 Promise（异步 Loader）。

# 五、Loader 的核心价值（为什么必须用 Loader？）
- 扩展 Webpack 能力：让 Webpack 突破 “仅处理 JS/JSON” 的限制，支持几乎所有前端资源（CSS、图片、TS、Vue、Sass 等）。
- 统一构建流程：将各类资源的处理逻辑整合到 Webpack 中，无需单独执行 tsc、sass 等命令，提升开发效率。
- 优化构建产物：通过 Loader 实现资源压缩、按需加载、Base64 转换等优化，减少最终产物体积，提升页面性能。
- 保障兼容性：通过 babel-loader、postcss-loader 等工具，自动处理浏览器兼容性问题（如 ES6+ 转 ES5、CSS 前缀补全），降低适配成本。