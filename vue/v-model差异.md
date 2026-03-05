# v-model 在 Vue2/3 的语法差异与底层实现。

Vue 2 的v-model是valueprop 和input事件的语法糖，且一个组件只能有一个；Vue 3 的v-model是modelValueprop 和update:modelValue事件的语法糖，支持多个，并废弃了.sync修饰符，实现了 API 的统一。

## Vue 2 的 v-model

- 语法与实现：
  - Vue 2 中，在组件上使用v-model="pageTitle"等价于：
  ```vue
  <ChildComponent :value="pageTitle" @input="pageTitle = $event" />
  ```
  - 默认使用value作为 prop。
  - 默认使用input作为事件。
- 局限
  - 一个组件只能有一个v-model：因为无法绑定多个valueprop。
  - 与原生元素行为冲突：像复选框、单选框等原生元素使用的valueprop 和input事件有特定用途，容易与自定义组件的v-model产生命名冲突。
  - 为了实现类似“双向绑定”其他prop，需使用.sync修饰符，导致 API 不统一
  ```vue
    <!-- Vue 2 的 .sync 修饰符 -->
  <ChildComponent :title.sync="pageTitle" />
  <!-- 等价于 -->
  <ChildComponent :title="pageTitle" @update:title="pageTitle = $event" />
  ```

## Vue 3 的 v-model

- 语法与实现：
  - 在 Vue 3 中，在组件上使用v-model="pageTitle"等价于：
  ```vue
  <ChildComponent :modelValue="pageTitle" @update:modelValue="pageTitle = $event" />
  ```
  - 默认使用modelValue作为 prop。
  - 默认使用update:modelValue作为事件。
- 重大改进：
  - 支持多个v-model：可以给同一个组件绑定多个“双向绑定”的 prop，解决了 Vue 2 的最大局限
  ```vue
  <!-- 可以同时绑定多个 v-model -->
  <UserName
    v-model:first-name="first"
    v-model:last-name="last"
  />
  <!-- 等价于 -->
  <UserName
    :first-name="first"
    @update:first-name="first = $event"
    :last-name="last"
    @update:last-name="last = $event"
  />
  ```
  - 废弃.sync修饰符：其功能已被v-model:arg语法完全取代，API 变得更加统一和清晰。
  - 自定义修饰符：支持开发者自定义修饰符（如v-model.capitalize），并通过modelModifiersprop 传递给组件内部进行逻辑处理。