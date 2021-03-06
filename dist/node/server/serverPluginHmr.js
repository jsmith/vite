'use strict'
// How HMR works
// 1. `.vue` files are transformed into `.js` files before being served
// 2. All `.js` files, before being served, are parsed to detect their imports
//    (this is done in `./serverPluginModuleRewrite.ts`) for module import rewriting.
//    During this we also record the importer/importee relationships which can be used for
//    HMR analysis (we do both at the same time to avoid double parse costs)
// 3. When a file changes, it triggers an HMR graph analysis, where we try to
//    walk its importer chains and see if we reach a "HMR boundary". An HMR
//    boundary is a file that explicitly indicated that it accepts hot updates
//    (by calling `import.meta.hot` APIs)
// 4. If any parent chain exhausts without ever running into an HMR boundary,
//    it's considered a "dead end". This causes a full page reload.
// 5. If a boundary is encountered, we check if the boundary's current
//    child importer is in the accepted list of the boundary (recorded while
//    parsing the file for HRM rewrite). If yes, record current child importer
//    in the `hmrBoundaries` Set.
// 6. If the graph walk finished without running into dead ends, send the
//    client to update all `hmrBoundaries`.
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.rewriteFileWithHMR = exports.ensureMapEntry = exports.hmrPlugin = exports.latestVersionsMap = exports.hmrDirtyFilesMap = exports.importeeMap = exports.importerMap = exports.hmrDeclineSet = exports.hmrAcceptanceMap = exports.debugHmr = void 0
const ws_1 = __importDefault(require('ws'))
const path_1 = __importDefault(require('path'))
const chalk_1 = __importDefault(require('chalk'))
const serverPluginVue_1 = require('./serverPluginVue')
const serverPluginModuleRewrite_1 = require('./serverPluginModuleRewrite')
const babelParse_1 = require('../utils/babelParse')
const lru_cache_1 = __importDefault(require('lru-cache'))
const slash_1 = __importDefault(require('slash'))
const cssUtils_1 = require('../utils/cssUtils')
const utils_1 = require('../utils')
const serverPluginClient_1 = require('./serverPluginClient')
exports.debugHmr = require('debug')('vite:hmr')
exports.hmrAcceptanceMap = new Map()
exports.hmrDeclineSet = new Set()
exports.importerMap = new Map()
exports.importeeMap = new Map()
// files that are dirty (i.e. in the import chain between the accept boundary
// and the actual changed file) for an hmr update at a given timestamp.
exports.hmrDirtyFilesMap = new lru_cache_1.default({ max: 10 })
exports.latestVersionsMap = new Map()
exports.hmrPlugin = ({ root, app, server, watcher, resolver, config }) => {
  app.use((ctx, next) => {
    if (ctx.query.t) {
      exports.latestVersionsMap.set(ctx.path, ctx.query.t)
    }
    return next()
  })
  // start a websocket server to send hmr notifications to the client
  const wss = new ws_1.default.Server({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    if (req.headers['sec-websocket-protocol'] === 'vite-hmr') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    }
  })
  wss.on('connection', (socket) => {
    exports.debugHmr('ws client connected')
    socket.send(JSON.stringify({ type: 'connected' }))
  })
  wss.on('error', (e) => {
    if (e.code !== 'EADDRINUSE') {
      console.error(chalk_1.default.red(`[vite] WebSocket server error:`))
      console.error(e)
    }
  })
  const send = (watcher.send = (payload) => {
    const stringified = JSON.stringify(payload, null, 2)
    exports.debugHmr(`update: ${stringified}`)
    wss.clients.forEach((client) => {
      if (client.readyState === ws_1.default.OPEN) {
        client.send(stringified)
      }
    })
  })
  const handleJSReload = (watcher.handleJSReload = (
    filePath,
    timestamp = Date.now()
  ) => {
    // normal js file, but could be compiled from anything.
    // bust the vue cache in case this is a src imported file
    if (serverPluginVue_1.srcImportMap.has(filePath)) {
      exports.debugHmr(`busting Vue cache for ${filePath}`)
      serverPluginVue_1.vueCache.del(filePath)
    }
    const publicPath = resolver.fileToRequest(filePath)
    const importers = exports.importerMap.get(publicPath)
    if (importers || isHmrAccepted(publicPath, publicPath)) {
      const hmrBoundaries = new Set()
      const dirtyFiles = new Set()
      dirtyFiles.add(publicPath)
      const hasDeadEnd = walkImportChain(
        publicPath,
        importers || new Set(),
        hmrBoundaries,
        dirtyFiles
      )
      // record dirty files - this is used when HMR requests coming in with
      // timestamp to determine what files need to be force re-fetched
      exports.hmrDirtyFilesMap.set(String(timestamp), dirtyFiles)
      const relativeFile =
        '/' + slash_1.default(path_1.default.relative(root, filePath))
      if (hasDeadEnd) {
        send({
          type: 'full-reload',
          path: publicPath
        })
        console.log(chalk_1.default.green(`[vite] `) + `page reloaded.`)
      } else {
        const boundaries = [...hmrBoundaries]
        const file =
          boundaries.length === 1 ? boundaries[0] : `${boundaries.length} files`
        console.log(
          chalk_1.default.green(`[vite:hmr] `) +
            `${file} hot updated due to change in ${relativeFile}.`
        )
        send({
          type: 'multi',
          updates: boundaries.map((boundary) => {
            return {
              type: boundary.endsWith('vue') ? 'vue-reload' : 'js-update',
              path: boundary,
              changeSrcPath: publicPath,
              timestamp
            }
          })
        })
      }
    } else {
      exports.debugHmr(`no importers for ${publicPath}.`)
    }
  })
  watcher.on('change', (file) => {
    if (!(file.endsWith('.vue') || cssUtils_1.isCSSRequest(file))) {
      // everything except plain .css are considered HMR dependencies.
      // plain css has its own HMR logic in ./serverPluginCss.ts.
      handleJSReload(file)
    }
  })
}
function walkImportChain(
  importee,
  importers,
  hmrBoundaries,
  dirtyFiles,
  currentChain = []
) {
  if (exports.hmrDeclineSet.has(importee)) {
    // module explicitly declines HMR = dead end
    return true
  }
  if (isHmrAccepted(importee, importee)) {
    // self-accepting module.
    hmrBoundaries.add(importee)
    dirtyFiles.add(importee)
    return false
  }
  for (const importer of importers) {
    if (
      importer.endsWith('.vue') ||
      // explicitly accepted by this importer
      isHmrAccepted(importer, importee) ||
      // importer is a self accepting module
      isHmrAccepted(importer, importer)
    ) {
      // vue boundaries are considered dirty for the reload
      if (importer.endsWith('.vue')) {
        dirtyFiles.add(importer)
      }
      hmrBoundaries.add(importer)
      currentChain.forEach((file) => dirtyFiles.add(file))
    } else {
      const parentImpoters = exports.importerMap.get(importer)
      if (!parentImpoters) {
        return true
      } else if (!currentChain.includes(importer)) {
        if (
          walkImportChain(
            importer,
            parentImpoters,
            hmrBoundaries,
            dirtyFiles,
            currentChain.concat(importer)
          )
        ) {
          return true
        }
      }
    }
  }
  return false
}
function isHmrAccepted(importer, dep) {
  const deps = exports.hmrAcceptanceMap.get(importer)
  return deps ? deps.has(dep) : false
}
function ensureMapEntry(map, key) {
  let entry = map.get(key)
  if (!entry) {
    entry = new Set()
    map.set(key, entry)
  }
  return entry
}
exports.ensureMapEntry = ensureMapEntry
function rewriteFileWithHMR(root, source, importer, resolver, s) {
  let hasDeclined = false
  const registerDep = (e) => {
    const deps = ensureMapEntry(exports.hmrAcceptanceMap, importer)
    const depPublicPath = serverPluginModuleRewrite_1.resolveImport(
      root,
      importer,
      e.value,
      resolver
    )
    deps.add(depPublicPath)
    exports.debugHmr(`        ${importer} accepts ${depPublicPath}`)
    ensureMapEntry(exports.importerMap, depPublicPath).add(importer)
    s.overwrite(e.start, e.end, JSON.stringify(depPublicPath))
  }
  const checkHotCall = (node, isTopLevel, isDevBlock) => {
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      isMetaHot(node.callee.object)
    ) {
      if (isTopLevel) {
        const { generateCodeFrame } = utils_1.resolveCompiler(root)
        console.warn(
          chalk_1.default.yellow(
            `[vite] HMR syntax error in ${importer}: import.meta.hot.accept() ` +
              `should be wrapped in \`if (import.meta.hot) {}\` conditional ` +
              `blocks so that they can be tree-shaken in production.`
          )
        )
        console.warn(
          chalk_1.default.yellow(
            generateCodeFrame(source, node.start, node.end)
          )
        )
      }
      const method =
        node.callee.property.type === 'Identifier' && node.callee.property.name
      if (method === 'accept' || method === 'acceptDeps') {
        if (!isDevBlock) {
          console.error(
            chalk_1.default.yellow(
              `[vite] HMR syntax error in ${importer}: import.meta.hot.${method}() ` +
                `cannot be conditional except for \`if (import.meta.hot)\` check ` +
                `because the server relies on static analysis to construct the HMR graph.`
            )
          )
        }
        // register the accepted deps
        const accepted = node.arguments[0]
        if (accepted && accepted.type === 'ArrayExpression') {
          if (method !== 'acceptDeps') {
            console.error(
              chalk_1.default.yellow(
                `[vite] HMR syntax error in ${importer}: hot.accept() only accepts ` +
                  `a single callback. Use hot.acceptDeps() to handle dep updates.`
              )
            )
          }
          // import.meta.hot.accept(['./foo', './bar'], () => {})
          accepted.elements.forEach((e) => {
            if (e && e.type !== 'StringLiteral') {
              console.error(
                chalk_1.default.yellow(
                  `[vite] HMR syntax error in ${importer}: hot.accept() deps ` +
                    `list can only contain string literals.`
                )
              )
            } else if (e) {
              registerDep(e)
            }
          })
        } else if (accepted && accepted.type === 'StringLiteral') {
          if (method !== 'acceptDeps') {
            console.error(
              chalk_1.default.yellow(
                `[vite] HMR syntax error in ${importer}: hot.accept() only accepts ` +
                  `a single callback. Use hot.acceptDeps() to handle dep updates.`
              )
            )
          }
          // import.meta.hot.accept('./foo', () => {})
          registerDep(accepted)
        } else if (!accepted || accepted.type.endsWith('FunctionExpression')) {
          if (method !== 'accept') {
            console.error(
              chalk_1.default.yellow(
                `[vite] HMR syntax error in ${importer}: hot.acceptDeps() ` +
                  `expects a dependency or an array of dependencies. ` +
                  `Use hot.accept() for handling self updates.`
              )
            )
          }
          // self accepting
          // import.meta.hot.accept() OR import.meta.hot.accept(() => {})
          ensureMapEntry(exports.hmrAcceptanceMap, importer).add(importer)
          exports.debugHmr(`${importer} self accepts`)
        } else {
          console.error(
            chalk_1.default.yellow(
              `[vite] HMR syntax error in ${importer}: ` +
                `import.meta.hot.accept() expects a dep string, an array of ` +
                `deps, or a callback.`
            )
          )
        }
      }
      if (method === 'decline') {
        hasDeclined = true
        exports.hmrDeclineSet.add(importer)
      }
    }
  }
  const checkStatements = (node, isTopLevel, isDevBlock) => {
    if (node.type === 'ExpressionStatement') {
      // top level hot.accept() call
      checkHotCall(node.expression, isTopLevel, isDevBlock)
    }
    // if (import.meta.hot) ...
    if (node.type === 'IfStatement') {
      const isDevBlock = isMetaHot(node.test)
      if (node.consequent.type === 'BlockStatement') {
        node.consequent.body.forEach((s) =>
          checkStatements(s, false, isDevBlock)
        )
      }
      if (node.consequent.type === 'ExpressionStatement') {
        checkHotCall(node.consequent.expression, false, isDevBlock)
      }
    }
  }
  const ast = babelParse_1.parse(source)
  ast.forEach((s) => checkStatements(s, true, false))
  // inject import.meta.hot
  s.prepend(
    `import { createHotContext } from "${serverPluginClient_1.clientPublicPath}"; ` +
      `import.meta.hot = createHotContext(${JSON.stringify(importer)}); `
  )
  // clear decline state
  if (!hasDeclined) {
    exports.hmrDeclineSet.delete(importer)
  }
}
exports.rewriteFileWithHMR = rewriteFileWithHMR
function isMetaHot(node) {
  return (
    node.type === 'MemberExpression' &&
    node.object.type === 'MetaProperty' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'hot'
  )
}
//# sourceMappingURL=serverPluginHmr.js.map
