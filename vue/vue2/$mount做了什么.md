`$mount` 是核心的「挂载方法」，作用是将 Vue 实例的虚拟 DOM（VNode）渲染为真实 DOM 并挂载到页面指定容器上

# 一、先明确：$mount 的调用时机
`$mount` 有两种调用方式，最终都会触发挂载流程
- 1.未配置 el 时，需手动调用 vm.$mount('#app') 触发挂载（适用于动态指定容器的场景）
- 2.当 Vue 实例配置了 el 选项（如 new Vue({ el: '#app' })），Vue 内部会自动调用 $mount(el)
# 二、Vue 2 中 $mount 的执行流程（核心步骤）
Vue 2 的 $mount 定义在 `src/platforms/web/runtime/index.js` 中，是「平台相关」的方法（Web 平台特有），底层依赖 Vue 核心的编译、虚拟 DOM、patch 逻辑.

**关键前提：模板的两种来源**
- 模板优先级：render 函数 > template 选项 > el 对应的 DOM 内容（如 #app 内部的 HTML）；
- 若没有 render 函数，Vue 会先将 template/el 内容「编译」为 render 函数（运行时编译），再进入挂载流程。

## 详细执行
### 1. 预处理：判断是否需要编译模板
```js
Vue.prototype.$mount = function (el) {
    el = el && query(el); // 解析 el 为真实 DOM（如 document.querySelector('#app')）
    const vm = this;
    const options = vm.$options;

    // 步骤 1：若没有 render 函数，编译模板生成 render
    if (!options.render) {
        let template = options.template;
        // 情况 1：有 template 选项，直接用
        if (template) {
        // 处理模板（如字符串模板、选择器模板）
        }
        // 情况 2：没有 template，但有 el，取 el 的 outerHTML 作为模板
        else if (el) {
            template = el.outerHTML;
        }

        // 编译模板为 render 函数（运行时编译需引入 vue-template-compiler）
        if (template) {
            const { render } = compileToFunctions(template, {
                // 编译选项（如 delimiters、preserveWhitespace 等）
            }, vm);
            options.render = render; // 挂载 render 函数到实例选项
        }
    }

    // 步骤 2：调用核心挂载逻辑（平台无关）
    return mountComponent(vm, el);
}
```
### 2. 核心挂载逻辑：mountComponent
mountComponent 定义在 src/core/instance/lifecycle.js 中，
是「平台无关」的通用挂载逻辑，核心做 3 件事：
```js
function mountComponent(vm, el) {
    vm.$el = el; // 把目标容器 DOM 挂载到实例的 $el 属性

    // 步骤 1：触发 beforeMount 生命周期钩子
    callHook(vm, 'beforeMount');
    // 步骤 2：定义更新函数（核心！响应式依赖触发时会调用）
    const updateComponent = () => {
        // 1. 执行 render 函数：生成虚拟 DOM（VNode）
        // 2. 执行 patch 函数：将 VNode 转化为真实 DOM，挂载到 $el
        vm._update(vm._render(), hydrating);
    };
    // 步骤 3：创建 Watcher 实例，启动响应式监听
    // 这是 Vue 2 响应式的核心：Watcher 会收集模板中的依赖（data/props）
    new Watcher(vm, updateComponent, noop, {
        before() {
            if (vm._isMounted) {
                callHook(vm, 'beforeUpdate'); // 后续更新时触发
            }
        }
    }, true);

    // 步骤 4：触发 mounted 生命周期钩子
    // 注意：mounted 中 $el 已存在，但子组件可能还未挂载完成（异步）
    if (vm.$vnode == null) {
        vm._isMounted = true;
        callHook(vm, 'mounted');
    }

    return vm;
}
```
### 3. 最终渲染：_update + patch（真实 DOM 生成）
- vm._render()：执行 render 函数，生成「虚拟 DOM（VNode）」（描述 DOM 结构的 JS 对象）；
- vm._update(vnode)：调用 patch 函数（src/core/vdom/patch.js），将 VNode 转化为真实 DOM：
  - 若为首次挂载（无旧 VNode）：直接根据 VNode 创建真实 DOM，插入到 el 容器中
  - 若为更新（有旧 VNode）：通过「diff 算法」对比新旧 VNode，只更新差异部分（性能优化）