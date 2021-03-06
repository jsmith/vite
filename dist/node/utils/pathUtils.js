'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.removeUnRelatedHmrQuery = exports.parseNodeModuleId = exports.isImportRequest = exports.isStaticAsset = exports.isDataUrl = exports.isExternalUrl = exports.bareImportRE = exports.parseWithQuery = exports.cleanUrl = exports.hashRE = exports.queryRE = exports.resolveFrom = void 0
const slash_1 = __importDefault(require('slash'))
const querystring_1 = __importDefault(require('querystring'))
const resolve_1 = __importDefault(require('resolve'))
const resolver_1 = require('../resolver')
let isRunningWithYarnPnp
try {
  isRunningWithYarnPnp = Boolean(require('pnpapi'))
} catch {}
exports.resolveFrom = (root, id) =>
  resolve_1.default.sync(id, {
    basedir: root,
    extensions: resolver_1.supportedExts,
    // necessary to work with pnpm
    preserveSymlinks: isRunningWithYarnPnp || false
  })
exports.queryRE = /\?.*$/
exports.hashRE = /#.*$/
exports.cleanUrl = (url) =>
  url.replace(exports.hashRE, '').replace(exports.queryRE, '')
exports.parseWithQuery = (id) => {
  const queryMatch = id.match(exports.queryRE)
  if (queryMatch) {
    return {
      path: slash_1.default(exports.cleanUrl(id)),
      query: querystring_1.default.parse(queryMatch[0].slice(1))
    }
  }
  return {
    path: id,
    query: {}
  }
}
exports.bareImportRE = /^[^\/\.]/
const externalRE = /^(https?:)?\/\//
exports.isExternalUrl = (url) => externalRE.test(url)
const dataUrlRE = /^\s*data:/i
exports.isDataUrl = (url) => dataUrlRE.test(url)
const imageRE = /\.(png|jpe?g|gif|svg|ico|webp)(\?.*)?$/
const mediaRE = /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/
const fontsRE = /\.(woff2?|eot|ttf|otf)(\?.*)?$/i
/**
 * Check if a file is a static asset that vite can process.
 */
exports.isStaticAsset = (file) => {
  return imageRE.test(file) || mediaRE.test(file) || fontsRE.test(file)
}
/**
 * Check if a request is an import from js instead of a native resource request
 * i.e. differentiate
 * `import('/style.css')`
 * from
 * `<link rel="stylesheet" href="/style.css">`
 *
 * The ?import query is injected by serverPluginModuleRewrite.
 */
exports.isImportRequest = (ctx) => {
  return ctx.query.import != null
}
function parseNodeModuleId(id) {
  const parts = id.split('/')
  let scope = '',
    name = '',
    inPkgPath = ''
  if (id.startsWith('@')) scope = parts.shift()
  name = parts.shift()
  inPkgPath = parts.join('/')
  return {
    scope,
    name,
    inPkgPath
  }
}
exports.parseNodeModuleId = parseNodeModuleId
function removeUnRelatedHmrQuery(url) {
  const { path, query } = exports.parseWithQuery(url)
  delete query.t
  delete query.import
  if (Object.keys(query).length) {
    return path + '?' + querystring_1.default.stringify(query)
  }
  return path
}
exports.removeUnRelatedHmrQuery = removeUnRelatedHmrQuery
//# sourceMappingURL=pathUtils.js.map
