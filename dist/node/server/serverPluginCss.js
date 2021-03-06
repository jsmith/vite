'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.codegenCss = exports.cssPlugin = exports.debugCSS = void 0
const path_1 = require('path')
const hash_sum_1 = __importDefault(require('hash-sum'))
const utils_1 = require('../utils')
const serverPluginVue_1 = require('./serverPluginVue')
const cssUtils_1 = require('../utils/cssUtils')
const querystring_1 = __importDefault(require('querystring'))
const chalk_1 = __importDefault(require('chalk'))
const serverPluginClient_1 = require('./serverPluginClient')
const rollup_pluginutils_1 = require('rollup-pluginutils')
exports.debugCSS = require('debug')('vite:css')
exports.cssPlugin = ({ root, app, watcher, resolver }) => {
  app.use(async (ctx, next) => {
    await next()
    // handle .css imports
    if (
      cssUtils_1.isCSSRequest(ctx.path) &&
      // note ctx.body could be null if upstream set status to 304
      ctx.body
    ) {
      const id = JSON.stringify(hash_sum_1.default(ctx.path))
      if (utils_1.isImportRequest(ctx)) {
        const { css, modules } = await processCss(root, ctx)
        ctx.type = 'js'
        // we rewrite css with `?import` to a js module that inserts a style
        // tag linking to the actual raw url
        ctx.body = codegenCss(id, css, modules)
      }
    }
  })
  watcher.on('change', (filePath) => {
    if (cssUtils_1.isCSSRequest(filePath)) {
      const publicPath = resolver.fileToRequest(filePath)
      /** filter unused files */
      if (
        !cssUtils_1.cssImporterMap.has(filePath) &&
        !processedCSS.has(publicPath) &&
        !serverPluginVue_1.srcImportMap.has(filePath)
      ) {
        return exports.debugCSS(
          `${path_1.basename(
            publicPath
          )} has changed, but it is not currently in use`
        )
      }
      if (serverPluginVue_1.srcImportMap.has(filePath)) {
        // handle HMR for <style src="xxx.css">
        // it cannot be handled as simple css import because it may be scoped
        const styleImport = serverPluginVue_1.srcImportMap.get(filePath)
        serverPluginVue_1.vueCache.del(filePath)
        vueStyleUpdate(styleImport)
        return
      }
      // handle HMR for module css
      // it cannot be handled as normal css because the js exports may change
      if (filePath.includes('.module')) {
        moduleCssUpdate(filePath, resolver)
      }
      const boundaries = cssUtils_1.getCssImportBoundaries(filePath)
      if (boundaries.size) {
        for (let boundary of boundaries) {
          if (boundary.includes('.module')) {
            moduleCssUpdate(boundary, resolver)
          } else if (boundary.includes('.vue')) {
            serverPluginVue_1.vueCache.del(utils_1.cleanUrl(boundary))
            vueStyleUpdate(resolver.fileToRequest(boundary))
          } else {
            normalCssUpdate(resolver.fileToRequest(boundary))
          }
        }
        return
      }
      // no boundaries
      normalCssUpdate(publicPath)
    }
  })
  function vueStyleUpdate(styleImport) {
    const publicPath = utils_1.cleanUrl(styleImport)
    const index = querystring_1.default.parse(styleImport.split('?', 2)[1])
      .index
    const path = `${publicPath}?type=style&index=${index}`
    console.log(
      chalk_1.default.green(`[vite:hmr] `) + `${publicPath} updated. (style)`
    )
    watcher.send({
      type: 'style-update',
      path,
      changeSrcPath: path,
      timestamp: Date.now()
    })
  }
  function moduleCssUpdate(filePath, resolver) {
    // bust process cache
    processedCSS.delete(resolver.fileToRequest(filePath))
    watcher.handleJSReload(filePath)
  }
  function normalCssUpdate(publicPath) {
    // bust process cache
    processedCSS.delete(publicPath)
    watcher.send({
      type: 'style-update',
      path: publicPath,
      changeSrcPath: publicPath,
      timestamp: Date.now()
    })
  }
  // processed CSS is cached in case the user ticks "disable cache" during dev
  // which can lead to unnecessary processing on page reload
  const processedCSS = new Map()
  async function processCss(root, ctx) {
    // source didn't change (marker added by cachedRead)
    // just use previously cached result
    if (ctx.__notModified && processedCSS.has(ctx.path)) {
      return processedCSS.get(ctx.path)
    }
    const css = await utils_1.readBody(ctx.body)
    const filePath = resolver.requestToFile(ctx.path)
    const preprocessLang = ctx.path.replace(
      cssUtils_1.cssPreprocessLangRE,
      '$2'
    )
    const result = await cssUtils_1.compileCss(root, ctx.path, {
      id: '',
      source: css,
      filename: filePath,
      scoped: false,
      modules: ctx.path.includes('.module'),
      preprocessLang,
      preprocessOptions: ctx.config.cssPreprocessOptions,
      modulesOptions: ctx.config.cssModuleOptions
    })
    if (typeof result === 'string') {
      const res = { css: await cssUtils_1.rewriteCssUrls(css, ctx.path) }
      processedCSS.set(ctx.path, res)
      return res
    }
    cssUtils_1.recordCssImportChain(result.dependencies, filePath)
    if (result.errors.length) {
      console.error(`[vite] error applying css transforms: `)
      result.errors.forEach(console.error)
    }
    const res = {
      css: await cssUtils_1.rewriteCssUrls(result.code, ctx.path),
      modules: result.modules
    }
    processedCSS.set(ctx.path, res)
    return res
  }
}
function codegenCss(id, css, modules) {
  let code =
    `import { updateStyle } from "${serverPluginClient_1.clientPublicPath}"\n` +
    `const css = ${JSON.stringify(css)}\n` +
    `updateStyle(${JSON.stringify(id)}, css)\n`
  if (modules) {
    code += rollup_pluginutils_1.dataToEsm(modules, { namedExports: true })
  } else {
    code += `export default css`
  }
  return code
}
exports.codegenCss = codegenCss
//# sourceMappingURL=serverPluginCss.js.map
