'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.transform = exports.stopService = exports.resolveJsxOptions = exports.vueJsxFilePath = exports.vueJsxPublicPath = exports.tjsxRE = void 0
const path_1 = __importDefault(require('path'))
const chalk_1 = __importDefault(require('chalk'))
const esbuild_1 = require('esbuild')
const utils_1 = require('./utils')
const debug = require('debug')('vite:esbuild')
exports.tjsxRE = /\.(tsx?|jsx)$/
exports.vueJsxPublicPath = '/vite/jsx'
exports.vueJsxFilePath = path_1.default.resolve(
  __dirname,
  '../client/vueJsxCompat.js'
)
const JsxPresets = {
  vue: { jsxFactory: 'jsx', jsxFragment: 'Fragment' },
  preact: { jsxFactory: 'h', jsxFragment: 'Fragment' },
  react: {} // use esbuild default
}
function resolveJsxOptions(options = 'vue') {
  if (typeof options === 'string') {
    if (!(options in JsxPresets)) {
      console.error(`[vite] unknown jsx preset: '${options}'.`)
    }
    return JsxPresets[options] || {}
  } else if (options) {
    return {
      jsxFactory: options.factory,
      jsxFragment: options.fragment
    }
  }
}
exports.resolveJsxOptions = resolveJsxOptions
// lazy start the service
let _servicePromise
const ensureService = async () => {
  if (!_servicePromise) {
    _servicePromise = esbuild_1.startService()
  }
  return _servicePromise
}
exports.stopService = async () => {
  if (_servicePromise) {
    const service = await _servicePromise
    service.stop()
    _servicePromise = undefined
  }
}
// transform used in server plugins with a more friendly API
exports.transform = async (src, request, options = {}, jsxOption) => {
  const service = await ensureService()
  const file = utils_1.cleanUrl(request)
  options = {
    loader: options.loader || path_1.default.extname(file).slice(1),
    sourcemap: true,
    // ensure source file name contains full query
    sourcefile: request,
    target: 'es2020',
    ...options
  }
  try {
    const result = await service.transform(src, options)
    if (result.warnings.length) {
      console.error(`[vite] warnings while transforming ${file} with esbuild:`)
      result.warnings.forEach((m) => printMessage(m, src))
    }
    let code = result.js
    // if transpiling (j|t)sx file, inject the imports for the jsx helper and
    // Fragment.
    if (file.endsWith('x')) {
      if (!jsxOption || jsxOption === 'vue') {
        code +=
          `\nimport { jsx } from '${exports.vueJsxPublicPath}'` +
          `\nimport { Fragment } from 'vue'`
      }
      if (jsxOption === 'preact') {
        code += `\nimport { h, Fragment } from 'preact'`
      }
    }
    return {
      code,
      map: result.jsSourceMap
    }
  } catch (e) {
    console.error(
      chalk_1.default.red(
        `[vite] error while transforming ${file} with esbuild:`
      )
    )
    if (e.errors) {
      e.errors.forEach((m) => printMessage(m, src))
    } else {
      console.error(e)
    }
    debug(`options used: `, options)
    return {
      code: '',
      map: undefined
    }
  }
}
function printMessage(m, code) {
  console.error(chalk_1.default.yellow(m.text))
  if (m.location) {
    const lines = code.split(/\r?\n/g)
    const line = Number(m.location.line)
    const column = Number(m.location.column)
    const offset =
      lines
        .slice(0, line - 1)
        .map((l) => l.length)
        .reduce((total, l) => total + l + 1, 0) + column
    console.error(
      require('@vue/compiler-dom').generateCodeFrame(code, offset, offset + 1)
    )
  }
}
//# sourceMappingURL=esbuildService.js.map
