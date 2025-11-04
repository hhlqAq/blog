# newVue 做了什么
new Vue(options) 是 Vue2 应用的入口初始化函数，其核心职责是：
- 创建一个「Vue 实例（Vue Instance）」，作为应用 / 组件的逻辑载体；
- 解析传入的 options 配置（如 el、data、methods、components 等）；
- 初始化核心能力（响应式系统、生命周期、事件系统、编译模板）；
- 最终将实例挂载到指定 DOM 节点，完成视图渲染。

# 二、完整执行流程
- 步骤 1：构造函数入口校验与实例创建
```js
// src/core/instance/index.js
function Vue(options) {
  if (process.env.NODE_ENV !== 'production' && !(this instanceof Vue)) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options) // 核心：委托给 _init 方法初始化
}
```
- 步骤 2：实例初始化（_init 方法核心入口）
这是 new Vue() 最核心的步骤，完成了「配置合并 → 核心模块初始化 → 生命周期触发 → 自动挂载」的串联，后续步骤将拆解其中关键子模块。

- 步骤 3：配置合并（mergeOptions）
将「全局配置（Vue.config）」「构造函数配置（Vue.options）」「用户配置（new Vue(options)）」合并为实例的最终配置 vm.$options。
- 步骤 4：核心模块初始化（initLifecycle/initEvents/initRender）
  - 4.1 initLifecycle：生命周期与父子关系初始化
    - 源码路径：src/core/instance/lifecycle.js
    - 初始化实例属性：$parent（父实例）、$children（子实例数组）、$refs（DOM / 组件引用）、_isMounted（是否挂载）等；
    - 建立父子组件关联：若当前实例是子组件，将其添加到父实例的 $children 数组中。
  - 4.2 initEvents：事件系统初始化 
    - 源码路径：src/core/instance/events.js
    - 初始化实例属性：_events（事件缓存对象，key 为事件名，value 为回调数组）、_hasHookEvent（是否有钩子相关事件）
    - 处理父组件传递的事件：子组件初始化时，会将父组件通过 v-on 绑定的事件合并到 vm._events 中。
  - 4.3 initRender：渲染系统初始化
    -  源码路径：src/core/instance/render.js
    - 初始化实例属性：$slots（插槽对象）、$scopedSlots（作用域插槽）、_c（模板编译生成的渲染函数，用于创建 VNode）、$createElement（即 h 函数，用户手写渲染函数时使用）；
    - 绑定 vnode 钩子：为后续 VNode 生成和补丁（patch）过程提供回调支持；
    - 处理 propsData（子组件接收的 props 数据）。
```js
// src/core/instance/init.js
Vue.prototype._init = function (options?: Object) {
  const vm: Component = this
  // 1. 实例标识：给实例添加唯一 ID（用于调试、缓存等）
  vm._uid = uid++
  let startTag, endTag
  // 2. 性能埋点：开发环境下记录初始化开始时间（配合 devtool）
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    startTag = `vue-init-${vm._uid}`
    endTag = `vue-init-end-${vm._uid}`
    mark(startTag)
  }

  // 3. 避免实例被观测：标记为 Vue 实例，响应式系统会跳过对实例本身的观测
  vm._isVue = true

  // 4. 合并配置：处理组件配置（根实例 vs 子组件逻辑不同）
  if (options && options._isComponent) {
    // 子组件：优化合并（仅合并必要选项，避免冗余逻辑）
    initInternalComponent(vm, options)
  } else {
    // 根实例：合并全局配置（Vue.config）与用户配置
    vm.$options = mergeOptions(
      resolveConstructorOptions(vm.constructor),
      options || {},
      vm
    )
  }

  // 5. 代理 this 访问：让 vm.$options 中的属性可通过 vm 直接访问（如 vm.el → vm.$options.el）
  if (process.env.NODE_ENV !== 'production') {
    initProxy(vm)
  } else {
    vm._renderProxy = vm
  }

  // 6. 初始化生命周期相关属性（如 $parent、$children、$refs）
  vm._self = vm
  initLifecycle(vm)
  // 7. 初始化事件系统（处理 $on、$emit、$off、$once）
  initEvents(vm)
  // 8. 初始化渲染相关（$slots、$scopedSlots、_c 编译函数、$createElement 渲染函数）
  initRender(vm)
  // 9. 触发 beforeCreate 生命周期钩子
  callHook(vm, 'beforeCreate')
  // 10. 初始化注入（处理 provide/inject，子组件注入依赖父组件提供的属性）
  initInjections(vm) // resolve injections before data/props
  // 11. 初始化状态（props、methods、data、computed、watch）
  initState(vm)
  // 12. 初始化提供（处理 provide，暴露属性给子组件）
  initProvide(vm) // resolve provide after data/props
  // 13. 触发 created 生命周期钩子
  callHook(vm, 'created')

  // 14. 性能埋点：开发环境下记录初始化结束时间
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    vm._name = formatComponentName(vm, false)
    mark(endTag)
    measure(`vue ${vm._name} init`, startTag, endTag)
  }

  // 15. 挂载实例：若配置了 el，自动调用 $mount 挂载
  if (vm.$options.el) {
    vm.$mount(vm.$options.el)
  }
}
```
- 步骤 5：状态初始化（initState）—— 响应式系统核心
   - 源码路径 src/core/instance/state.js
   - 核心逻辑：initState 是 Vue2 响应式系统的入口，按「props → methods → data → computed → watch」的顺序初始化（优先级递减），每个子步骤都有明确的设计考量：
   - 5.1 initProps：props 初始化
     - 解析 opts.props 配置（处理类型校验、默认值、required 等）；
     - 将 props 数据挂载到 vm._props 对象；
     - 对 props 数据进行响应式观测（observe）。
   - 5.2 initMethods：methods 初始化
     - 将 opts.methods 中的方法绑定到 vm 实例（vm.methodName = methods.methodName）；
     - 绑定 this 指向：确保方法内部 this 始终指向当前 Vue 实例（避免全局 this 污染）。
   - 5.3 initData：data 初始化（响应式核心）
     - 获取 data 数据：若 data 是函数，执行并获取返回值（避免组件间数据共享）；若为对象，直接使用；
     - 将 data 数据挂载到 vm._data 对象；
     - 对 data 数据进行响应式观测（observe）。
   - 5.4 initComputed：computed 初始化（缓存 + 依赖追踪）
     - 为每个计算属性创建 Watcher 实例（computedWatcher），配置 lazy: true（懒执行，仅依赖变化或主动访问时计算）；
     - 将计算属性挂载到 vm 实例，通过 getter 触发计算逻辑，setter 处理手动赋值（若配置）；
     - 缓存机制：计算结果缓存到 watcher.value，依赖未变化时直接返回缓存，避免重复计算。
   - 5.5 initWatch：watch 初始化（监听器）
     - 解析 opts.watch 配置（处理监听属性的回调函数）；
     - 将 watcher 实例挂载到 vm._watchers 数组；
     - 初始化时触发 immediate 回调（若配置了 immediate: true）。
```js
function initState(vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 1. 初始化 props（优先级最高：父组件传递的数据）
  if (opts.props) initProps(vm, opts.props)
  // 2. 初始化 methods（方法绑定到实例，避免 this 指向问题）
  if (opts.methods) initMethods(vm, opts.methods)
  // 3. 初始化 data（响应式核心：观测数据）
  if (opts.data) {
    initData(vm)
  } else {
    // 若未配置 data，初始化空响应式对象
    observe(vm._data = {}, true /* asRootData */)
  }
  // 4. 初始化 computed（计算属性：缓存 + 依赖追踪）
  if (opts.computed) initComputed(vm, opts.computed)
  // 5. 初始化 watch（监听器：监听数据变化触发回调）
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
```
- 步骤 6：provide/inject 初始化（initInjections/initProvide）
  - initInjections：在 beforeCreate 之后、initState 之前执行，优先初始化注入，确保注入的属性可被 data、computed 依赖；
  - initProvide：在 initState 之后执行，将 opts.provide 提供的属性暴露给子组件；
- 步骤 7：生命周期钩子触发（beforeCreate/created）
  - beforeCreate：在 initInjections 之前触发，此时「状态未初始化」（props、data、methods 均不可访问），仅完成了生命周期、事件、渲染模块的基础初始化；
  - beforeCreate：适合初始化不依赖状态的逻辑；
  - created：在 initProvide 之后触发，此时「状态已初始化」（props、data、methods、computed、watch 均可访问），但「DOM 未挂载」（$el 不存在）。
  - created：适合初始化依赖状态的逻辑（如接口请求、数据预处理）。
- 步骤 8：实例挂载（$mount）—— 视图渲染入口
   - src/platforms/web/runtime/index.js（Web 平台）
   - 若 new Vue() 配置了 el 选项，会自动调用 $mount 方法，完成「模板编译 → VNode 生成 → DOM 挂载」的流程：
   - 8.1 解析挂载目标（el）:将 el 转换为 DOM 元素（支持字符串选择器，如 '#app'，或直接传入 DOM 元素）；
   - 8.2 模板编译（compile）:
     - 优先级：options.render > options.template > el 对应的 DOM 内容；
     - 编译过程（源码路径：src/compiler/index.js）：解析、优化、生成
     - 编译时机：运行时 或 预编译
   - 8.3 组件挂载（mountComponent）
     - 源码路径：src/core/instance/lifecycle.js
     - 触发 beforeMount 生命周期钩子；
     - 创建「渲染 Watcher」监听响应式变化，执行渲染函数生成VNode，挂在到 el 对应节点
     - 标记实例为已挂载（vm._isMounted = true）；
     - 触发 mounted 生命周期钩子。

