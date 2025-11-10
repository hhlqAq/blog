# 基础版 Promise 
需完整实现 核心特性：三种状态（pending/fulfilled/rejected）、状态不可逆、then 方法链式调用、异步任务支持

```js
class MyPromise {
    static PENDING = 'pending'
    static FULFILLED = 'fulfilled'
    static REJECTED = 'rejected'
    constructor(executor) {
        this.status = MyPromise.PENDING
        this.value = undefined
        this.reason = undefined
        executor(this.resolve, this.reject)
    }
    resolve(value) {
        if(this.status === MyPromise.PENDING) {
            this.status = MyPromise.FULFILLED
            this.value = value
        }
    }
    reject(reason) {
        if (this.status === MyPromise.PENDING) {
            this.status = MyPromise.REJECTED
            this.reason = reason
        }
    }
    then(onFulfilled, onRejected) {
        if(this.status === MyPromise.FULFILLED) {
            onFulfilled(this.value)
        }
        if(this.status === MyPromise.REJECTED) {
            onRejected(this.reason)
        }
    }
}
```

# Promise.all
核心作用是 “并行执行多个 Promise，等待所有 Promise 成功后返回结果数组；若任一 Promise 失败，立即返回该失败原因”
```js
MyPromise.all = function(promises) {
    return new Promise((resolve, reject) => {
        const results = []
        let count = 0
        for(let i = 0; i< promises.length; i++) {
            promises[i].then((value) => {
                results[i] = value
                count++
                if(count === promises.length) {
                    resolve(results)
                }
            }).catch((reason)=>{
                reject(reason)
            })
        }
    })
}
```
# Promise.race
一旦有 Promise 完成，立即返回结果，忽略其他未完成的 Promise（即使后续有其他 Promise 完成）；
```js
MyPromise.race = function(promises) {
    return new Promise((resolve, reject) => {
        for(let i = 0; i< promises.length; i++) {
            promises[i].then((value) => {
                resolve(value)
            }).catch((reason)=>{
                reject(reason)
            })
        }
    })
}
```
# Promise.allSettled
核心作用是 “并行执行多个 Promise，等待所有 Promise 完成后返回结果数组，每个结果包含状态（fulfilled/rejected）和对应值/原因”
```js
MyPromise.allSettled = function(promises) {
    return new Promise((resolve, reject) => {
        const results = []
        let count = 0
        for(let i = 0; i < promises.length; i++) {
            promises[i].then((value) => {
                results[i] = {
                    status: MyPromise.FULFILLED,
                    value
                }
            }).catch((reason) => {
                results[i] = {
                    status: MyPromise.REJECTED,
                    reason
                }
            }).finally(() => {
                count++
                if(count === promises.length) {
                    resolve(results)
                }
            })
        }
    })
}
```