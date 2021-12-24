# MVVM
1. 从 MVC 到 MVVM：
  `view(pages)` <--> `Controller(路由、控制器)` <--> `Model(数据 json)`

  `View(HTML)` <--> `ViewModel(DOM监听、数据绑定)` <--> `Model(数据 json)`

- MVC  
`Model` 封装了一些逻辑和操作数据的接口  
`View` 视图用于展示页面 
`Controller` 作为控制器，通过调用接口对数据进行操作并返回给 View 层，承上启下的与 Model、View 双向交流

- `MVVM`
`Model` 数据层，只关心数据方面  
`ViewModel` 事件监听和数据绑定，起到双向绑定的作用，响应式更新数据  
`View` 视图展示页面， {{}} 模板语法

数据变化驱动视图更新，视图变化数据也会同时响应 如 V-Model，是一个双向的过程

# Vue 源码
- Vue 作为 构造函数，通过在构造函数的原型上扩展方法
```js
function Vue(options) {
  this._init(options)      // Vue.prototype._init(options)
}
```

## Vue 初始化时做了什么
1. 处理组件配置项 `options`

```js
Vue.prototype._init = function (options) {
  if (options && options._isComponent) {
    // 子组件：性能优化，减少原型链的动态查找，提高执行效率
    // 基于 vm.constructor.options 创建 vm.$options 并将属性复制给 vm.$options
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
}
```
2. `initLifecycle(vm)`
- 初始化一些组件实例的关系属性：
```js
  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  vm.$children = []
  vm.$refs = {}

  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
```

3. `initEvents(vm)` 初始化自定义事件

- 从父组件的配置项里拿到 监听器
```js
const listeners = vm.$options._parentListeners
```
- 在 `prototype` 上定义 $on | $off | $emit 等方法

4. `initRender(vm)` 
- 定义插槽 `$slot`
- 定义 _c | createElement() 方法

```js
vm.$slots = resolveSlots(options._renderChildren, renderContext)
vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)
```

5. `callHook(vm, 'beforeCreate')` 执行生命周期钩子 beforeCreate()

6. `initInjections(vm)` 初始化 inject

7. `initState(vm)` 初始化 state，响应式处理 props | data | computed | watch | methods ..
对 `props -> methods -> data -> computed -> watch` 初始化，
- 并判重：key 不得与其他 key 重复；
- 将属性配置代理到 vue 实例上，允许通过 this.keyName 的形式访问


8. `initProvide(vm)` 初始化 provide

9. `callHook(vm, 'created')` 执行生命周期钩子 created()

10. 查看是否有 el 选项，有则自动调用 $mount()，没有则需要 手动调用 $mount()
```js
new Vue({
  // el: '#app',
}).$mount()
```

## 响应式原理
> **如何实现 vue 响应式**
1. 响应式核心是通过 Object.defineProperty() 拦截对数据属性的访问和设置来实现的
2. 响应式数据分为两类：
    - **对象**: 循环遍历数据对象的所有属性，为其设置 `getter/setter` 方法，以达到拦截的目的
    > 如果其属性依旧为 *对象*时，则递归每一个 `key` ，为其设置 `getter/setter`
        
      - `this.key` 访问数据时被 `getter` 方法拦截，并调用 `dep.depend()` 方法，，进行依赖收集，在 dep 中存储相关 watcher
      - `obj[key] = val` 时，修改数据触发 `setter` 方法，在其中对新旧值对比，需要改变时 对新值进行响应式处理(observe())，并调用 `dep.notify()` 触发依赖通知 watcher 进行异步更新

    - **数组**：以数组原方法为原型创建新的对象，并在其中重写增强了 7 个可以直接改变数组的方法，通过拦截这 7 个方法进行数组操作
      - 插入新数据时进行响应式处理，然后 dep 通知 watcher 去更新
      - 删除数据时也是由 dep 通知更新

### computed
- 每个计算属性都 实例化一个 `watcher` 对象，一个 computed key 对应一个 watcher key
- computed 的两种形式：function、包含一个 get 方法的对象，最终都会转化为 getter
- 初始化定义 computed 的时候，Object.defineProperty 方法将 computed 的属性代理到 vue，并定义 `getter/setter` 方法
- 访问 computed 时自动调用 getter，执行 createComputedGetter
- `createComputedGetter` 方法调用 computed 回调函数执行，并将 `watcher.dirty = false`，将回调函数执行结果 作为**缓存** 保存在 `watcher.value` 并返回
- 当响应式数据更新时，遍历所有 watcher 并执行他们各自的 update 方法，将 `watcher.dirty = true` ，重新执行 computed 回调函数，计算新值，然后缓存到 `watcher.value`



## 异步更新
- `dep.notify()`
此方法通知所有的 watcher，执行他们的 `watcher.update()`
```js
notify () {
  // 收集的 watcher
  const subs = this.subs.slice()
  // 遍历当前 dep 收集的所有 watcher，让这些 watcher 依次去执行自己的 update 方法
  for (let i = 0, l = subs.length; i < l; i++) {
    subs[i].update()
  }
}
```
- `watcher.update()`
> 根据 watcher 配置项( lazy | async | none )决定怎么走，一般情况是 `queueWatcher(this)` 将当前 watcher 放进 watcher 队列
```js
update () {
  if (this.lazy) {
    // 懒执行，比如 computed
    // 将 dirty 置为 true，在组件更新后，当响应式数据再次被更新时，执行 computed getter 
    // 重新执行 computed 回调函数，计算新值，然后缓存到 watcher.value
    this.dirty = true
  } else if (this.sync) {
    // 同步执行
    // this.$watch() 或者 watch 选项传递一个 sync 配置({ sync: true })
    this.run()
  } else {
    // 放入 watcher 队列（一般都是走这个）
    queueWatcher(this)
  }
}
```

> queueWatcher 方法中，将当前 watcher 放进 watcher 队列后，调用 nextTick() 方法把 flushSchedulerQueue 函数传入 callbacks 数组，
- `queueWatcher`
```js
export function queueWatcher (watcher: Watcher) {
  if (!flushing) {
    // flushing = false 表示当前 watcher 队列没有在刷新，可以直接入队
    queue.push(watcher)
  } else {
    // 当前 watcher 队列已经在刷新，watcher 入队需要特殊操作
    // watcher 队列是有序的
    // 找到 队列中比要插入的 watcher id 大1个的成员，从它的下一个位置插入队列
    // if already flushing, splice the watcher based on its id
    // if already past its id, it will be run next immediately.
    let i = queue.length - 1
    while (i > index && queue[i].id > watcher.id) {
      i--
    }
    queue.splice(i + 1, 0, watcher)
  }

  // 即 this.$nextTick() | Vue.nextTick()
  // 将回调函数 flushSchedulerQueue 放入 callbacks 数组
  // 通过 pending 控制，向浏览器异步任务队列添加 flushCallBack 函数
  nextTick(flushSchedulerQueue)
}
```
> flushSchedulerQueue 函数遍历 watcher 并执行 run()

- `nextTick()`

```js
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  // 将传入的 callback 用 try catch 包一层，便于异常捕获
  // 然后将包装后的函数插入 callbacks
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    // pending = false 执行 timerFunc() 函数，此函数的作用为 将 flushCallbacks（遍历callbacks中的 cb 并执行）插入到 浏览器的 异步任务队列
    // vue 优先使用 promise，即 微任务队列
    // 再重置为 true
    pending = true
    timerFunc()
  }
}
```
- `flushCallbacks`
```js
function flushCallbacks () {
  // 再次置为 false，下一个 flushCallbacks 可以进入异步微任务队列
  // 异步微任务队列 只能存在一个 flushCallbacks 函数
  pending = false
  // 缓存 callbacks 所有
  const copies = callbacks.slice(0)
  // 清空 callbacks
  callbacks.length = 0
  // 执行 callbacks 中所有 函数
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}
const p = Promise.resolve()
timerFunc = () => {
  p.then(flushCallbacks)              // flushCallbacks() 执行 callbacks 中所有
}
```

## 如何实现的异步更新机制
1. 核心是利用浏览器的**异步任务队列**来实现，首选两种微任务 (promise | MutationObserver)，其次宏任务 (setImmediate | setTimeout)
2. 响应式数据更新后，调用 `dep.notify()` 方法，**通知 dep 中收集的 watcher 去执行自己的 update 方法**
3. watcher.update() 方法将当前 watcher 放入一个 watcher 队列 (全局的 queue 数组) 
4. 然后通过 `nextTick(flushSchedulerQueue)` 方法把这个 刷新 watcher 队列的方法（flushSchedulerQueue）放入一个全局的 callbacks 数组中
5. 如果此时浏览器的异步任务队列中没有一个叫 `flushCallbacks` 的函数，则执行 timeFunc 函数，将 flushCallbacks 函数放入浏览器的异步任务队列（promise）
6. 如果已经存在 `flushCallbacks` 则等待执行完成，下一波再放入
7. 这个 `flushCallbacks` 函数 负责执行 callbacks 数组中的所有 `flushSchedulerQueue` 函数，也就是 刷新当前 watcher 队列并执行成员的 watcher.run 方法
8. run 方法就是执行 组件更新函数（rendering watcher）new Watcher 时传入的 updateComponent 方法，进入组件更新；或者用户 watch 的回调函数

## Vue 的 nextTick API 如何实现
`Vue.nextTick()` 或者 `vm.$nextTick()` 就做了两件事：
- 将传递的回调函数用 try catch 包裹（捕捉异常）后，放入 callbacks 数组
> `callbacks` 数组收集了用户调用 `nextTick` 传递的**回调** 或者是 `flushSchedulerQueue` 函数（所有 `watcher.run()`）

- 执行 timerFunc 函数，在浏览器的异步任务队列中 放入一个 刷新 callbacks 数组的函数
```js
const p = Promise.resolve()
timerFunc = () => {
  p.then(flushCallbacks)              // flushCallbacks() 执行 callbacks 中所有
}
```

## 全局 API

### Vue.set
Vue.set(target, key, value)

> 由于 VUe 无法探测普通的新增 property(比如 this.myObj.newProp = 111)，所以通过 Vue.set() 为响应式对象中添加一个 property，可以确保这个 property 是响应式的，并且触发视图更新

1. 用于在运行时添加根级别属性，使该属性必须具有响应式能力
2. 不能是 Vue 实例，或者 Vue 实例的根数据对象( 即 return {} )

```js
new Vue({
  data() {
    return {
      a: 1,
      str: '',
      obj: {},
      arr: [1, 2, 3, { key: val }]
    }
  },
  methods: {
    change() {
      this.b = 2,                     // 不具有响应式
      this.arr[0] = 111，             // 不具有响应式
      this.arr[3].key = 'newVal'      // 具有响应式
    },
    func() {
      Vue.set(this, c, 3),            // 具有响应式
      Vue.set(this.arr, 0, 111)       // 具有响应式
    }
  }
})
```

- 不可在运行时直接 set 一个根级别属性( b: 2 )，这样不具有响应式
- 若是初始化时设置 str 为空字符或者 obj 空对象，运行时再 set 是具有响应式的


### Vue.use
- Vue.use(plugin) 作用：负责安装插件，其实就是执行插件提供的 install 方法
1. 首先会判断插件是否安装过
```js
const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
// 是否存在组件
// 防止重复注册
if (installedPlugins.indexOf(plugin) > -1) {
  return this
}
```
2. 未安装过则执行插件提供的 install 方法，具体做什么由插件自己决定
```js
// plugin 是 对象，直接执行 install 方法
if (typeof plugin.install === 'function') {
  plugin.install.apply(plugin, args)
} else if (typeof plugin === 'function') {
  // plugin 是函数
  plugin.apply(null, args)
}
```

### Vue.mixin
- 负责在全局的配置上合并 options 选项，然后在每个组件生成 vnode 时将全局配置合并到自己的 options 上来

```JS
// 核心 mergeOptions，合并选项
Vue.mixin = function (mixin: Object) {
  this.options = mergeOptions(this.options, mixin)
  return this
}
```

### Vue.component | Vue.directive('my-directive', {}) | Vue.filter('my-filter', {})
- 负责注册全局组件
- 其实就是将组件配置注册到全局配置的 components 选项上，然后各个子组件在生成 vnode 时会将全局的 components 选项合并到 局部的 components 配置上
```js
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
```

### Vue.extend(options)
- Vue.extends 基于 Vue 创建一个子类，参数 options 会作为该子类的默认全局配置，如同 Vue 的默认全局配置一般；
- 所以通过 Vue.extend 扩展一个子类，一大用处就是内置一些公共配置，供子类的子类使用

```js
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

  // 将全局方法复制到子类上
  // 允许子类继续向下扩展
  Sub.extend = Super.extend
  Sub.mixin = Super.mixin
  Sub.use = Super.use
```


### Vue.delete(target, key)
- 删除对象的 property，如果对象是响应式的，确保删除能触发视图更新，
- 这个方法主要用于避开 Vue 不能监测到 property 被删除的限制
- 当然不能删除根级别的响应式属性

```js
  // 数组利用 splice 删除
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target).__ob__
    // 删除对象上的属性 delete 操作符
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  // 触发依赖通知更新
  ob.dep.notify()
```

### Vue.nextTick(cb)
- `Vue.nextTick(cb)` 方法的作用是延迟回调函数 cb 的执行，一般用于 `this.key = newVal` 更改数据后，想要立即获取更改后的 DOM 数据
```js
// 执行 1， 2， 3
this.key = 'newVal'

Vue.nextTick(function() {
  // DOM 更新了
})
```
其内部执行过程：    
1. this.key = 'newVal' 触发依赖通知更新，将负责更新的 watcher 放入 watcher 队列
2. 将刷新 watcher 的函数放入 callbacks 数组中
3.  在浏览器的异步任务队列中放入一个刷新 callbacks 数组的函数
4. Vue.nextTick(cb) 插队，将 cb 函数放入 callbacks 数组
5. 待将来的某个时刻执行刷新 callbacks 数组的函数
6. 然后执行 callbacks 数组的众多函数，触发 watcher.run() 的执行 更新 DOM
7. 由于 cb 函数是在后面放到 callbacks 数组，这就保证了先完成的 DOM 更新，再执行 cb 函数


# wen
1. `<comp @click="handleClick"></comp>` 中谁监听的 click 事件
- 组件上的事件监听由组件本身来监听，谁触发谁监听
- 最终会转化为: `this.$emit() | this.on('click', function handleClick() {})` 的形式

2. `provide/inject` 原理
- `inject` 组件主动从 祖代 中查找匹配 `key` 的结果，并赋值给 `inject` 中 `key` 对应的值，最后得到一个 `result[key] = value` 的对象返回
```js
  const provideKey = inject[key].from
  let source = vm
  while (source) {
    if (source._provided && hasOwn(source._provided, provideKey)) {
      result[key] = source._provided[provideKey]
      break
    }
    source = source.$parent
  }
```
3. `computed` 和 `methods` 区别
- `methods` 每次访问都会执行
- `computed` 通过 watcher 来实现的，对每个 `computed key` 实例化一个 `watcher`，默认 `lazy` 执行；`computed` 每次渲染只执行一次，并将 `watcher.dirty` 置为 `false`，当再次渲染页面调用 `watcher.update()` 方法时，会将 `watcher.dirty` 重置为 `true`，并且执行一次 `computed`

- computed 有两种形式：
```js
// function
computed: {
  show() { return 1 }
}
// 包含 getter 的对象
computed: {
  showA: {
    get: function () {}  // 默认只有 getter，也可以定义 setter
  }
}
```

4. watch
- watch 实际上就是 每个 观察对象 调用 `vm.$watch` 方法，其中会实例化一个 Watcher 对象，并配置参数(deep, immediate)

```js
watch: {
  a: function(val, oldVal) {},
  b: 'someMethod', // 方法名

  // 该回调会在任何被侦听的对象的 property 改变时被调用，不论其被嵌套多深
  c: {
    handler: function(val, oldVal) {},
    deep: true
  },
  d: {
    handler: function(val, oldVal) {},
    immediate: true         // 侦听开始后立即调用
  }，
  e: [                        // 数组，逐一调用
    'handle1',
    function handle2() {}
  ]
}
```

5. computed | watch | methods 区别
- 使用场景
  - methods 一般用于封装一些复杂的逻辑，同步异步处理
  - computed 一般用于简单的同步逻辑，将处理后的数据返回，显示在模板中，以**减轻模板的重量**
  - watch 一般用于需要监测数据变化时，执行异步或者开销较大的操作


> computed | watch 都是通过 watcher 来实现的
  - `computed` 默认 lazy 执行，且不可更改，`watch` 可配置(deep | immediate)
  - 使用场景不同，`watch` 通常用于异步操作，`computed`同步多

- watch | methods 两种东西没有可比性，不过可以把 watch 中一些复杂的逻辑抽离到 methods 中，提高可读性