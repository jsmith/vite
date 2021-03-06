'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.createServer = exports.rewriteImports = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const koa_1 = __importDefault(require('koa'))
const chokidar_1 = __importDefault(require('chokidar'))
const resolver_1 = require('../resolver')
const serverPluginModuleRewrite_1 = require('./serverPluginModuleRewrite')
const serverPluginModuleResolve_1 = require('./serverPluginModuleResolve')
const serverPluginVue_1 = require('./serverPluginVue')
const serverPluginHmr_1 = require('./serverPluginHmr')
const serverPluginServeStatic_1 = require('./serverPluginServeStatic')
const serverPluginJson_1 = require('./serverPluginJson')
const serverPluginCss_1 = require('./serverPluginCss')
const serverPluginAssets_1 = require('./serverPluginAssets')
const serverPluginEsbuild_1 = require('./serverPluginEsbuild')
const transform_1 = require('../transform')
const serverPluginHtml_1 = require('./serverPluginHtml')
const serverPluginProxy_1 = require('./serverPluginProxy')
const createCertificate_1 = require('../utils/createCertificate')
const utils_1 = require('../utils')
const serverPluginEnv_1 = require('./serverPluginEnv')
var serverPluginModuleRewrite_2 = require('./serverPluginModuleRewrite')
Object.defineProperty(exports, 'rewriteImports', {
  enumerable: true,
  get: function () {
    return serverPluginModuleRewrite_2.rewriteImports
  }
})
const serverPluginSourceMap_1 = require('./serverPluginSourceMap')
const serverPluginWebWorker_1 = require('./serverPluginWebWorker')
const serverPluginWasm_1 = require('./serverPluginWasm')
const serverPluginClient_1 = require('./serverPluginClient')
function createServer(config) {
  const {
    root = process.cwd(),
    configureServer = [],
    resolvers = [],
    alias = {},
    transforms = [],
    vueCustomBlockTransforms = {},
    optimizeDeps = {},
    enableEsbuild = true
  } = config
  const app = new koa_1.default()
  const server = resolveServer(config, app.callback())
  const watcher = chokidar_1.default.watch(root, {
    ignored: [/node_modules/, /\.git/]
  })
  const resolver = resolver_1.createResolver(root, resolvers, alias)
  const context = {
    root,
    app,
    server,
    watcher,
    resolver,
    config,
    // port is exposed on the context for hmr client connection
    // in case the files are served under a different port
    port: config.port || 3000
  }
  // attach server context to koa context
  app.use((ctx, next) => {
    Object.assign(ctx, context)
    ctx.read = utils_1.cachedRead.bind(null, ctx)
    return next()
  })
  const resolvedPlugins = [
    // rewrite and source map plugins take highest priority and should be run
    // after all other middlewares have finished
    serverPluginSourceMap_1.sourceMapPlugin,
    serverPluginModuleRewrite_1.moduleRewritePlugin,
    serverPluginHtml_1.htmlRewritePlugin,
    // user plugins
    ...(Array.isArray(configureServer) ? configureServer : [configureServer]),
    serverPluginEnv_1.envPlugin,
    serverPluginModuleResolve_1.moduleResolvePlugin,
    serverPluginProxy_1.proxyPlugin,
    serverPluginClient_1.clientPlugin,
    serverPluginHmr_1.hmrPlugin,
    ...(transforms.length || Object.keys(vueCustomBlockTransforms).length
      ? [
          transform_1.createServerTransformPlugin(
            transforms,
            vueCustomBlockTransforms,
            resolver
          )
        ]
      : []),
    serverPluginVue_1.vuePlugin,
    serverPluginCss_1.cssPlugin,
    enableEsbuild ? serverPluginEsbuild_1.esbuildPlugin : null,
    serverPluginJson_1.jsonPlugin,
    serverPluginAssets_1.assetPathPlugin,
    serverPluginWebWorker_1.webWorkerPlugin,
    serverPluginWasm_1.wasmPlugin,
    serverPluginServeStatic_1.serveStaticPlugin
  ]
  resolvedPlugins.forEach((m) => m && m(context))
  const listen = server.listen.bind(server)
  server.listen = async (port, ...args) => {
    if (optimizeDeps.auto !== false) {
      await require('../optimizer').optimizeDeps(config)
    }
    const listener = listen(port, ...args)
    context.port = server.address().port
    return listener
  }
  return server
}
exports.createServer = createServer
function resolveServer(
  { https = false, httpsOptions = {}, proxy },
  requestListener
) {
  if (https) {
    if (proxy) {
      // #484 fallback to http1 when proxy is needed.
      return require('https').createServer(
        resolveHttpsConfig(httpsOptions),
        requestListener
      )
    } else {
      return require('http2').createSecureServer(
        {
          ...resolveHttpsConfig(httpsOptions),
          allowHTTP1: true
        },
        requestListener
      )
    }
  } else {
    return require('http').createServer(requestListener)
  }
}
function resolveHttpsConfig(httpsOption) {
  const { ca, cert, key, pfx } = httpsOption
  Object.assign(httpsOption, {
    ca: readFileIfExists(ca),
    cert: readFileIfExists(cert),
    key: readFileIfExists(key),
    pfx: readFileIfExists(pfx)
  })
  if (!httpsOption.key || !httpsOption.cert) {
    httpsOption.cert = httpsOption.key = createCertificate_1.createCertificate()
  }
  return httpsOption
}
function readFileIfExists(value) {
  if (value && !Buffer.isBuffer(value)) {
    try {
      return fs_extra_1.default.readFileSync(path_1.default.resolve(value))
    } catch (e) {
      return value
    }
  }
  return value
}
//# sourceMappingURL=index.js.map
