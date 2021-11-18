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
    const vm: Component = this // vm 就是this的一个别名而已
    // a uid
    vm._uid = uid++ // 唯一自增ID

    let startTag, endTag
    /* istanbul ignore if */
    //生成一个全局的唯一自增id，如果是非生产环境而且开启了performance，就会调用mark 进行 performance 标记
    //这段代码就是开发模式下收集性能数据的，因为和Vue本身的运行原理无关，我们先跳过
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options

    //我们自己开发的components组件，都不是 _isComponent，会进入 else 中
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      //mergeOptions 是做了一个合并操作
      // 他是把构造函数上的options和我们创建组件时传入的配置 options 进行了一个合并。正是由于合并了这个全局的 options 所以我们在可以直接在组件中使用全局的 directives 等
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }

    // 这段代码可能看起来比较奇怪，这个 renderProxy 是干嘛的呢，其实就是定义了在 render 函数渲染模板的时候，访问属性的时候的一个代理，可以看到生产环境下就是自己。
    // 开发环境下作了一个什么操作呢？暂时不用关心，反正知道渲染模板的时候上下文就是 vm 也就是 this 就行了。如果有兴趣可以看看非生产环境，作了一些友好的报错提醒等。
    // 这里只需要记住，在生产环境下，模板渲染的上下文就是 vm 就行了。
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm) //生命周期初始化工作，初始化了很多变量，最主要的就是设置了父子组件之间的引用关系，即设置了`$parent` 和 `$chiildren`的值
    initEvents(vm) //注册事件，注意：注册的是父组件的事件，并非自己的，因为很明显父组件的监听器才会注册到子组件身上
    initRender(vm) //做一些 render 的准备工作，例如：处理父子间继承关系，并非真的开始 render
    callHook(vm, 'beforeCreate') //准备工作完成，接下来进入 `create` 阶段
    initInjections(vm) // resolve injections before data/props
    initState(vm) // `data` , `props` , `computed` 等都是在这里初始化的，常见的面试考点比如`Vue是如何实现数据响应化的` 答案就在这个函数中寻找
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created') //至此，create 阶段完成

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    // 把父类的options找出来，因为可能父类也有父类，因此这里是递归查找，把`parents`上的所有options都合并到当前。
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions

    //如果找到了，那么就把父类的 `options`和当前的 `options`进行一次合并。
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor //如果指定了`name`，那么在自己身上注册一下自己。这样就可以直接在模板中用了。
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
