/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   * 
   * Vue.component | Vue.directive | Vue.filter
   * 定义 Vue.component = function() {}
   * 用于 注册或获取全局组件
   * 使用 Vue.component('CompName', Vue.extend({ ... }))
   * 或   Vue.component('CompName', { ... })
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        if (type === 'component' && isPlainObject(definition)) {
          // 设置组件名
          definition.name = definition.name || id
          // Vue.extend 方法，基于 definition 扩展一个新的组件子类
          // 后面可以直接 new definition() 实例化一个组件
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        // 放入全局配置上
        // this.options[components] = { CompName: definition }
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
