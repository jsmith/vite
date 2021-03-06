'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.sourceMapPlugin = exports.mergeSourceMap = void 0
const merge_source_map_1 = __importDefault(require('merge-source-map'))
function mergeSourceMap(oldMap, newMap) {
  if (!oldMap) {
    return newMap
  }
  // merge-source-map will overwrite original sources if newMap also has
  // sourcesContent
  newMap.sourcesContent = []
  return merge_source_map_1.default(oldMap, newMap)
}
exports.mergeSourceMap = mergeSourceMap
function genSourceMapString(map) {
  if (typeof map !== 'string') {
    map = JSON.stringify(map)
  }
  return `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(
    map
  ).toString('base64')}`
}
exports.sourceMapPlugin = ({ app }) => {
  app.use(async (ctx, next) => {
    await next()
    if (typeof ctx.body === 'string' && ctx.map) {
      ctx.body += genSourceMapString(ctx.map)
    }
  })
}
//# sourceMappingURL=serverPluginSourceMap.js.map
