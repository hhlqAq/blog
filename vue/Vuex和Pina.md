# 何时用 Vuex / Pinia？二者核心差异与模块划分建议。

Pinia 是 Vuex 的官方升级版，拥有更简洁的 API、完美的 TS 支持且无需模块嵌套；新项目一律首选 Pinia，仅需在维护现有 Vuex 的老项目时继续使用 Vuex；模块划分应遵循“按功能领域划分”原则，保持高内聚。

## 核心差异与选型

|特性|Vuex|Pinia|
|--|--|--|
|API 设计|较繁琐，需定义state,mutations,actions,getters|极简，仅需state,actions,getters（告别mutations！）|
|TypeScript 支持|支持较弱|原生完美支持，提供完整的类型推断|
|模块化|需开启namespaced: true并嵌套模块|天生模块化，每个 Store 都是独立的，无需命名空间|
|Volume 大小|较大|更轻量（约 1KB）|