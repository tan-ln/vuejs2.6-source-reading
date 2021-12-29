/* @flow */

import { toNumber, toString, looseEqual, looseIndexOf } from 'shared/util'
import { createTextVNode, createEmptyVNode } from 'core/vdom/vnode'
import { renderList } from './render-list'
import { renderSlot } from './render-slot'
import { resolveFilter } from './resolve-filter'
import { checkKeyCodes } from './check-keycodes'
import { bindObjectProps } from './bind-object-props'
import { renderStatic, markOnce } from './render-static'
import { bindObjectListeners } from './bind-object-listeners'
import { resolveScopedSlots } from './resolve-scoped-slots'
import { bindDynamicKeys, prependModifier } from './bind-dynamic-keys'

export function installRenderHelpers (target: any) {
  target._o = markOnce
  // parseFloat 转换为数值
  target._n = toNumber
  // 转换为 字符串，对象：JSON.strigify() 原始值：String
  target._s = toString
  // v-for
  target._l = renderList
  // 插槽 slot
  target._t = renderSlot
  // 两个值相等 类似 ==
  target._q = looseEqual
  // 类似 indexOf
  target._i = looseIndexOf
  // 静态树 vnode
  target._m = renderStatic
  target._f = resolveFilter
  target._k = checkKeyCodes
  target._b = bindObjectProps
  // 文本节点
  target._v = createTextVNode
  // 空节点
  target._e = createEmptyVNode
  // 作用域插槽
  target._u = resolveScopedSlots
  target._g = bindObjectListeners
  target._d = bindDynamicKeys
  target._p = prependModifier
}
