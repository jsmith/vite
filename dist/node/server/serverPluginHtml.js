'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.htmlRewritePlugin = void 0
const index_1 = require('./index')
const serverPluginHmr_1 = require('./serverPluginHmr')
const serverPluginClient_1 = require('./serverPluginClient')
const es_module_lexer_1 = require('es-module-lexer')
const utils_1 = require('../utils')
const lru_cache_1 = __importDefault(require('lru-cache'))
const path_1 = __importDefault(require('path'))
const chalk_1 = __importDefault(require('chalk'))
const debug = require('debug')('vite:rewrite')
const rewriteHtmlPluginCache = new lru_cache_1.default({ max: 20 })
exports.htmlRewritePlugin = ({ root, app, watcher, resolver, config }) => {
  const devInjectionCode = `\n<script type="module">import "${serverPluginClient_1.clientPublicPath}"</script>\n`
  const scriptRE = /(<script\b[^>]*>)([\s\S]*?)<\/script>/gm
  const srcRE = /\bsrc=(?:"([^"]+)"|'([^']+)'|([^'"\s]+)\b)/
  async function rewriteHtml(importer, html) {
    await es_module_lexer_1.init
    html = html.replace(scriptRE, (matched, openTag, script) => {
      if (script) {
        return `${openTag}${index_1.rewriteImports(
          root,
          script,
          importer,
          resolver
        )}</script>`
      } else {
        const srcAttr = openTag.match(srcRE)
        if (srcAttr) {
          // register script as a import dep for hmr
          const importee = resolver.normalizePublicPath(
            utils_1.cleanUrl(
              path_1.default.posix.resolve('/', srcAttr[1] || srcAttr[2])
            )
          )
          serverPluginHmr_1.debugHmr(`        ${importer} imports ${importee}`)
          serverPluginHmr_1
            .ensureMapEntry(serverPluginHmr_1.importerMap, importee)
            .add(importer)
        }
        return matched
      }
    })
    return utils_1.injectScriptToHtml(html, devInjectionCode)
  }
  app.use(async (ctx, next) => {
    await next()
    if (ctx.status === 304) {
      return
    }
    if (ctx.response.is('html') && ctx.body) {
      const importer = ctx.path
      const html = await utils_1.readBody(ctx.body)
      if (rewriteHtmlPluginCache.has(html)) {
        debug(`${ctx.path}: serving from cache`)
        ctx.body = rewriteHtmlPluginCache.get(html)
      } else {
        if (!html) return
        ctx.body = await rewriteHtml(importer, html)
        rewriteHtmlPluginCache.set(html, ctx.body)
      }
      return
    }
  })
  watcher.on('change', (file) => {
    const path = resolver.fileToRequest(file)
    if (path.endsWith('.html')) {
      debug(`${path}: cache busted`)
      watcher.send({
        type: 'full-reload',
        path
      })
      console.log(chalk_1.default.green(`[vite] `) + ` ${path} page reloaded.`)
    }
  })
}
//# sourceMappingURL=serverPluginHtml.js.map
