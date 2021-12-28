/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  // 获取静态 key 如 staticClass | staticStyle 时 保存的 staticKeys
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  // 平台保留标签
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  // 静态节点标记
  markStatic(root)
  // second pass: mark static roots.
  // 静态根节点
  markStaticRoots(root, false)
}

function genStaticKeys (keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
    (keys ? ',' + keys : '')
  )
}

// 标记每个节点是否为静态节点，通过 static 属性来标记
function markStatic (node: ASTNode) {
  // 在节点设置 static 属性，标记节点是否为 静态节点
  node.static = isStatic(node)
  // 元素节点
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      // 非 平台保留标签 && 不是 slot 标签 && 没有 inline-template 属性，则直接结束，不进行后续处理
      return
    }
    // 遍历子节点，对每个子节点做静态标记
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      // 子节点是动态节点，则更新父节点为 动态节点
      if (!child.static) {
        node.static = false
      }
    }
    // 节点存在 v-if else elseif 指令，则对 block(处理 ifConditions 时保存的 el) 进行静态标记
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}

// 标记静态根节点
function markStaticRoots (node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    // 静态节点 或者 v-once 指令
    if (node.static || node.once) {
      // 标记当前节点是否是否是 包裹在 v-for 指令节点内部
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      // 是静态节点，并且其子节点并非只有一个文本节点，这样的节点被标记为 静态根节点
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    // 如果当前节点不是静态根节点，则继续处理子节点，对子节点进行静态根节点的标记
    if (node.children) {
      // 递归标记所有子节点，是否为静态根节点
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    // 节点存在 v-if else elseif，对 block 做静态根节点标记
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

// 非静态节点：
//    表达式 | 有指令绑定 | 是框架内置标签(component、slot) | v-for 指令内部的 template
// 其他情况则为 静态节点 如 文本节点
function isStatic (node: ASTNode): boolean {
  if (node.type === 2) { // expression
    return false
  }
  if (node.type === 3) { // text
    return true
  }
  return !!(node.pre || (
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in (built-in: component | slot ...)
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&  // 不是 v-for 所在的 template 标签
    Object.keys(node).every(isStaticKey)
  ))
}

function isDirectChildOfTemplateFor (node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
