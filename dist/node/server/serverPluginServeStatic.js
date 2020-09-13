'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.serveStaticPlugin = exports.seenUrls = void 0
const fs_1 = __importDefault(require('fs'))
const path_1 = __importDefault(require('path'))
const utils_1 = require('../utils')
const chalk_1 = __importDefault(require('chalk'))
const send = require('koa-send')
const debug = require('debug')('vite:history')
exports.seenUrls = new Set()
exports.serveStaticPlugin = ({ root, app, resolver, config }) => {
  app.use(async (ctx, next) => {
    // short circuit requests that have already been explicitly handled
    if (ctx.body || ctx.status !== 404) {
      return
    }
    // warn non-root references to assets under /public/
    if (ctx.path.startsWith('/public/') && utils_1.isStaticAsset(ctx.path)) {
      console.error(
        chalk_1.default.yellow(
          `[vite] files in the public directory are served at the root path.\n` +
            `  ${chalk_1.default.blue(
              ctx.path
            )} should be changed to ${chalk_1.default.blue(
              ctx.path.replace(/^\/public\//, '/')
            )}.`
        )
      )
    }
    // handle possible user request -> file aliases
    const expectsHtml =
      ctx.headers.accept && ctx.headers.accept.includes('text/html')
    if (!expectsHtml) {
      const filePath = resolver.requestToFile(ctx.path)
      if (
        filePath !== ctx.path &&
        fs_1.default.existsSync(filePath) &&
        fs_1.default.statSync(filePath).isFile()
      ) {
        await ctx.read(filePath)
      }
    }
    await next()
    // the first request to the server should never 304
    if (exports.seenUrls.has(ctx.url) && ctx.fresh) {
      ctx.status = 304
    }
    exports.seenUrls.add(ctx.url)
  })
  app.use(require('koa-etag')())
  app.use(require('koa-static')(root))
  app.use(require('koa-static')(path_1.default.join(root, 'public')))
  // history API fallback
  app.use(async (ctx, next) => {
    if (ctx.status !== 404) {
      return next()
    }
    if (ctx.method !== 'GET') {
      debug(`not redirecting ${ctx.url} (not GET)`)
      return next()
    }
    const accept = ctx.headers && ctx.headers.accept
    if (typeof accept !== 'string') {
      debug(`not redirecting ${ctx.url} (no headers.accept)`)
      return next()
    }
    if (accept.includes('application/json')) {
      debug(`not redirecting ${ctx.url} (json)`)
      return next()
    }
    if (!accept.includes('text/html')) {
      debug(`not redirecting ${ctx.url} (not accepting html)`)
      return next()
    }
    debug(`redirecting ${ctx.url} to /index.html`)
    try {
      await send(ctx, `index.html`, { root })
    } catch (e) {
      ctx.url = '/index.html'
      ctx.status = 404
      return next()
    }
  })
}
//# sourceMappingURL=serverPluginServeStatic.js.map
