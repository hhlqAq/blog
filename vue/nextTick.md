# nextTick 的作用、实现思路与常见误用

## 核心作用：为什么需要 nextTick？

Vue 的 DOM 更新是异步的。当你修改响应式数据时，Vue 并不会立即更新 DOM，而是将这些更新操作推入一个队列中，并在下一个事件循环的“tick” 中批量执行，以提高性能。

nextTick就是用来在这个 DOM 更新队列全部完成后，立即执行一个回调函数。它的典型使用场景是：
- 操作更新后的 DOM：当你改变了数据后，想基于更新后的 DOM 状态进行操作（如获取元素尺寸、焦点等）。
- 等待组件渲染完成：在父组件中操作子组件的 DOM，需要确保子组件已根据父组件传递的新 props 重新渲染完毕。

## 实现思路：如何做到的？

nextTick的实现本质上是利用 JavaScript 的事件循环（Event Loop）机制，尽可能创建一个微任务（Microtask）来异步执行用户传入的回调函数队列。其优先级为：

1. Promise (微任务) -> 2. MutationObserver (微任务) -> 3. setImmediate (宏任务) -> 4. setTimeout (宏任务，兜底方案)

Vue 3 的实现流程：
- 当你修改数据时，Vue 会触发组件的异步更新队列（queueJob）。
- 当你调用nextTick(callback)时，Vue 不会立即执行callback，而是将它推入一个名为pendingPostFlushCbs的回调函数队列中。
- 在当前的同步代码执行完毕后，事件循环开始处理微任务队列。
- Vue 安排的微任务（基于 Promise）会率先执行，它负责：
  - 执行并清空组件的异步更新队列（真正更新 DOM）。
  - 然后执行并清空 nextTick 的回调函数队列。

这就保证了你在nextTick回调中获取到的 DOM 一定是最新的。