'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.esbuildPlugin = void 0
const esbuildService_1 = require('../esbuildService')
const utils_1 = require('../utils')
exports.esbuildPlugin = ({ app, config, resolver }) => {
  const jsxConfig = esbuildService_1.resolveJsxOptions(config.jsx)
  app.use(async (ctx, next) => {
    // intercept and return vue jsx helper import
    if (ctx.path === esbuildService_1.vueJsxPublicPath) {
      await ctx.read(esbuildService_1.vueJsxFilePath)
    }
    await next()
    if (
      !esbuildService_1.tjsxRE.test(ctx.path) ||
      !ctx.body ||
      ctx.type === 'text/html' ||
      resolver.isPublicRequest(ctx.path)
    ) {
      return
    }
    ctx.type = 'js'
    const src = await utils_1.readBody(ctx.body)
    const { code, map } = await esbuildService_1.transform(
      src,
      resolver.requestToFile(utils_1.cleanUrl(ctx.url)),
      jsxConfig,
      config.jsx
    )
    ctx.body = code
    if (map) {
      ctx.map = JSON.parse(map)
    }
  })
}
//# sourceMappingURL=serverPluginEsbuild.js.map
