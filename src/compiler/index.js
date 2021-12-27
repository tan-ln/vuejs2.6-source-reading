/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {

  // 执行 baseCompile 之前的所有操作，目的都是 构造最终的编译配置

  // 解析 HTML 模板 解析为 AST 对象
  const ast = parse(template.trim(), options)
  // 优化 遍历 AST 标记静态节点和静态根节点
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  // 生成 可执行函数的 字符串形式
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
