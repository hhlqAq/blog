# call
- 接收参数：第一个参数是目标this，如果是 null 或 undefined，指向 window，后续是函数执行的参数列表 
- 临时挂载函数：将当前函数临时挂在到目标this上，避免污染原对象
- 执行函数并传递参数，保存返回值
- 删除临时挂载的函数
- 返回函数执行结果

```js
Function.prototype.myCall =  function(ctx, ...args) {
    ctx = ctx || window
    ctx.fn = this
    const result = ctx.fn(...args)
    delete ctx.fn
    return result
}
```
# apply
- 接收参数：第一个参数是目标this，如果是 null 或 undefined，指向 window，后续是函数执行的参数列表 
- 临时挂载函数：将当前函数临时挂在到目标this上，避免污染原对象
- 执行函数并传递参数，保存返回值
- 删除临时挂载的函数
- 返回函数执行结果

```js
Function.prototype.myApply = function(ctx, args) {
    ctx = ctx || window
    ctx.fn = this
    const result = ctx.fn(...args)
    delete ctx.fn
    return result
}
```
# bind
- 接收参数：第一个参数是目标this，如果是 null 或 undefined，指向 window，后续是函数执行的参数列表 
- 临时挂载函数：将当前函数临时挂在到目标this上，避免污染原对象
- 返回一个新函数，新函数执行时，会将目标this绑定到当前函数上，并且可以传递参数
- 删除临时挂载的函数

```js
Function.prototype.myBind = function(ctx, ...args) {
    ctx = ctx || window
    ctx.fn = this
    return function(...newArgs) {
        const result = ctx.fn(...args, ...newArgs)
        delete ctx.fn
        return result
    }
}
```