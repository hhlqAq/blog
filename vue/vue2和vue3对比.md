# 核心差异性
## 响应式系统：
- Vue 2：基于Object.defineProperty，无法自动检测对象属性的添加/删除和数组索引变化，需借助Vue.set/Vue.delete等特殊 API。
- Vue 3：基于Proxy，原生支持对对象和数组的各种变化监听，无上述限制，性能更优。
## API 设计： 
- Vue 2 (Options API)：按选项（data,methods等）组织代码，逻辑分散。复用代码使用 Mixins，容易引发命名冲突。
- Vue 3 (Composition API)：按逻辑功能组织代码，相关代码集中，更利于维护和阅读。复用代码使用自定义 Hook 函数，清晰灵活，且原生 TypeScript 支持极佳。
## 性能与编译器：
- Vue 3 在编译阶段进行了大量优化
  - Tree-shaking：未使用的 API 不会打包进最终产物，体积更小。
  - Patch Flags：编译时标记动态节点，Diff 算法时直接定位变化，大幅提升虚拟 DOM 比对效率。
  - 静态提升：将静态节点缓存，跳过重复渲染。
- 结果：Vue 3 在打包体积、更新性能、内存占用上均优于 Vue 2。
## 新特性：
Vue 3 新增了 Teleport（将组件渲染到指定DOM）、Fragment（支持多根节点模板）等特性，解决了常见开发痛点