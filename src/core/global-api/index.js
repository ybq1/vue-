/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }

  //这里添加了一个`Vue.config` 对象，后面会用到
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  //注意，循环出来的结果其实是三个 `components`,`directives`,`filters`, 这里先创建了空对象作为容器，后面如果有对应的插件就会放进来
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  //内置组件只有一个，即 `keepAlive`
  extend(Vue.options.components, builtInComponents)

  initUse(Vue) //添加了 Vue.use方法，可以注册插件
  initMixin(Vue) //添加了 Vue.mixin方法
  initExtend(Vue) //添加了 Vue.extend 方法

  //这一步是注册了 `Vue.component`、`Vue.directive`、`Vue.filter` 三个方法，上面的 `Vue.options.components` 等空对象，这三个方法的作用就是把注册的组件放入对应的容器中
  initAssetRegisters(Vue)
}
