/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  // use 方法用于注册组件插件 Vue.use(plugin)
  // 本质就是在 执行插件暴露出来的 install 方法
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    // 是否存在组件
    // 防止重复注册
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    // plugin 是 对象，直接执行 install 方法
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // plugin 是函数
      plugin.apply(null, args)
    }
    // 放入安装的插件数组中
    installedPlugins.push(plugin)
    return this
  }
}
