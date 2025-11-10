当执行 new Constructor(...args) 时，JavaScript 引擎会做以下 5 件事：
- 创建一个空对象（obj = {}）；
- 将空对象的原型链指向构造函数的 prototype（obj.__proto__ = Constructor.prototype）；
- 将构造函数的 this 绑定到空对象（Constructor.call(obj, ...args)）；
- 执行构造函数：
- 若构造函数有返回值且返回值是「对象 / 函数」，则 new 的结果为该返回值；
- 若构造函数无返回值或返回值是「基本类型」，则 new 的结果为步骤 1 创建的空对象（已绑定原型和 this）；
- 返回最终对象实例。

```js
function myNew(constructor, ...args) {
    // 1. 创建一个空对象
    const obj = {};
    // 2. 将空对象的原型链指向构造函数的 prototype
    obj.__proto__ = constructor.prototype;
    // 3. 将构造函数的 this 绑定到空对象
    const result = constructor.call(obj, ...args);
    // 4. 执行构造函数
    // 5. 返回最终对象实例
    return result instanceof Object ? result : obj;
}
```