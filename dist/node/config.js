'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.defaultDefines = exports.resolveConfig = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const chalk_1 = __importDefault(require('chalk'))
const dotenv_1 = __importDefault(require('dotenv'))
const dotenv_expand_1 = __importDefault(require('dotenv-expand'))
const buildPluginEsbuild_1 = require('./build/buildPluginEsbuild')
const resolver_1 = require('./resolver')
const utils_1 = require('./utils')
const debug = require('debug')('vite:config')
async function resolveConfig(mode, configPath) {
  const start = Date.now()
  const cwd = process.cwd()
  let config
  let resolvedPath
  let isTS = false
  if (configPath) {
    resolvedPath = path_1.default.resolve(cwd, configPath)
  } else {
    const jsConfigPath = path_1.default.resolve(cwd, 'vite.config.js')
    if (fs_extra_1.default.existsSync(jsConfigPath)) {
      resolvedPath = jsConfigPath
    } else {
      const tsConfigPath = path_1.default.resolve(cwd, 'vite.config.ts')
      if (fs_extra_1.default.existsSync(tsConfigPath)) {
        isTS = true
        resolvedPath = tsConfigPath
      }
    }
  }
  if (!resolvedPath) {
    // load environment variables
    return {
      env: loadEnv(mode, cwd)
    }
  }
  try {
    if (!isTS) {
      try {
        config = require(resolvedPath)
      } catch (e) {
        if (
          !/Cannot use import statement|Unexpected token 'export'/.test(
            e.message
          )
        ) {
          throw e
        }
      }
    }
    if (!config) {
      // 2. if we reach here, the file is ts or using es import syntax.
      // transpile es import syntax to require syntax using rollup.
      const rollup = require('rollup')
      const esbuildPlugin = await buildPluginEsbuild_1.createEsbuildPlugin({})
      const esbuildRenderChunkPlugin = buildPluginEsbuild_1.createEsbuildRenderChunkPlugin(
        'es2019',
        false
      )
      // use node-resolve to support .ts files
      const nodeResolve = require('@rollup/plugin-node-resolve').nodeResolve({
        extensions: resolver_1.supportedExts
      })
      const bundle = await rollup.rollup({
        external: (id) =>
          (id[0] !== '.' && !path_1.default.isAbsolute(id)) ||
          id.slice(-5, id.length) === '.json',
        input: resolvedPath,
        treeshake: false,
        plugins: [esbuildPlugin, nodeResolve, esbuildRenderChunkPlugin]
      })
      const {
        output: [{ code }]
      } = await bundle.generate({
        exports: 'named',
        format: 'cjs'
      })
      config = await loadConfigFromBundledFile(resolvedPath, code)
    }
    // normalize config root to absolute
    if (config.root && !path_1.default.isAbsolute(config.root)) {
      config.root = path_1.default.resolve(
        path_1.default.dirname(resolvedPath),
        config.root
      )
    }
    if (typeof config.vueTransformAssetUrls === 'object') {
      config.vueTransformAssetUrls = normalizeAssetUrlOptions(
        config.vueTransformAssetUrls
      )
    }
    // resolve plugins
    if (config.plugins) {
      for (const plugin of config.plugins) {
        config = resolvePlugin(config, plugin)
      }
    }
    config.env = {
      ...config.env,
      ...loadEnv(mode, config.root || cwd)
    }
    debug(`config resolved in ${Date.now() - start}ms`)
    config.__path = resolvedPath
    return config
  } catch (e) {
    console.error(
      chalk_1.default.red(`[vite] failed to load config from ${resolvedPath}:`)
    )
    console.error(e)
    process.exit(1)
  }
}
exports.resolveConfig = resolveConfig
async function loadConfigFromBundledFile(fileName, bundledCode) {
  const extension = path_1.default.extname(fileName)
  const defaultLoader = require.extensions[extension]
  require.extensions[extension] = (module, filename) => {
    if (filename === fileName) {
      module._compile(bundledCode, filename)
    } else {
      defaultLoader(module, filename)
    }
  }
  delete require.cache[fileName]
  const raw = require(fileName)
  const config = raw.__esModule ? raw.default : raw
  require.extensions[extension] = defaultLoader
  return config
}
function resolvePlugin(config, plugin) {
  return {
    ...config,
    ...plugin,
    alias: {
      ...plugin.alias,
      ...config.alias
    },
    define: {
      ...plugin.define,
      ...config.define
    },
    transforms: [...(config.transforms || []), ...(plugin.transforms || [])],
    resolvers: [...(config.resolvers || []), ...(plugin.resolvers || [])],
    configureServer: [].concat(
      config.configureServer || [],
      plugin.configureServer || []
    ),
    vueCompilerOptions: {
      ...config.vueCompilerOptions,
      ...plugin.vueCompilerOptions
    },
    vueTransformAssetUrls: mergeAssetUrlOptions(
      config.vueTransformAssetUrls,
      plugin.vueTransformAssetUrls
    ),
    vueTemplatePreprocessOptions: {
      ...config.vueTemplatePreprocessOptions,
      ...plugin.vueTemplatePreprocessOptions
    },
    vueCustomBlockTransforms: {
      ...config.vueCustomBlockTransforms,
      ...plugin.vueCustomBlockTransforms
    },
    rollupInputOptions: mergeObjectOptions(
      config.rollupInputOptions,
      plugin.rollupInputOptions
    ),
    rollupOutputOptions: mergeObjectOptions(
      config.rollupOutputOptions,
      plugin.rollupOutputOptions
    ),
    enableRollupPluginVue:
      config.enableRollupPluginVue || plugin.enableRollupPluginVue
  }
}
function mergeAssetUrlOptions(to, from) {
  if (from === true) {
    return to
  }
  if (from === false) {
    return from
  }
  if (typeof to === 'boolean') {
    return from || to
  }
  return {
    ...normalizeAssetUrlOptions(to),
    ...normalizeAssetUrlOptions(from)
  }
}
function normalizeAssetUrlOptions(o) {
  if (o && Object.keys(o).some((key) => Array.isArray(o[key]))) {
    return {
      tags: o
    }
  } else {
    return o
  }
}
function mergeObjectOptions(to, from) {
  if (!to) return from
  if (!from) return to
  const res = { ...to }
  for (const key in from) {
    const existing = res[key]
    const toMerge = from[key]
    if (Array.isArray(existing) || Array.isArray(toMerge)) {
      res[key] = [].concat(existing, toMerge).filter(Boolean)
    } else {
      res[key] = toMerge
    }
  }
  return res
}
function loadEnv(mode, root) {
  if (mode === 'local') {
    throw new Error(
      `"local" cannot be used as a mode name because it conflicts with ` +
        `the .local postfix for .env files.`
    )
  }
  debug(`env mode: ${mode}`)
  const nodeEnv = process.env
  const clientEnv = {}
  const envFiles = [
    /** mode local file */ `.env.${mode}.local`,
    /** mode file */ `.env.${mode}`,
    /** local file */ `.env.local`,
    /** default file */ `.env`
  ]
  for (const file of envFiles) {
    const path = utils_1.lookupFile(root, [file], true)
    if (path) {
      const result = dotenv_1.default.config({
        debug: !!process.env.DEBUG || undefined,
        path
      })
      if (result.error) {
        throw result.error
      }
      dotenv_expand_1.default(result)
      for (const key in result.parsed) {
        const value = (nodeEnv[key] = result.parsed[key])
        // only keys that start with VITE_ are exposed.
        if (key.startsWith(`VITE_`)) {
          clientEnv[key] = value
        }
        // set NODE_ENV under a different key so that we know this is set from
        // vite-loaded .env files. Some users may have default NODE_ENV set in
        // their system.
        if (key === 'NODE_ENV') {
          nodeEnv.VITE_ENV = value
        }
      }
    }
  }
  debug(`env: %O`, clientEnv)
  return clientEnv
}
// TODO move this into Vue plugin when we extract it
exports.defaultDefines = {
  __VUE_OPTIONS_API__: true,
  __VUE_PROD_DEVTOOLS__: false
}
//# sourceMappingURL=config.js.map
