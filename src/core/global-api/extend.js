/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'


// 定义  VUe.extend({ data() {}, computed: {} ... }) 方法
// 作用是 使用 基础 Vue 构造器，创建一个 子类
// data 必须是一个函数
export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   * 
   * 扩展 Vue 子类，预设一些配置项
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid

    // 缓存：当用户用同一个配置项 多次调用 Vue.extend() 方法时，第二次调用开始就会使用缓存
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

    // 重点
    // 定义一个 Vue 子类，调用 _init() 方法
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 设置子类的原型对象
    Sub.prototype = Object.create(Super.prototype)
    // 子类的构造函数，指回子类自己
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
    // 合并 options
    // 使用 Vue.extentd 方法定义一个子类，预设一些配置项，就相当于直接使用 Vue 构造函数时的默认配置的一样
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.

    // 将 props 和 computed 代理到子类上，允许通过 this.xxx 的形式访问
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage

    // 将全局方法复制到子类上
    // 允许子类继续向下扩展
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    // 给子类设置配置项 component | directive | filter
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    /**
     * 组件递归自调用的原理
     * {
     *    name: 'Comp',
     *    components: { 'Comp': Comp }
     * }
     */
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
