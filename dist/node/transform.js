'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.createBuildJsTransformPlugin = exports.createServerTransformPlugin = void 0
const utils_1 = require('./utils')
const serverPluginSourceMap_1 = require('./server/serverPluginSourceMap')
function createServerTransformPlugin(
  transforms,
  customBlockTransforms,
  resolver
) {
  return ({ app }) => {
    if (!transforms.length && !Object.keys(customBlockTransforms).length) {
      return
    }
    app.use(async (ctx, next) => {
      await next()
      if (
        !ctx.body ||
        (ctx.type === 'text/html' && !utils_1.isImportRequest(ctx)) ||
        resolver.isPublicRequest(ctx.path)
      ) {
        return
      }
      let { url, path, query, __notModified } = ctx
      const id = resolver.requestToFile(url)
      path = resolver.requestToFile(path)
      const isImport = utils_1.isImportRequest(ctx)
      const isBuild = false
      let code = ''
      for (const t of transforms) {
        const transformContext = {
          id,
          path,
          query,
          isImport,
          isBuild
        }
        if (__notModified) {
          transformContext.notModified = true
        }
        if (t.test(transformContext)) {
          code = code || (await utils_1.readBody(ctx.body))
          const result = await t.transform({
            ...transformContext,
            code
          })
          if (typeof result === 'string') {
            code = result
          } else {
            code = result.code
            if (result.map) {
              ctx.map = serverPluginSourceMap_1.mergeSourceMap(
                ctx.map,
                result.map
              )
            }
          }
          ctx.type = 'js'
          ctx.body = code
        }
      }
      // custom blocks
      if (path.endsWith('vue') && query.type === 'custom') {
        const t = customBlockTransforms[query.blockType]
        if (t) {
          ctx.type = 'js'
          code = code || (await utils_1.readBody(ctx.body))
          ctx.body = await t({
            code,
            id,
            path,
            query,
            isImport,
            isBuild
          })
        }
      }
    })
  }
}
exports.createServerTransformPlugin = createServerTransformPlugin
function createBuildJsTransformPlugin(transforms, customBlockTransforms) {
  return {
    name: 'vite:transforms',
    async transform(code, id) {
      const { path, query } = utils_1.parseWithQuery(id)
      let transformed = code
      let map = null
      const runTransform = async (t, ctx) => {
        const result = await t(ctx)
        if (typeof result === 'string') {
          transformed = result
        } else {
          transformed = result.code
          if (result.map) {
            map = serverPluginSourceMap_1.mergeSourceMap(map, result.map)
          }
        }
      }
      for (const t of transforms) {
        const transformContext = {
          code: transformed,
          id,
          path,
          query,
          isImport: true,
          isBuild: true
        }
        if (t.test(transformContext)) {
          await runTransform(t.transform, transformContext)
        }
      }
      // custom blocks
      if (query.vue != null && typeof query.type === 'string') {
        const t = customBlockTransforms[query.type]
        if (t) {
          // normalize lang since rollup-plugin-vue appends it as .xxx
          const normalizedQuery = {}
          for (const key in query) {
            if (key.startsWith(`lang.`)) {
              normalizedQuery.lang = key.slice(5)
            } else {
              normalizedQuery[key] = query[key]
            }
          }
          await runTransform(t, {
            code: transformed,
            id,
            path,
            query: normalizedQuery,
            isImport: true,
            isBuild: true
          })
        }
      }
      return {
        code: transformed,
        map
      }
    }
  }
}
exports.createBuildJsTransformPlugin = createBuildJsTransformPlugin
//# sourceMappingURL=transform.js.map
