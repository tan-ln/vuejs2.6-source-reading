import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  // Vue.prototype._init(options)
  this._init(options)
}

// 初始化方法
// initLifecycle -> initEvents -> initRender -> callHook(vm, 'beforeCreate') -> initInjections ->
// initState(props | methods |computed | data | watch ...)
// -> initProvide -> callHook(vm, 'created') -> vm.$mount(vm.$options.el)
initMixin(Vue)
// 处理实例方法 数据相关
// $data | $props | $set | $delete | $watch
stateMixin(Vue)
// 实例方法 事件相关
// $on | $once | $off | $emit
eventsMixin(Vue)
// 实例方法 生命周期相关 
// $_update(不向外暴露) | $foreceUpdate | $mount | $destroy
lifecycleMixin(Vue)

// _render(不向外暴露) | $nextTick | installRenderHelpers(工具方法)
renderMixin(Vue)

export default Vue
