/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  // 从父组件的配置项里拿到 监听器
  // 最终转为 this.$emit() | this.on('click', function handleClick() {})
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn) {
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/

  /**
   * vm.$on() 
   * <Comp @cus-click="handleClick">
   * 将所有的事件和对应的回调放到 vm._events 对象上，
   * 格式：{ event1: [cb1, cb2, ...] }
   */

  // this.$On('cus-click', function() {})
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    // 事件为数组的情况
    // this.$on([event1, event2, ...], function() {})
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      // 一个事件设置多个响应函数
      // this.$on('cus-click', cb1)
      // this.$on('cus-click', cb2)
      // vm._events['cus-click'] = [cb1, cb2, ...]
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup

      // <Comp @hook:mounted="handleHookMounted" />
      // 正则 以 hook:开头的事件
      if (hookRE.test(event)) {
        // 标记为 true，表示当前组件实例存在 hookEvent
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  /**
   * 先通过 $on 添加事件，然后在事件回调函数中，先调用 $off 移除事件监听，再执行 传递进来的回调函数
   * 
   * 即 将用户传递的 回调函数 做了一层包装，
   */
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    // 包装函数
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    // 将包装函数作为事件的回调函数添加
    vm.$on(event, on)
    return vm
  }

  /**
   * 移除 vm._events 对象上指定事件(key)的指定回调函数
   */
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    
    // all
    // 没有提供参数则移除所有监听器 => vm._events = {}
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    // 只提供事件则移除该事件所有监听器
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    // 同时提供了事件与回调，则只移除这个回调的监听器
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }
    // 没有回调，则移除该事件的所有回调(vm._events[event] = [cb1, cb2, ...] => null)
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // specific handler
    // 移除指定事件的指定回调
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  // 触发当前实例上的事件
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      // 提示：在 HTML 中 小驼峰 命名将会转为 全小写 
      // @customClick="handleClick" => @customclick="handleClick"
      // js 则会识别 小驼峰 命名 $on('customClick', cb)
      // 建议使用连字符 @custom-click="handleClick"
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    // 从 vm._events 获取指定事件的所有回调
    let cbs = vm._events[event]
    if (cbs) {
      // 类数组转化为数组
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      // this.$emit('custom-click', arg1, arg2, ...)
      // args = [arg1, arg2, ...]
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        // 执行回调
        // try catch 包裹
        // 实际执行 handler.apply(context, args)
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
