for...of 循环会迭代任务列表，每次循环中用 await 等待当前任务完成：

```js
async function asyncSerial(tasks) {
    for(const task of tasks) {
        await new Promise.resolve(task())
    }
}
```