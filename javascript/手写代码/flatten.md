支持深度控制的递归实现
```js
function flatten(arr, depth = Infinity) {
    if (!Array.isArray(arr)) return [];
    if (depth <= 0) return arr.slice();
    
    return arr.reduce((acc, cur) => {
        if(Array.isArray(cur) && depth > 0) {
           acc.push(...flatten(cur, depth - 1));
        } else {
           acc.push(cur);
        }
        return acc; // 修复：确保返回累加器数组
    }, [])
}
```