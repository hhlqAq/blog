深拷贝的核心是递归遍历引用类型数据，创建全新的副本，而非共享原对象的内存地址，同时要处理：基本类型、所有引用类型（对象、数组、函数、日期、正则等）、循环引用（A 引用 B，B 引用 A）。

```js
function deepClone(target, map = new WeakMap()) {
    // 1. 处理基本类型（直接返回，无需拷贝）
    if (target === null || typeof target !== 'object') {
        return target;
    }
    // 2. 处理循环引用：若map中已存在target，直接返回缓存的副本（避免无限递归）
    if (map.has(target)) {
        return map.get(target);
    }
    let cloneResult; // 存储拷贝结果

    // 3. 处理日期对象（特殊引用类型）
    if (target instanceof Date) {
        cloneResult = new Date(target);
        map.set(target, cloneResult); // 缓存映射关系
        return cloneResult;
    }
    // 4. 处理正则对象（特殊引用类型）
    if (target instanceof RegExp) {
        cloneResult = new RegExp(target.source, target.flags); // 拷贝源正则和修饰符
        cloneResult.lastIndex = target.lastIndex; // 拷贝lastIndex属性
        map.set(target, cloneResult);
        return cloneResult;
    }
    // 5. 处理函数（特殊：一般深拷贝不拷贝函数体，直接返回原函数或浅拷贝）
    // 原因：函数拷贝意义不大（闭包环境无法完全复制），且大部分场景不需要深拷贝函数
    if (target instanceof Function) {
        // 方案1：直接返回原函数（推荐，避免破坏闭包）
        return target;
        // 方案2：拷贝函数（仅适用于普通函数，箭头函数/绑定函数无法拷贝）
        // cloneResult = target.bind({}); 
    }
    // 6. 处理数组和普通对象（核心递归逻辑）
    // 判断目标是数组还是对象，初始化对应的空结构
    cloneResult = Array.isArray(target) ? [] : {};
    // 缓存映射关系（关键：先缓存，再递归，避免循环引用）
    map.set(target, cloneResult);
    // 递归遍历目标对象的所有可枚举属性（包括 Symbol 键）
    for (const key of Reflect.ownKeys(target)) {
        // 递归调用 deepClone 处理每个属性值，确保深拷贝
        cloneResult[key] = deepClone(target[key], map);
    }
    return cloneResult; // 返回完整的深拷贝结果
}
```