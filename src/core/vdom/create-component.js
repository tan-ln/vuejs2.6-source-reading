/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// inline hooks to be invoked on component VNodes during patch
// patch 期间在 组件的 vnode 上调用 内联钩子
const componentVNodeHooks = {
  init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive components, treat as a patch
      // keep-alive 包裹的组件
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      // 非 keep-alive 包裹 或 组件初始化时
      // 实例化 子组件
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance
      )
      // 执行子组件的 $mount 进入挂载阶段，通过编译得到 render 函数，
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    // 用新的 vnode 更新 旧的 vnode 上的属性
    const options = vnode.componentOptions
    const child = vnode.componentInstance = oldVnode.componentInstance
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  /**
   * 销毁组件
   *    1. 如果组件被 keep-alive 组件包裹，则组件失活，不销毁组件实例，从而缓存组件的状态
   *    2. 如果组件未被 keep-alive 包裹，则直接调用实例的 $destroy 方法销毁组件
   */
  destroy (vnode: MountedComponentVNode) {
    // 从 vnode 获取组件实例
    const { componentInstance } = vnode
    // 如果组件没有被销毁
    if (!componentInstance._isDestroyed) {
      // 没有被 keep-alive 包裹
      if (!vnode.data.keepAlive) {
        // 则直接调用 $destroy() 方法销毁组件
        componentInstance.$destroy()
      } else {
        // 被 keep-alive 包裹的组件，让组件失活，不销毁组件，从而缓存组件状态
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

/**
 * 
 * @param {*} Ctor 组件的构造函数
 * @param {*} data 属性对象
 * @param {*} context 上下文
 * @param {*} children 子节点数组
 * @param {*} tag 标签名
 * @returns 
 */
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return
  }

  // 内部方法，等于 Vue.extend
  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  // 如果 Ctor 是组件的配置项，则通过 Vue.extend(options) 方法将其转换为组件的构造函数
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // 这个阶段还不是函数的话，当前组件定义有问题
  // reject.
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // async component
  let asyncFactory
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor)
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  // 子组件做 选项合并的地方
  // 即编译器将组件编译为渲染函数，渲染时执行 render 函数，然后执行其中的 _c 就会走到这里，然后做选项合并
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  // 组件的 v-model 信息(值和回调函数)转换为 data.attrs 对象上的属性、值 和 data.on 对象上的事件名和回调
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  // 父子组件传值原理，父组件data更新重新执行 _c、 extractPropsFromVNodeData
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component 函数式组件，生成 vnode 并返回
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // 走到这里说明 当前组件是一个普通的自定义组件（不是函数式）

  // install component management hooks onto the placeholder node
  // 在 data.hook 上安装一些内置 钩子
  // init | prepatch | insert | destroy 方法都会在 patch 阶段被调用
  installComponentHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  // 实例化 vnode 并返回组件的 vnode
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  // Weex specific: invoke recycle-list optimized @render function for
  // extracting cell-slot template.
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode)
  }

  return vnode
}

export function createComponentInstanceForVnode (
  // we know it's MountedComponentVNode but flow doesn't
  vnode: any,
  // activeInstance in lifecycle state
  parent: any
): Component {
  const options: InternalComponentOptions = {
    _isComponent: true,
    _parentVnode: vnode,
    parent
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  // new 组件构造函数 得到组件实例
  return new vnode.componentOptions.Ctor(options)
}

function installComponentHooks (data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  // hooksToMerge = ['init', 'prepatch', 'insert', 'destroy']
  for (let i = 0; i < hooksToMerge.length; i++) {
    // key 如 init
    const key = hooksToMerge[i]
    // 传递的 init 方法
    const existing = hooks[key]
    // 内置的 init 方法 component hook
    const toMerge = componentVNodeHooks[key]
    // mergeHook 合并用户传递的方法 和 内置的方法
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}

function mergeHook (f1: any, f2: any): Function {
  const merged = (a, b) => {
    // flow complains about extra args which is why we use any
    f1(a, b)
    f2(a, b)
  }
  merged._merged = true
  return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.

// v-model 默认 值为value，事件为 input
function transformModel (options, data: any) {
  // 处理属性值 data.attrs[props] = data.model.value
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
  ;(data.attrs || (data.attrs = {}))[prop] = data.model.value
  // 处理事件 data.on[eventName] = data.model.callback
  const on = data.on || (data.on = {})
  const existing = on[event]
  const callback = data.model.callback
  if (isDef(existing)) {
    if (
      Array.isArray(existing)
        ? existing.indexOf(callback) === -1
        : existing !== callback
    ) {
      on[event] = [callback].concat(existing)
    }
  } else {
    on[event] = callback
  }
}
