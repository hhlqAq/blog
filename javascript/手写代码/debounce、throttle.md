#  debounce 防抖
- 接收两个核心参数：待执行函数 fn、延迟时间 delay（可选配置 immediate 控制是否 “立即执行一次”）。
- 用定时器 timer 记录延迟执行的任务，每次触发事件时先清除旧定时器。
-  若配置 immediate: true，则第一次触发时立即执行函数，后续触发进入防抖冷却；否则每次触发都延迟 delay 执行。

```js
function denounce(fn, delay = 300, immediate = false) {
    let timer  =  null
    let isInvoked = false
    const debounced = function(...args) {
        const context = this
        if(timer) clearTimeout(timer)
        if (immediate && !isInvoked) {
            fn.apply(context, args)
            isInvoked = true
        }
        timer = setTimeout(() => {
            fn.apply(context, args)
            isInvoked = false
            timer = null
        }, delay)
    }
    debounced.cancel = function() {
        if(timer) clearTimeout(timer)
        timer = null
        isInvoked = false
    }
    return debounced
}
```
#  throttle 节流
- 接收两个核心参数：待执行函数 fn、间隔时间 interval（可选配置 leading/trailing 控制 “首触发执行”/“尾触发执行”）
- 用 lastTime 记录上一次执行函数的时间戳，每次触发事件时计算当前时间与 lastTime 的差值。
- 若差值 ≥ interval，则立即执行函数并更新 lastTime；否则忽略本次触发（或设置定时器保证尾触发执行）。

```js
function throttle(fn, interval = 300) {
    let lastTime =  0
    const throttled =  function(...args) {
        const context =  this
        const now = Date.now()
        if(now - lastTime >= interval) {
            fn.apply(context, args)
            lastTime = now
        }
    }
    return throttled
}
```