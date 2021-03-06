'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.resolveNodeModuleFile = exports.resolveNodeModule = exports.resolveOptimizedModule = exports.resolveBareModuleRequest = exports.jsSrcRE = exports.createResolver = exports.mainFields = exports.supportedExts = void 0
const fs_extra_1 = __importDefault(require('fs-extra'))
const path_1 = __importDefault(require('path'))
const slash_1 = __importDefault(require('slash'))
const utils_1 = require('./utils')
const serverPluginModuleResolve_1 = require('./server/serverPluginModuleResolve')
const optimizer_1 = require('./optimizer')
const serverPluginClient_1 = require('./server/serverPluginClient')
const chalk_1 = __importDefault(require('chalk'))
const pluginAssets_1 = require('./optimizer/pluginAssets')
const debug = require('debug')('vite:resolve')
const isWin = require('os').platform() === 'win32'
const pathSeparator = isWin ? '\\' : '/'
exports.supportedExts = ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
exports.mainFields = ['module', 'jsnext', 'jsnext:main', 'browser', 'main']
const defaultRequestToFile = (publicPath, root) => {
  if (serverPluginModuleResolve_1.moduleRE.test(publicPath)) {
    const id = publicPath.replace(serverPluginModuleResolve_1.moduleRE, '')
    const cachedNodeModule = serverPluginModuleResolve_1.moduleIdToFileMap.get(
      id
    )
    if (cachedNodeModule) {
      return cachedNodeModule
    }
    // try to resolve from optimized modules
    const optimizedModule = resolveOptimizedModule(root, id)
    if (optimizedModule) {
      return optimizedModule
    }
    // try to resolve from normal node_modules
    const nodeModule = resolveNodeModuleFile(root, id)
    if (nodeModule) {
      serverPluginModuleResolve_1.moduleIdToFileMap.set(id, nodeModule)
      return nodeModule
    }
  }
  const publicDirPath = path_1.default.join(root, 'public', publicPath.slice(1))
  if (fs_extra_1.default.existsSync(publicDirPath)) {
    return publicDirPath
  }
  return path_1.default.join(root, publicPath.slice(1))
}
const defaultFileToRequest = (filePath, root) =>
  serverPluginModuleResolve_1.moduleFileToIdMap.get(filePath) ||
  '/' +
    slash_1
      .default(path_1.default.relative(root, filePath))
      .replace(/^public\//, '')
const isFile = (file) => {
  try {
    return fs_extra_1.default.statSync(file).isFile()
  } catch (e) {
    return false
  }
}
/**
 * this function resolve fuzzy file path. examples:
 * /path/file is a fuzzy file path for /path/file.tsx
 * /path/dir is a fuzzy file path for /path/dir/index.js
 *
 * returning undefined indicates the filePath is not fuzzy:
 * it is already an exact file path, or it can't match any file
 */
const resolveFilePathPostfix = (filePath) => {
  const cleanPath = utils_1.cleanUrl(filePath)
  if (!isFile(cleanPath)) {
    let postfix = ''
    for (const ext of exports.supportedExts) {
      if (isFile(cleanPath + ext)) {
        postfix = ext
        break
      }
      if (isFile(path_1.default.join(cleanPath, '/index' + ext))) {
        postfix = '/index' + ext
        break
      }
    }
    const queryMatch = filePath.match(/\?.*$/)
    const query = queryMatch ? queryMatch[0] : ''
    const resolved = cleanPath + postfix + query
    if (resolved !== filePath) {
      debug(`(postfix) ${filePath} -> ${resolved}`)
      return postfix
    }
  }
}
const isDir = (p) =>
  fs_extra_1.default.existsSync(p) &&
  fs_extra_1.default.statSync(p).isDirectory()
function createResolver(root, resolvers = [], userAlias = {}) {
  resolvers = [...resolvers]
  const literalAlias = {}
  const literalDirAlias = {}
  const resolveAlias = (alias) => {
    for (const key in alias) {
      let target = alias[key]
      // aliasing a directory
      if (
        key.startsWith('/') &&
        key.endsWith('/') &&
        path_1.default.isAbsolute(target)
      ) {
        // check first if this is aliasing to a path from root
        const fromRoot = path_1.default.join(root, target)
        if (isDir(fromRoot)) {
          target = fromRoot
        } else if (!isDir(target)) {
          continue
        }
        resolvers.push({
          requestToFile(publicPath) {
            if (publicPath.startsWith(key)) {
              return path_1.default.join(target, publicPath.slice(key.length))
            }
          },
          fileToRequest(filePath) {
            if (filePath.startsWith(target + pathSeparator)) {
              return slash_1.default(
                key + path_1.default.relative(target, filePath)
              )
            }
          }
        })
        literalDirAlias[key] = target
      } else {
        literalAlias[key] = target
      }
    }
  }
  resolvers.forEach((r) => {
    if (r.alias && typeof r.alias === 'object') {
      resolveAlias(r.alias)
    }
  })
  resolveAlias(userAlias)
  const requestToFileCache = new Map()
  const fileToRequestCache = new Map()
  const resolver = {
    requestToFile(publicPath) {
      if (requestToFileCache.has(publicPath)) {
        return requestToFileCache.get(publicPath)
      }
      let resolved
      for (const r of resolvers) {
        const filepath = r.requestToFile && r.requestToFile(publicPath, root)
        if (filepath) {
          resolved = filepath
          break
        }
      }
      if (!resolved) {
        resolved = defaultRequestToFile(publicPath, root)
      }
      const postfix = resolveFilePathPostfix(resolved)
      if (postfix) {
        if (postfix[0] === '/') {
          resolved = path_1.default.join(resolved, postfix)
        } else {
          resolved += postfix
        }
      }
      requestToFileCache.set(publicPath, resolved)
      return resolved
    },
    fileToRequest(filePath) {
      if (fileToRequestCache.has(filePath)) {
        return fileToRequestCache.get(filePath)
      }
      for (const r of resolvers) {
        const request = r.fileToRequest && r.fileToRequest(filePath, root)
        if (request) return request
      }
      const res = defaultFileToRequest(filePath, root)
      fileToRequestCache.set(filePath, res)
      return res
    },
    /**
     * Given a fuzzy public path, resolve missing extensions and /index.xxx
     */
    normalizePublicPath(publicPath) {
      if (publicPath === serverPluginClient_1.clientPublicPath) {
        return publicPath
      }
      // preserve query
      const queryMatch = publicPath.match(/\?.*$/)
      const query = queryMatch ? queryMatch[0] : ''
      const cleanPublicPath = utils_1.cleanUrl(publicPath)
      const finalize = (result) => {
        result += query
        if (
          resolver.requestToFile(result) !== resolver.requestToFile(publicPath)
        ) {
          throw new Error(
            `[vite] normalizePublicPath check fail. please report to vite.`
          )
        }
        return result
      }
      if (!serverPluginModuleResolve_1.moduleRE.test(cleanPublicPath)) {
        return finalize(
          resolver.fileToRequest(resolver.requestToFile(cleanPublicPath))
        )
      }
      const filePath = resolver.requestToFile(cleanPublicPath)
      const cacheDir = optimizer_1.resolveOptimizedCacheDir(root)
      if (cacheDir) {
        const relative = path_1.default.relative(cacheDir, filePath)
        if (!relative.startsWith('..')) {
          return finalize(
            path_1.default.posix.join('/@modules/', slash_1.default(relative))
          )
        }
      }
      // fileToRequest doesn't work with files in node_modules
      // because of edge cases like symlinks or yarn-aliased-install
      // or even aliased-symlinks
      // example id: "@babel/runtime/helpers/esm/slicedToArray"
      // see the test case: /playground/TestNormalizePublicPath.vue
      const id = cleanPublicPath.replace(
        serverPluginModuleResolve_1.moduleRE,
        ''
      )
      const { scope, name, inPkgPath } = utils_1.parseNodeModuleId(id)
      if (!inPkgPath) return publicPath
      let filePathPostFix = ''
      let findPkgFrom = filePath
      while (!filePathPostFix.startsWith(inPkgPath)) {
        // some package contains multi package.json...
        // for example: @babel/runtime@7.10.2/helpers/esm/package.json
        const pkgPath = utils_1.lookupFile(findPkgFrom, ['package.json'], true)
        if (!pkgPath) {
          throw new Error(
            `[vite] can't find package.json for a node_module file: ` +
              `"${publicPath}". something is wrong.`
          )
        }
        filePathPostFix = slash_1.default(
          path_1.default.relative(path_1.default.dirname(pkgPath), filePath)
        )
        findPkgFrom = path_1.default.join(
          path_1.default.dirname(pkgPath),
          '../'
        )
      }
      return finalize(
        ['/@modules', scope, name, filePathPostFix].filter(Boolean).join('/')
      )
    },
    alias(id) {
      let aliased = literalAlias[id]
      if (aliased) {
        return aliased
      }
      for (const r of resolvers) {
        aliased =
          r.alias && typeof r.alias === 'function' ? r.alias(id) : undefined
        if (aliased) {
          return aliased
        }
      }
    },
    resolveRelativeRequest(importer, importee) {
      const queryMatch = importee.match(utils_1.queryRE)
      let resolved = importee
      if (importee.startsWith('.')) {
        resolved = path_1.default.posix.resolve(
          path_1.default.posix.dirname(importer),
          importee
        )
        for (const alias in literalDirAlias) {
          if (importer.startsWith(alias)) {
            if (!resolved.startsWith(alias)) {
              // resolved path is outside of alias directory, we need to use
              // its full path instead
              const importerFilePath = resolver.requestToFile(importer)
              const importeeFilePath = path_1.default.resolve(
                path_1.default.dirname(importerFilePath),
                importee
              )
              resolved = resolver.fileToRequest(importeeFilePath)
            }
            break
          }
        }
      }
      return {
        pathname:
          utils_1.cleanUrl(resolved) +
          // path resolve strips ending / which should be preserved
          (importee.endsWith('/') && !resolved.endsWith('/') ? '/' : ''),
        query: queryMatch ? queryMatch[0] : ''
      }
    },
    isPublicRequest(publicPath) {
      return resolver
        .requestToFile(publicPath)
        .startsWith(path_1.default.resolve(root, 'public'))
    }
  }
  return resolver
}
exports.createResolver = createResolver
exports.jsSrcRE = /\.(?:(?:j|t)sx?|vue)$|\.mjs$/
const deepImportRE = /^([^@][^/]*)\/|^(@[^/]+\/[^/]+)\//
/**
 * Redirects a bare module request to a full path under /@modules/
 * It resolves a bare node module id to its full entry path so that relative
 * imports from the entry can be correctly resolved.
 * e.g.:
 * - `import 'foo'` -> `import '/@modules/foo/dist/index.js'`
 * - `import 'foo/bar/baz'` -> `import '/@modules/foo/bar/baz.js'`
 */
function resolveBareModuleRequest(root, id, importer, resolver) {
  const optimized = resolveOptimizedModule(root, id)
  if (optimized) {
    // ensure optimized module requests always ends with `.js` - this is because
    // optimized deps may import one another and in the built bundle their
    // relative import paths ends with `.js`. If we don't append `.js` during
    // rewrites, it may result in duplicated copies of the same dep.
    return path_1.default.extname(id) === '.js' ? id : id + '.js'
  }
  let isEntry = false
  const basedir = path_1.default.dirname(resolver.requestToFile(importer))
  const pkgInfo = resolveNodeModule(basedir, id, resolver)
  if (pkgInfo) {
    if (!pkgInfo.entry) {
      console.error(
        chalk_1.default.yellow(
          `[vite] dependency ${id} does not have default entry defined in ` +
            `package.json.`
        )
      )
    } else {
      isEntry = true
      id = pkgInfo.entry
    }
  }
  if (!isEntry) {
    const deepMatch = !isEntry && id.match(deepImportRE)
    if (deepMatch) {
      // deep import
      const depId = deepMatch[1] || deepMatch[2]
      // check if this is a deep import to an optimized dep.
      if (resolveOptimizedModule(root, depId)) {
        if (resolver.alias(depId) === id) {
          // this is a deep import but aliased from a bare module id.
          // redirect it the optimized copy.
          return resolveBareModuleRequest(root, depId, importer, resolver)
        }
        if (!pluginAssets_1.isAsset(id)) {
          // warn against deep imports to optimized dep
          console.error(
            chalk_1.default.yellow(
              `\n[vite] Avoid deep import "${id}" (imported by ${importer})\n` +
                `because "${depId}" has been pre-optimized by vite into a single file.\n` +
                `Prefer importing directly from the module entry:\n` +
                chalk_1.default.cyan(
                  `\n  import { ... } from "${depId}" \n\n`
                ) +
                `If the dependency requires deep import to function properly, \n` +
                `add the deep path to ${chalk_1.default.cyan(
                  `optimizeDeps.include`
                )} in vite.config.js.\n`
            )
          )
        }
      }
      // resolve ext for deepImport
      const filePath = resolveNodeModuleFile(root, id)
      if (filePath) {
        const deepPath = id.replace(deepImportRE, '')
        const normalizedFilePath = slash_1.default(filePath)
        const postfix = normalizedFilePath.slice(
          normalizedFilePath.lastIndexOf(deepPath) + deepPath.length
        )
        id += postfix
      }
    }
  }
  // check and warn deep imports on optimized modules
  const ext = path_1.default.extname(id)
  if (!exports.jsSrcRE.test(ext)) {
    // append import query for non-js deep imports
    return id + (utils_1.queryRE.test(id) ? '&import' : '?import')
  } else {
    return id
  }
}
exports.resolveBareModuleRequest = resolveBareModuleRequest
const viteOptimizedMap = new Map()
function resolveOptimizedModule(root, id) {
  const cacheKey = `${root}#${id}`
  const cached = viteOptimizedMap.get(cacheKey)
  if (cached) {
    return cached
  }
  const cacheDir = optimizer_1.resolveOptimizedCacheDir(root)
  if (!cacheDir) return
  const tryResolve = (file) => {
    file = path_1.default.join(cacheDir, file)
    if (
      fs_extra_1.default.existsSync(file) &&
      fs_extra_1.default.statSync(file).isFile()
    ) {
      viteOptimizedMap.set(cacheKey, file)
      return file
    }
  }
  return tryResolve(id) || tryResolve(id + '.js')
}
exports.resolveOptimizedModule = resolveOptimizedModule
const nodeModulesInfoMap = new Map()
const nodeModulesFileMap = new Map()
function resolveNodeModule(root, id, resolver) {
  const cacheKey = `${root}#${id}`
  const cached = nodeModulesInfoMap.get(cacheKey)
  if (cached) {
    return cached
  }
  let pkgPath
  try {
    // see if the id is a valid package name
    pkgPath = utils_1.resolveFrom(root, `${id}/package.json`)
  } catch (e) {
    debug(`failed to resolve package.json for ${id}`)
  }
  if (pkgPath) {
    // if yes, this is a entry import. resolve entry file
    let pkg
    try {
      pkg = fs_extra_1.default.readJSONSync(pkgPath)
    } catch (e) {
      return
    }
    let entryPoint
    // TODO properly support conditional exports
    // https://nodejs.org/api/esm.html#esm_conditional_exports
    // Note: this would require @rollup/plugin-node-resolve to support it too
    // or we will have to implement that logic in vite's own resolve plugin.
    if (!entryPoint) {
      for (const field of exports.mainFields) {
        if (typeof pkg[field] === 'string') {
          entryPoint = pkg[field]
          break
        }
      }
    }
    if (!entryPoint) {
      entryPoint = 'index.js'
    }
    // resolve object browser field in package.json
    // https://github.com/defunctzombie/package-browser-field-spec
    const browserField = pkg.browser
    if (entryPoint && browserField && typeof browserField === 'object') {
      entryPoint = mapWithBrowserField(entryPoint, browserField)
    }
    debug(`(node_module entry) ${id} -> ${entryPoint}`)
    // save resolved entry file path using the deep import path as key
    // e.g. foo/dist/foo.js
    // this is the path raw imports will be rewritten to, and is what will
    // be passed to resolveNodeModuleFile().
    let entryFilePath
    // respect user manual alias
    const aliased = resolver.alias(id)
    if (aliased && aliased !== id) {
      entryFilePath = resolveNodeModuleFile(root, aliased)
    }
    if (!entryFilePath && entryPoint) {
      // #284 some packages specify entry without extension...
      entryFilePath = path_1.default.join(
        path_1.default.dirname(pkgPath),
        entryPoint
      )
      const postfix = resolveFilePathPostfix(entryFilePath)
      if (postfix) {
        entryPoint += postfix
        entryFilePath += postfix
      }
      entryPoint = path_1.default.posix.join(id, entryPoint)
      // save the resolved file path now so we don't need to do it again in
      // resolveNodeModuleFile()
      nodeModulesFileMap.set(entryPoint, entryFilePath)
    }
    const result = {
      entry: entryPoint,
      entryFilePath,
      pkg
    }
    nodeModulesInfoMap.set(cacheKey, result)
    return result
  }
}
exports.resolveNodeModule = resolveNodeModule
function resolveNodeModuleFile(root, id) {
  const cacheKey = `${root}#${id}`
  const cached = nodeModulesFileMap.get(cacheKey)
  if (cached) {
    return cached
  }
  try {
    const resolved = utils_1.resolveFrom(root, id)
    nodeModulesFileMap.set(cacheKey, resolved)
    return resolved
  } catch (e) {
    // error will be reported downstream
  }
}
exports.resolveNodeModuleFile = resolveNodeModuleFile
const normalize = path_1.default.posix.normalize
/**
 * given a relative path in pkg dir,
 * return a relative path in pkg dir,
 * mapped with the "map" object
 */
function mapWithBrowserField(relativePathInPkgDir, map) {
  const normalized = normalize(relativePathInPkgDir)
  const foundEntry = Object.entries(map).find(([from]) => {
    return normalize(from) === normalized
  })
  if (!foundEntry) {
    return normalized
  }
  const [, to] = foundEntry
  return normalize(to)
}
//# sourceMappingURL=resolver.js.map
