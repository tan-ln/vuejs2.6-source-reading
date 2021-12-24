/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

// 初始化 全局 API 入口
/**
 * 默认配置：Vue.config
 * 工具方法：Vue.util.xx
 * Vue.set | delete | nextTick | obserable
 * Vue.options.components | directives | filters | _base(Vue.options._base = Vue)
 * Vue.use | extent | mixin | component | directive | filter
 */

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config

  /**
   * 禁止直接覆盖 config
   * 即 Vue.config = {} 的形式
   * 而是 Vue.config.newProperty = val 的形式
   */
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  // 将配置代理到 vue 对象上，通过 vue.config 访问
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.

  // 一些内部工具方法
  Vue.util = {
    warn,
    extend,               // 将 A 对象上的属性复制到 B 对象 (to[key] = _from[key])
    mergeOptions,         // 合并选项
    defineReactive        // 给对象设置 getter/setter ，依赖收集，通知更新
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  // 向外暴露 observe 方法
  Vue.observable = <T>(obj: T): T => {
    // 为 obj 对象设置响应式（new Observer()，实例上有 walk 方法，对每个属性 defineReactive）
    observe(obj)
    return obj
  }

  // 在 options 上定义三个对象（component | directive | filter）
  // 即 全局配置上的 Vue.options.components | Vue.options.directives | Vue.options.filtes 选项
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  // 将 Vue 构造函数赋值给 Vue.options._base
  // 在 component | directive | filter 三个方法的定义中，需要自动使用 Vue.extend 方法
  Vue.options._base = Vue

  // 将 keep-alive 组件放到 Vue.options.components 对象中，所有组件都可使用
  extend(Vue.options.components, builtInComponents)

  // 初始化 Vue.use()
  initUse(Vue)
  initMixin(Vue)
  initExtend(Vue)
  // component | directive | filter 放在一个文件
  initAssetRegisters(Vue)
}
