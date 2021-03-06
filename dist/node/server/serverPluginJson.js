'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.jsonPlugin = void 0
const utils_1 = require('../utils')
const pluginutils_1 = require('@rollup/pluginutils')
exports.jsonPlugin = ({ app }) => {
  app.use(async (ctx, next) => {
    await next()
    // handle .json imports
    // note ctx.body could be null if upstream set status to 304
    if (
      ctx.path.endsWith('.json') &&
      utils_1.isImportRequest(ctx) &&
      ctx.body
    ) {
      ctx.type = 'js'
      ctx.body = pluginutils_1.dataToEsm(
        JSON.parse(await utils_1.readBody(ctx.body)),
        {
          namedExports: true,
          preferConst: true
        }
      )
    }
  })
}
//# sourceMappingURL=serverPluginJson.js.map
