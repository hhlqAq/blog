一个包含父子组件的 .vue 文件，从编码到运行的完整流程是「编码编写 → 工程化预处理 → Vue 编译解析 → 依赖收集与组件实例化 → 渲染与挂载 → 运行时更新」，每一步都依赖工具链和 Vue 内核的协同工作。

# 第一步：编码编写（开发者视角，约定式规范）
单文件组件（SFC）结构规范
每个 .vue 文件必须包含 3 个核心块（可省略样式块），工具链（如 vue-loader）会按块解析：
- `<template>`：模板区域，定义组件 DOM 结构，支持 Vue 模板语法（插值、指令、组件引用）。
- `<script>`：逻辑区域，导出组件配置对象（或 setup 函数），包含 props、data、methods 等核心逻辑。
- `<style>`：样式区域，支持 scoped 隔离、lang 扩展（scss/less），需配合对应 loader 编译。
# 第二步：工程化预处理（工具链视角，编译前准备）
编码完成后，需通过工程化工具链（Webpack/Vite + vue-loader/vite-plugin-vue）将 .vue 文件转换为浏览器可识别的 JS/CSS/HTML，核心是「按块解析 + 依赖处理」
- 1.依赖解析与模块打包
  - 工具链（Webpack/Vite）通过 import 语句分析依赖关系，将 Parent.vue、Child.vue 及 Vue 内核、样式预处理器（如 scss-loader）等纳入打包依赖图。
  - 对于 Vue 3 + Vite，采用 ES Module 原生支持，无需打包直接按需加载（开发环境），生产环境通过 Rollup 打包优化。
- 2..vue 文件分块解析（核心步骤）
  - 以 vue-loader（Webpack 生态）为例，会将 .vue 文件拆分为 3 个独立模块分别处理：
    - template 块：交给 vue-template-compiler 编译为渲染函数（render 函数）。
    - script 块：交给 babel-loader 编译（ES6+ → ES5，兼容低版本浏览器），同时解析组件配置（如 props、data、methods 等）。
    - style 块：交给 css-loader + postcss-loader 处理（ autoprefixer 补全前缀），scoped 样式会添加属性选择器（如 `[data-v-xxx]`）实现隔离。
- 3.产物生成
  - 预处理后，每个 .vue 文件会被转换为一个「包含组件配置和渲染函数的 JS 模块」+ 单独的 CSS 样式（或内联到 JS 中），最终打包为浏览器可执行的 bundle.js 和 style.css。
# 第三步：Vue 内核编译（运行时前准备，解析组件配置）
当工具链生成的 JS 模块被浏览器加载后，Vue 内核会对组件配置进行编译，核心是「模板编译 → 组件构造函数创建」
- 1.模板编译（template → render 函数）
  - 若使用运行时 + 编译器版本（vue.js），会在浏览器端实时编译模板；若使用运行时版本（vue.runtime.js），模板已在工程化阶段编译为 render 函数（推荐，提升性能）
  - 编译流程：模板字符串 → 词法分析生成 AST（抽象语法树） → 优化 AST（标记静态节点，避免重复渲染） → 生成 render 函数（返回 VNode 的函数）。
- 2.组件构造函数创建
  - Vue 会将组件配置对象（包含 data、props、render 等）传入 Vue.extend 方法，生成组件构造函数：
    - 每个组件（包括父组件 Parent 和子组件 Child）都会被转为独立的构造函数，继承自 Vue 构造函数。
    - 构造函数中会合并全局配置（如全局组件、指令）和组件自身配置，形成最终的组件选项。 
# 第四步：组件实例化与依赖收集（运行时核心）   
当执行 new Vue({ el: '#app', render: h => h(Parent) }) 后，Vue 会启动实例化流程，父子组件按「父 → 子」顺序创建实例，同时完成依赖收集（响应式核心）
- 1.父组件实例化流程
  - 初始化生命周期：设置 parent、children、$root 等实例属性，建立组件树关系。
  - 初始化响应式：将 data、props 中的数据转为响应式（Vue 2 用 Object.defineProperty，Vue 3 用 Proxy），并创建 Dep（依赖收集容器）。
  - 初始化事件：绑定组件内部事件（methods）和父组件传递的事件（@child-click）。
  - 执行钩子函数：beforeCreate → created（此时可访问 data、props，但未挂载 DOM）。
- 2.子组件实例化流程
  - 父组件执行 render 函数时，遇到 Child 组件标签，会触发子组件的实例化（递归流程）。
  - 子组件实例化时，会接收父组件传递的 props 并进行类型校验，通过 $parent 指向父组件，父组件通过 $children 记录子组件实例。
  - 子组件的响应式数据同样会创建 Dep，后续渲染时会收集依赖（关联到父组件的渲染 Watcher）
- 3.依赖收集（响应式核心）
  - 父组件渲染时，访问 parentMsg 会触发其 getter 方法，将父组件的渲染 Watcher 加入 parentMsg 的 Dep 中。
  - 子组件渲染时，访问 childMsg（props 数据，本质是父组件 parentMsg 的映射）会触发 parentMsg 的 getter，同样将子组件的渲染 Watcher 加入 parentMsg 的 Dep 中。
  - 后续 parentMsg 变化时，会触发 Dep 通知所有关联的 Watcher 重新渲染（父子组件联动更新）。
# 第五步：渲染与挂载（DOM 生成，组件生效）
实例化完成后，Vue 会执行渲染流程，将 VNode 转为真实 DOM 并挂载到页面，核心是「VNode 生成 → Diff 算法 → DOM 操作」。
- 1.生成 VNode 树
  - 父组件执行 render 函数，生成父组件的 VNode（包含子组件 VNode）。
  - 子组件执行自身的 render 函数，生成子组件的 VNode（包含 DOM 元素 VNode 和 slot VNode）。
  - 最终形成以父组件为根、子组件为叶子的 VNode 树（虚拟 DOM 树）。
- 2.patch 过程（VNode → 真实 DOM）
  - Vue 调用 patch 函数，遍历 VNode 树，将虚拟 DOM 转为真实 DOM 元素。
  - 对于子组件 VNode，会递归执行 patch，先创建子组件的真实 DOM，再插入到父组件的对应位置。
  - slot 内容会被解析为子组件的 VNode 子节点，与子组件自身 DOM 合并后渲染。
- 3.挂载完成
  - 真实 DOM 插入到页面的挂载点（el 对应的元素）后，执行组件的 mounted 钩子函数（父组件 mounted 在所有子组件 mounted 之后执行）。
  - 此时组件完全生效，用户可看到页面内容，且响应式数据与 DOM 建立关联。
# 第六步：运行时更新与销毁（完整生命周期）
组件生效后，会进入运行时阶段，响应数据变化并更新 DOM，最终在合适时机销毁。
- 1.运行时更新（父子组件联动更新）
  - 子组件点击按钮触发 $emit('child-click', val)，父组件 handleChildClick 方法执行，修改 parentMsg。
  - parentMsg 是响应式数据，变化时触发其 setter 方法，通知 Dep 中的所有 Watcher（父组件和子组件的渲染 Watcher）。
  - 父子组件重新执行 render 函数生成新的 VNode，Vue 通过 Diff 算法对比新旧 VNode，只更新变化的 DOM 节点（如父组件的 h2 内容、子组件的 p 内容），提升性能。
- 2.组件销毁
  - 当组件被移除（如路由切换、v-if 为 false）时，Vue 会执行销毁流程：
  - 触发 beforeDestroy → destroyed 钩子函数。
  - 解除响应式依赖（Dep 移除 Watcher）。
  - 移除 DOM 元素，解绑事件监听（避免内存泄漏）。
  - 断开组件树关系（parent、children 置空）。