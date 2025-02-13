class MyPromise {
  static PENDING = 'pending'
  static FULFILLED = 'fulfilled'
  static REJECTED = 'rejected'

  constructor(executor) {
    this.promiseState = MyPromise.PENDING
    this.promiseResult = null
    this.onFulfilledCallbacks = []
    this.onRejectedCallbacks = []
    try {
      executor(this.resolve.bind(this), this.reject.bind(this))
    } catch (error) {
      this.reject(error)
    }
    
  }

  resolve(result) {
    if (this.promiseState === MyPromise.PENDING) {
      this.promiseState = MyPromise.FULFILLED
      this.promiseResult = result
      this.onFulfilledCallbacks.forEach(callback => callback(result))
    }
  }

  reject(reason) {
    if (this.promiseState === MyPromise.PENDING) {  
      this.promiseState = MyPromise.REJECTED
      this.promiseResult = reason
      this.onRejectedCallbacks.forEach(callback => callback(reason))
    }
  }

  then(onFulfilled, onRejected) {
    // onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value
    // onRejected = typeof onRejected === 'function' ? onRejected : reason => { throw reason }
    
    // 返回一个新的Promise
    const promise2 = new MyPromise((resolve, reject) => {
      // 所有回调函数需要在then方法执行后的下一轮异步任务执行
      if (this.promiseState === MyPromise.PENDING) {
        this.onFulfilledCallbacks.push(()=>{
          setTimeout(() => {  
            try {
              // 如果 onFulfilled 不是函数且 promise1 成功执行， promise2 必须成功执行并返回相同的值
              if (typeof onFulfilled !== 'function') {
                resolve(this.promiseResult)
              } else {
                let x = onFulfilled(this.promiseResult)
                resolvePromise(promise2, x, resolve, reject)
              }
            } catch (error) {
              reject(error)
            }
          })
        });
        this.onRejectedCallbacks.push(()=>{
          setTimeout(() => {
            try {
              // 如果 onRejected 不是函数且 promise1 失败执行， promise2 必须失败执行并返回相同的值
              if (typeof onRejected !== 'function') {
                reject(this.promiseResult)
              } else {
                let x = onRejected(this.promiseResult)
                resolvePromise(promise2, x, resolve, reject)
              }
            } catch (error) {
              reject(error)
            }
          })
        });
      }
      if (this.promiseState === MyPromise.FULFILLED) {
        setTimeout(() => {  
          try {
            // 如果 onFulfilled 不是函数且 promise1 成功执行， promise2 必须成功执行并返回相同的值
            if (typeof onFulfilled !== 'function') {
              resolve(this.promiseResult)
            } else {
              let x = onFulfilled(this.promiseResult)
              resolvePromise(promise2, x, resolve, reject)
            }
          } catch (error) {
            reject(error)
          }
        })
      }
      if (this.promiseState === MyPromise.REJECTED) {
        setTimeout(() => {
          try {
            // 如果 onRejected 不是函数且 promise1 失败执行， promise2 必须失败执行并返回相同的值
            if (typeof onRejected !== 'function') {
              reject(this.promiseResult)
            } else {
              let x = onRejected(this.promiseResult)
              resolvePromise(promise2, x, resolve, reject)
            }
          } catch (error) {
            reject(error)
          }
        })
      }
    })
    return promise2
  }
  // catch() 方法返回一个Promise，并且处理拒绝的情况。它的行为与调用Promise.prototype.then(undefined, onRejected) 相同。
  // 事实上, calling obj.catch(onRejected) 内部calls obj.then(undefined, onRejected)。
  //(这句话的意思是，我们显式使用obj.catch(onRejected)，内部实际调用的是obj.then(undefined, onRejected))
  // Promise.prototype.catch()方法是.then(null, rejection)或.then(undefined, rejection)的别名，用于指定发生错误时的回调函数。
  catch(onRejected) {
    return this.then(null, onRejected)
  }
  // finally() 方法返回一个Promise。在promise结束时，无论结果是fulfilled或者是rejected，都会执行指定的回调函数。这为在Promise是否成功完成后都需要执行的代码提供了一种方式。
  // 由于无法知道promise的最终状态，所以finally的回调函数中不接收任何参数，它仅用于无论最终结果如何都要执行的情况。
  finally(callBack) {
    return this.then(callBack, callBack)
  }
  // Promise.resolve(value) 将给定的一个值转为Promise对象。
  // 如果这个值是一个 promise ，那么将返回这个 promise ；
  // 如果这个值是thenable（即带有"then" 方法），返回的promise会“跟随”这个thenable的对象，采用它的最终状态；
  // 否则返回的promise将以此值完成，即以此值执行resolve()方法 (状态为fulfilled)。
  static resolve(value) {
    // 如果这个值是一个 promise ，那么将返回这个 promise 
    if (value instanceof MyPromise) {
      return value
    }
    // 如果这个值是thenable（即带有`"then" `方法），返回的promise会"跟随"这个thenable的对象，采用它的最终状态
    // 这里的resolve和reject是thenable对象then方法的回调函数参数
    else if (value instanceof Object && 'then' in value) {
      return value.then(resolve, reject)
    }
    // 否则返回一个新的promise对象，状态为fulfilled
    // 这里的resolve是新创建的Promise的executor函数的参数,用于将Promise状态变为fulfilled
    return new MyPromise(resolve => resolve(value))
  }
  // Promise.reject(reason) 返回一个状态为rejected的Promise对象。
  static reject(reason) {
    return new MyPromise((resolve, reject) => reject(reason))
  }

  // Promise.all(promises) 返回一个Promise对象，该Promise对象在 promises 参数内所有的promise都成功时才会触发成功，
  // 一旦有任何一个promises里面的promise失败，则立即触发该promise的失败。
  // 返回的promise对象在触发成功状态以后，会把一个包含 promises 里所有promise返回值的数组作为成功回调的返回值，
  // 如果这个新的promise对象触发了失败状态，它会把 promises 里第一个触发失败的promise对象的错误信息作为它的失败信息。
  static all(promises) {
    return new MyPromise((resolve, reject) => {
      let result = []
      let count = 0
      if (Array.isArray(promises)) { 
        if (promises.length === 0) {
          return resolve([])
        }
        promises.forEach((item, index) => {
          // 判断参数是否为promise与thenable对象
          if (item instanceof MyPromise || (item instanceof Object && 'then' in item)) {
            MyPromise.resolve(item).then(value => {
              result[index] = value
              count++
              if (count === promises.length) {
                resolve(result)
              }
            }, reason => {
              reject(reason)
            })
          } else {  
            // 参数里中非Promise值，原样返回在数组里
            result[index] = item
            count++
            if (count === promises.length) {
              resolve(result)
            }
          }
        })
      } else {
        return reject(new TypeError('Argument is not iterable'))
      }
    })
  }

  // Promise.allSettled(iterable)方法返回一个在所有给定的promise都已经fulfilled或rejected后的promise，
  // 并带有一个对象数组，每个对象表示对应的promise结果。
  // Promise.allSettled() 方法内部将非 Promise 值转换成 Promise 了
  static allSettled(promises) {
    return new MyPromise((resolve, reject) => {
      let result = []
      let count = 0
      if (Array.isArray(promises)) {
        if (promises.length === 0) {
          return resolve(promises)
        }
        promises.forEach((promise, index) => {
          MyPromise.resolve(promise).then(value => {
            result[index] = { status: 'fulfilled', value }
            count++
            if (count === promises.length) {
              resolve(result)
            }
          }, reason => {
            result[index] = { status: 'rejected', reason }
            count++
            if (count === promises.length) {
              resolve(result)
            }
          })
        })
      } else {
        return reject(new TypeError('Argument is not iterable'))
      }
    })
  }
  // Promise.any,这个方法和Promise.all()是相反的。
  // 如果可迭代对象中没有一个 promise 成功（即所有的 promises 都失败/拒绝），
  // 就返回一个失败的 promise 和 AggregateError类型的实例，它是 Error 的一个子类，用于把单一的错误集合在一起
  static any(promises) {
    return new MyPromise((resolve, reject) => {
      if (Array.isArray(promises)) {
        let result = []
        let count = 0
        // 如果传入的参数是一个空的可迭代对象，则返回一个 已失败（already rejected） 状态的 Promise。
        if (promises.length === 0) return reject(new AggregateError('All promises were rejected'));
        promises.forEach(promise => {
        MyPromise.resolve(promise).then(value => {
          resolve(value)
        }, reason => {
          result.push(reason)
          count++
          if (count === promises.length) {
              reject(new AggregateError(result))
            }
          })
        })
      } else {
        return reject(new TypeError('Argument is not iterable'))
      }
    })
  }

  // Promise.race(iterable) 方法返回一个promise，一旦迭代器中的某个promise解决或拒绝，返回的promise就会解决或拒绝。
  static race(promises) {
    return new MyPromise((resolve, reject) => {
      if (Array.isArray(promises)) {
        promises.forEach(promise => {
          MyPromise.resolve(promise).then(resolve, reject)
        })
      } else {
        return reject(new TypeError('Argument is not iterable'))
      }
    })
  }
}


/**
 * 
 * @param {*} promise2 promise1.then方法返回的新的promise对象
 * @param {*} x promise1中onFulfilled或onRejected的返回值
 * @param {*} resolve promise2的resolve方法
 * @param {*} reject promise2的reject方法
 * @returns 
 */
function resolvePromise(promise2, x, resolve, reject) {
  // 如果 promise 和 x 指向同一对象，以 TypeError 为据因拒绝执行 promise
  if (promise2 === x) {
    return reject(new TypeError('Chaining cycle detected for promise'))
  }
  // 如果 x 为 Promise ，则使 promise2 接受 x 的状态
  // 继续执行x的 then 方法， 执行对应的回调函数
  // x resolve(y) ， 继续执行 onFulfilled  resolvePromise(promise2, y, resolve, reject)
  // x reject ， 继续执行 onRejected  reject
  if (x instanceof MyPromise) {
    x.then(y => {
      resolvePromise(promise2, y, resolve, reject)
    }, reject)
  }
  // 如果 x 为对象或函数
  else if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    try {
      var then = x.then;
    } catch (error) {
      // 如果取 x.then 的值时抛出错误 e ，则以 e 为据因拒绝 promise
      return reject(error)
    }
    // 如果 then 是函数，将 x 作为函数的作用域 this 调用之。尝试调用 x的then方法，调用回调函数
    if (typeof then === 'function') {
      // 如果 resolvePromise 和 rejectPromise 均被调用，或者被同一参数调用了多次，则优先采用首次调用并忽略剩下的调用
      let called = false; // 避免多次调用
      
      try {
        // 如果 resolvePromise 以值 y 为参数被调用，则运行 resolvePromise(promise2, y, resolve, reject)
        then.call(x, y => {
          if (called) return;
          called = true;
          resolvePromise(promise2, y, resolve, reject)
        }, r => { // 如果 rejectPromise 以据因 r 为参数被调用，则以据因 r 拒绝 promise
          if (called) return;
          called = true;
          reject(r)
        })
      } catch (error) {
        if (called) return;
        called = true;
        reject(error)
      }
    } else {
      // 如果 then 不是函数，以 x 为参数执行 promise
      resolve(x)
    }
  } else {
    // 如果 x 不为对象或函数，以 x 为参数执行 promise
    resolve(x)
  }
}

// 测试代码
MyPromise.deferred = function () {
  let result = {};
  result.promise = new MyPromise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
}

module.exports = MyPromise;
