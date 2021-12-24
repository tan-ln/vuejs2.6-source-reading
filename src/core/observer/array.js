/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

// 基于 Array 原型对象创建一个新的对象
// 覆写(增强) 数组原型方法，使其具有依赖通知更新能力
const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  // 获取原生方法
  const original = arrayProto[method]
  // 在 arrayMethods 对象上重新定义 7 个方法上
  def(arrayMethods, method, function mutator (...args) {
    // 先执行原生的方法，往数组中放新的数据
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 以上 3 种方法需要进行 响应式 处理
    if (inserted) ob.observeArray(inserted)
    // notify change
    // 依赖通知更新
    ob.dep.notify()
    return result
  })
})
