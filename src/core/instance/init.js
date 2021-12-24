/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    // a flag to avoid this being observed
    vm._isVue = true
    // 处理组件配置项 options
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 子组件：性能优化，减少原型链的动态查找，提高执行效率
      initInternalComponent(vm, options)
    } else {
      // 根组件：options 合并，将全局配置选项合并到根组件的局部配置上（如 全局组件合并为 options 内的 component）
      // 组件选项的合并：三种情况
      // 1. Vue.component(ComponentName, _Component) 注册全局组件时，Vue 内置的全局组件和自己定义的全局组件，最终都会合并到 components 选项中
      // 2. { components: { _Component } } 局部注册组件时，执行编译器生成的 render 函数时做了选项合并，会合并全局配置项到组件的局部配置项上
      // 3. 这里的根组件情况
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm

    // 初始化核心：
    // initLifecycle 组件关系属性的初始化: $parent | $children | $root
    initLifecycle(vm)
    // 自定义事件
    // <comp @click="handleClick"></comp>
    // 组件上的事件监听由组件本身来监听，谁触发谁监听
    // this.$emit() | this.on('click', function handleClick() {})
    initEvents(vm)
    // 初始化插槽 获取 this.$slots，定义 this._c(createElement 方法)，即 h 函数
    initRender(vm)
    // 执行 beforeCreate 生命周期函数
    callHook(vm, 'beforeCreate')
    // 初始化 inject，得到 result[key] = value 形式的配置对象，并做响应式处理
    initInjections(vm)
    // 响应式原理核心，处理 props | methods |computed | data | watch ...
    initState(vm)
    // 处理 provide
    // provide/inject 原理，inject 组件主动从 祖代 中查找匹配 key 的 结果，并赋值给 inject 中 key 对应的值，最后得到一个 result[key] = value 的对象
    initProvide(vm)
    // created 生命周期钩子函数
    callHook(vm, 'created')

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// 性能优化，打平  配置对象上的属性，减少 运行时 原型链的查找，提高效率
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  // 基于 vm 实例的构造函数上的 配置对象 options 创建 vm.$options
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  // 从 实例的 options 内取出 属性 给 $options
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  // 有 render 函数则同样复制到 $options
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// 解析构造函数的配置项
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  // 基类
  if (Ctor.super) {
    // 基类的 options
    const superOptions = resolveConstructorOptions(Ctor.super)
    // 缓存 基类 options
    const cachedSuperOptions = Ctor.superOptions
    // 基类 options 与缓存不一致，则说明 基类 options 发生了改变
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 找到 更改的选项
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        // 将 更改的选项 和 extend 选项合并
        extend(Ctor.extendOptions, modifiedOptions)
      }
      // 将新的 options 覆盖
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
