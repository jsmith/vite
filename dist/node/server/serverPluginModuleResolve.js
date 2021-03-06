'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.moduleResolvePlugin = exports.moduleRE = exports.moduleFileToIdMap = exports.moduleIdToFileMap = void 0
const path_1 = __importDefault(require('path'))
const chalk_1 = __importDefault(require('chalk'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const utils_1 = require('../utils')
const url_1 = require('url')
const resolver_1 = require('../resolver')
const debug = require('debug')('vite:resolve')
exports.moduleIdToFileMap = new Map()
exports.moduleFileToIdMap = new Map()
exports.moduleRE = /^\/@modules\//
const getDebugPath = (root, p) => {
  const relative = path_1.default.relative(root, p)
  return relative.startsWith('..') ? p : relative
}
// plugin for resolving /@modules/:id requests.
exports.moduleResolvePlugin = ({ root, app, resolver }) => {
  const vueResolved = utils_1.resolveVue(root)
  app.use(async (ctx, next) => {
    if (!exports.moduleRE.test(ctx.path)) {
      return next()
    }
    // path maybe contain encode chars
    const id = decodeURIComponent(ctx.path.replace(exports.moduleRE, ''))
    ctx.type = 'js'
    const serve = async (id, file, type) => {
      exports.moduleIdToFileMap.set(id, file)
      exports.moduleFileToIdMap.set(file, ctx.path)
      debug(`(${type}) ${id} -> ${getDebugPath(root, file)}`)
      await ctx.read(file)
      return next()
    }
    // special handling for vue runtime in case it's not installed
    if (!vueResolved.isLocal && id in vueResolved) {
      return serve(id, vueResolved[id], 'non-local vue')
    }
    // already resolved and cached
    const cachedPath = exports.moduleIdToFileMap.get(id)
    if (cachedPath) {
      return serve(id, cachedPath, 'cached')
    }
    // resolve from vite optimized modules
    const optimized = resolver_1.resolveOptimizedModule(root, id)
    if (optimized) {
      return serve(id, optimized, 'optimized')
    }
    const referer = ctx.get('referer')
    let importer
    // this is a map file request from browser dev tool
    const isMapFile = ctx.path.endsWith('.map')
    if (referer) {
      importer = new url_1.URL(referer).pathname
    } else if (isMapFile) {
      // for some reason Chrome doesn't provide referer for source map requests.
      // do our best to reverse-infer the importer.
      importer = ctx.path.replace(/\.map$/, '')
    }
    const importerFilePath = importer ? resolver.requestToFile(importer) : root
    const nodeModulePath = resolver_1.resolveNodeModuleFile(
      importerFilePath,
      id
    )
    if (nodeModulePath) {
      return serve(id, nodeModulePath, 'node_modules')
    }
    if (isMapFile && importer) {
      // the resolveNodeModuleFile doesn't work with linked pkg
      // our last try: infer from the dir of importer
      const inferMapPath = path_1.default.join(
        path_1.default.dirname(importerFilePath),
        path_1.default.basename(ctx.path)
      )
      if (fs_extra_1.default.existsSync(inferMapPath)) {
        return serve(id, inferMapPath, 'map file in linked pkg')
      }
    }
    console.error(
      chalk_1.default.red(
        `[vite] Failed to resolve module import "${id}". ` +
          `(imported by ${importer || 'unknown'})`
      )
    )
    ctx.status = 404
  })
}
//# sourceMappingURL=serverPluginModuleResolve.js.map
