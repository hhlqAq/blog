setup 是组合式 API 的 “容器”
通过约定 setup 的执行规则，让组合式 API 能正确关联组件实例、发挥作用。
# 一、先明确核心前提：组合式 API 的本质
组合式 API 是一组 “可复用的组件逻辑抽取函数”（如 ref、reactive、watch、computed 等），它们的核心作用是：
- 依赖 Vue 内部的 组件实例（Component Instance） 提供的上下文（如响应式系统、生命周期钩子队列）；
- 将逻辑结果（响应式数据、方法）暴露给模板或组件其他部分。

setup 函数的核心职责，就是为这些组合式 API 提供 “关联组件实例的执行环境”

# 二、setup 如何为组合式 API 提供 “生效环境”
- 1.setup 的执行时机：早于 Options API，且绑定组件实例;
  - setup 是 Vue 3 组件初始化时 最早执行的函数之一，执行时机：
     - 晚于 beforeCreate（组件实例已创建，但未初始化 data、methods 等 Options API 选项）
     - 早于 created（此时组件实例已存在，但 Options API 尚未挂载）。

关键逻辑：Vue 在执行 setup 前，会先创建当前组件的实例，并将其 临时挂载到一个 “全局上下文栈” 中。此时在 setup 内部调用任何组合式 API（如 ref），都会自动从这个栈中获取当前组件实例，从而将响应式数据、监听逻辑等 “绑定” 到当前组件上。

如果在 setup 外部调用 ref（如普通函数中，且未通过 getCurrentInstance 关联实例），则无法创建组件级别的响应式数据（可能变成全局响应式或无效）—— 这印证了 “组合式 API 依赖 setup 提供的实例上下文”。

- 2.setup 的返回值：暴露组合式 API 的结果给模板 / 组件
  - 普通 setup 函数（非 `<script setup>`）：返回一个对象，对象中的属性 / 方法会被合并到组件的渲染上下文，模板中可直接访问；
  - `<script setup>`（语法糖，推荐）：无需手动返回，顶层声明的变量、函数、响应式数据会自动暴露给模板（编译时自动处理）。

- 3.组合式 API 的 “识别” 本质：依赖 Vue 内置的响应式系统
  - 用 ref/reactive 创建的数据，会被 Vue 标记为 “响应式对象”（通过 Proxy 或 getter/setter 实现依赖追踪）；
  - 用 watch/computed 创建的监听 / 计算逻辑，会自动关联响应式数据，当数据变化时触发更新；
  - 是因为 setup 执行时，组合式 API 会从 Vue 的 “组件实例上下文栈” 中获取当前实例，将响应式数据、监听逻辑挂载到实例上。

# 三、返回值规则：暴露内容给模板 / 组件，两种写法差异
- 1.普通 setup 函数（非 `<script setup>`）
  - 返回值类型：仅支持「对象」或「渲染函数（h 函数）」，不支持原始类型（如字符串、数字，返回后模板无法访问）；
  - 返回对象：对象中的属性 / 方法会被合并到组件的「渲染上下文」，模板中可直接访问（响应式数据会自动解包）；
  - 返回渲染函数：直接替代模板，优先级高于 `<template> `标签（适合用 JSX 编写组件）；
- 2.`<script setup>` 语法糖（推荐写法）
  - 返回值规则简化：无需手动返回，顶层声明的变量、函数、响应式数据、导入的内容会自动暴露给模板；
  - 支持异步返回：允许顶层 await（编译时自动处理为异步组件），await 之后的内容仍会正常暴露给模板（Vue 会等待异步操作完成后再渲染）；
  - 私有性：顶层声明的变量 / 函数默认私有（父组件无法通过 ref 访问），需通过 defineExpose 显式暴露（替代普通 setup 的 context.expose）；

```js
<script setup>
import { ref } from 'vue'
import { formatTime } from './utils' // 导入的函数自动暴露给模板
const count = ref(0) // 顶层变量自动暴露
const increment = () => count.value++ // 顶层函数自动暴露
</script>
<template>
  {{ count }} {{ formatTime() }}
  <button @click="increment">+1</button>
</template>
```
# 四、禁止规则：这些操作会导致 setup 执行异常
- 禁止在 setup 中修改 props 或 context 本身（如 props.count = 1、context.emit = () => {}）；
- 禁止在 setup 中使用 this（严格模式下为 undefined，非严格模式下指向全局，无意义）；
- 禁止 setup 返回 undefined（普通 setup 需返回对象或渲染函数，`<script setup>` 可隐含返回）；
- 禁止在 setup 外部调用依赖组件实例的组合式 API（如 ref、watch），否则无法关联组件实例；
- 禁止 setup 重复执行（组件生命周期内仅执行一次，手动调用 setup 会导致逻辑混乱）