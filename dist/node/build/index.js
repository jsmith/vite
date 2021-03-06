'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.ssrBuild = exports.build = exports.createBaseRollupPlugins = exports.onRollupWarning = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const chalk_1 = __importDefault(require('chalk'))
const utils_1 = require('../utils')
const resolver_1 = require('../resolver')
const buildPluginResolve_1 = require('./buildPluginResolve')
const buildPluginHtml_1 = require('./buildPluginHtml')
const buildPluginCss_1 = require('./buildPluginCss')
const buildPluginAsset_1 = require('./buildPluginAsset')
const buildPluginEsbuild_1 = require('./buildPluginEsbuild')
const buildPluginReplace_1 = require('./buildPluginReplace')
const esbuildService_1 = require('../esbuildService')
const config_1 = require('../config')
const transform_1 = require('../transform')
const hash_sum_1 = __importDefault(require('hash-sum'))
const cssUtils_1 = require('../utils/cssUtils')
const buildPluginWasm_1 = require('./buildPluginWasm')
const writeColors = {
  [0 /* JS */]: chalk_1.default.cyan,
  [1 /* CSS */]: chalk_1.default.magenta,
  [2 /* ASSET */]: chalk_1.default.green,
  [3 /* HTML */]: chalk_1.default.blue,
  [4 /* SOURCE_MAP */]: chalk_1.default.gray
}
const warningIgnoreList = [`CIRCULAR_DEPENDENCY`, `THIS_IS_UNDEFINED`]
const dynamicImportWarningIgnoreList = [
  `Unsupported expression`,
  `statically analyzed`
]
const isBuiltin = require('isbuiltin')
function onRollupWarning(spinner, options) {
  return (warning, warn) => {
    if (warning.code === 'UNRESOLVED_IMPORT') {
      let message
      const id = warning.source
      const importer = warning.importer
      if (isBuiltin(id)) {
        let importingDep
        if (importer) {
          const pkg = JSON.parse(
            utils_1.lookupFile(importer, ['package.json']) || `{}`
          )
          if (pkg.name) {
            importingDep = pkg.name
          }
        }
        const allowList = options && options.allowNodeBuiltins
        if (importingDep && allowList && allowList.includes(importingDep)) {
          return
        }
        const dep = importingDep
          ? `Dependency ${chalk_1.default.yellow(importingDep)}`
          : `A dependency`
        message =
          `${dep} is attempting to import Node built-in module ${chalk_1.default.yellow(
            id
          )}.\n` +
          `This will not work in a browser environment.\n` +
          `Imported by: ${chalk_1.default.gray(importer)}`
      } else {
        message =
          `[vite]: Rollup failed to resolve import "${warning.source}" from "${warning.importer}".\n` +
          `This is most likely unintended because it can break your application at runtime.\n` +
          `If you do want to externalize this module explicitly add it to\n` +
          `\`rollupInputOptions.external\``
      }
      throw new Error(message)
    }
    if (
      warning.plugin === 'rollup-plugin-dynamic-import-variables' &&
      dynamicImportWarningIgnoreList.some((msg) =>
        warning.message.includes(msg)
      )
    ) {
      return
    }
    if (!warningIgnoreList.includes(warning.code)) {
      // ora would swallow the console.warn if we let it keep running
      // https://github.com/sindresorhus/ora/issues/90
      if (spinner) {
        spinner.stop()
      }
      warn(warning)
      if (spinner) {
        spinner.start()
      }
    }
  }
}
exports.onRollupWarning = onRollupWarning
/**
 * Creates non-application specific plugins that are shared between the main
 * app and the dependencies. This is used by the `optimize` command to
 * pre-bundle dependencies.
 */
async function createBaseRollupPlugins(root, resolver, options) {
  const {
    rollupInputOptions = {},
    transforms = [],
    vueCustomBlockTransforms = {},
    enableEsbuild = true,
    enableRollupPluginVue = true
  } = options
  const { nodeResolve } = require('@rollup/plugin-node-resolve')
  const dynamicImport = require('rollup-plugin-dynamic-import-variables')
  return [
    // vite:resolve
    buildPluginResolve_1.createBuildResolvePlugin(root, resolver),
    // vite:esbuild
    enableEsbuild
      ? await buildPluginEsbuild_1.createEsbuildPlugin(options.jsx)
      : null,
    // vue
    enableRollupPluginVue ? await createVuePlugin(root, options) : null,
    require('@rollup/plugin-json')({
      preferConst: true,
      indent: '  ',
      compact: false,
      namedExports: true
    }),
    // user transforms
    ...(transforms.length || Object.keys(vueCustomBlockTransforms).length
      ? [
          transform_1.createBuildJsTransformPlugin(
            transforms,
            vueCustomBlockTransforms
          )
        ]
      : []),
    nodeResolve({
      rootDir: root,
      extensions: resolver_1.supportedExts,
      preferBuiltins: false,
      dedupe: options.rollupDedupe || [],
      mainFields: resolver_1.mainFields
    }),
    require('@rollup/plugin-commonjs')({
      extensions: ['.js', '.cjs']
    }),
    dynamicImport({
      warnOnError: true,
      include: [/\.js$/],
      exclude: [/node_modules/]
    }),
    // #728 user plugins should apply after `@rollup/plugin-commonjs`
    ...(rollupInputOptions.plugins || [])
  ].filter(Boolean)
}
exports.createBaseRollupPlugins = createBaseRollupPlugins
async function createVuePlugin(
  root,
  {
    vueCustomBlockTransforms = {},
    rollupPluginVueOptions,
    cssPreprocessOptions,
    cssModuleOptions,
    vueCompilerOptions,
    vueTransformAssetUrls = {},
    vueTemplatePreprocessOptions = {}
  }
) {
  const {
    options: postcssOptions,
    plugins: postcssPlugins
  } = await cssUtils_1.resolvePostcssOptions(root, true)
  if (typeof vueTransformAssetUrls === 'object') {
    vueTransformAssetUrls = {
      includeAbsolute: true,
      ...vueTransformAssetUrls
    }
  }
  return require('rollup-plugin-vue')({
    ...rollupPluginVueOptions,
    templatePreprocessOptions: {
      ...vueTemplatePreprocessOptions,
      pug: {
        doctype: 'html',
        ...(vueTemplatePreprocessOptions && vueTemplatePreprocessOptions.pug)
      }
    },
    transformAssetUrls: vueTransformAssetUrls,
    postcssOptions,
    postcssPlugins,
    preprocessStyles: true,
    preprocessOptions: cssPreprocessOptions,
    preprocessCustomRequire: (id) => require(utils_1.resolveFrom(root, id)),
    compilerOptions: vueCompilerOptions,
    cssModulesOptions: {
      localsConvention: 'camelCase',
      generateScopedName: (local, filename) =>
        `${local}_${hash_sum_1.default(filename)}`,
      ...cssModuleOptions,
      ...(rollupPluginVueOptions && rollupPluginVueOptions.cssModulesOptions)
    },
    customBlocks: Object.keys(vueCustomBlockTransforms)
  })
}
/**
 * Bundles the app for production.
 * Returns a Promise containing the build result.
 */
async function build(options) {
  const {
    root = process.cwd(),
    base = '/',
    outDir = path_1.default.resolve(root, 'dist'),
    assetsDir = '_assets',
    assetsInlineLimit = 4096,
    cssCodeSplit = true,
    alias = {},
    resolvers = [],
    rollupInputOptions = {},
    rollupOutputOptions = {},
    emitIndex = true,
    emitAssets = true,
    write = true,
    minify = true,
    terserOption = {},
    esbuildTarget = 'es2020',
    enableEsbuild = true,
    silent = false,
    sourcemap = false,
    shouldPreload = null,
    env = {},
    mode: configMode = 'production',
    define: userDefineReplacements = {},
    cssPreprocessOptions,
    cssModuleOptions = {}
  } = options
  const isTest = process.env.NODE_ENV === 'test'
  const resolvedMode = process.env.VITE_ENV || configMode
  const start = Date.now()
  let spinner
  const msg = `Building ${configMode} bundle...`
  if (!silent) {
    if (process.env.DEBUG || isTest) {
      console.log(msg)
    } else {
      spinner = require('ora')(msg + '\n').start()
    }
  }
  await fs_extra_1.default.emptyDir(outDir)
  const indexPath = path_1.default.resolve(root, 'index.html')
  const publicBasePath = base.replace(/([^/])$/, '$1/') // ensure ending slash
  const resolvedAssetsPath = path_1.default.join(outDir, assetsDir)
  const resolver = resolver_1.createResolver(root, resolvers, alias)
  const {
    htmlPlugin,
    renderIndex
  } = await buildPluginHtml_1.createBuildHtmlPlugin(
    root,
    indexPath,
    publicBasePath,
    assetsDir,
    assetsInlineLimit,
    resolver,
    shouldPreload
  )
  const basePlugins = await createBaseRollupPlugins(root, resolver, options)
  // https://github.com/darionco/rollup-plugin-web-worker-loader
  // configured to support `import Worker from './my-worker?worker'`
  // this plugin relies on resolveId and must be placed before node-resolve
  // since the latter somehow swallows ids with query strings since 8.x
  basePlugins.splice(
    basePlugins.findIndex((p) => p.name.includes('node-resolve')),
    0,
    require('rollup-plugin-web-worker-loader')({
      targetPlatform: 'browser',
      pattern: /(.+)\?worker$/,
      extensions: resolver_1.supportedExts,
      sourcemap: false // it's inlined so it bloats the bundle
    })
  )
  // user env variables loaded from .env files.
  // only those prefixed with VITE_ are exposed.
  const userClientEnv = {}
  const userEnvReplacements = {}
  Object.keys(env).forEach((key) => {
    if (key.startsWith(`VITE_`)) {
      userEnvReplacements[`import.meta.env.${key}`] = JSON.stringify(env[key])
      userClientEnv[key] = env[key]
    }
  })
  const builtInClientEnv = {
    BASE_URL: publicBasePath,
    MODE: configMode,
    DEV: resolvedMode !== 'production',
    PROD: resolvedMode === 'production'
  }
  const builtInEnvReplacements = {}
  Object.keys(builtInClientEnv).forEach((key) => {
    builtInEnvReplacements[`import.meta.env.${key}`] = JSON.stringify(
      builtInClientEnv[key]
    )
  })
  Object.keys(userDefineReplacements).forEach((key) => {
    userDefineReplacements[key] = JSON.stringify(userDefineReplacements[key])
  })
  // lazy require rollup so that we don't load it when only using the dev server
  // importing it just for the types
  const rollup = require('rollup').rollup
  const bundle = await rollup({
    input: path_1.default.resolve(root, 'index.html'),
    preserveEntrySignatures: false,
    treeshake: { moduleSideEffects: 'no-external' },
    onwarn: onRollupWarning(spinner, options.optimizeDeps),
    ...rollupInputOptions,
    plugins: [
      ...basePlugins,
      // vite:html
      htmlPlugin,
      // we use a custom replacement plugin because @rollup/plugin-replace
      // performs replacements twice, once at transform and once at renderChunk
      // - which makes it impossible to exclude Vue templates from it since
      // Vue templates are compiled into js and included in chunks.
      buildPluginReplace_1.createReplacePlugin(
        (id) =>
          !/\?vue&type=template/.test(id) &&
          // also exclude css and static assets for performance
          !cssUtils_1.isCSSRequest(id) &&
          !utils_1.isStaticAsset(id),
        {
          ...config_1.defaultDefines,
          ...userDefineReplacements,
          ...userEnvReplacements,
          ...builtInEnvReplacements,
          'import.meta.env.': `({}).`,
          'import.meta.env': JSON.stringify({
            ...userClientEnv,
            ...builtInClientEnv
          }),
          'process.env.NODE_ENV': JSON.stringify(resolvedMode),
          'process.env.': `({}).`,
          'process.env': JSON.stringify({ NODE_ENV: resolvedMode }),
          'import.meta.hot': `false`
        },
        sourcemap
      ),
      // vite:css
      buildPluginCss_1.createBuildCssPlugin({
        root,
        publicBase: publicBasePath,
        assetsDir,
        minify,
        inlineLimit: assetsInlineLimit,
        cssCodeSplit,
        preprocessOptions: cssPreprocessOptions,
        modulesOptions: cssModuleOptions
      }),
      // vite:asset
      buildPluginAsset_1.createBuildAssetPlugin(
        root,
        publicBasePath,
        assetsDir,
        assetsInlineLimit
      ),
      buildPluginWasm_1.createBuildWasmPlugin(
        root,
        publicBasePath,
        assetsDir,
        assetsInlineLimit
      ),
      enableEsbuild
        ? buildPluginEsbuild_1.createEsbuildRenderChunkPlugin(
            esbuildTarget,
            minify === 'esbuild'
          )
        : undefined,
      // minify with terser
      // this is the default which has better compression, but slow
      // the user can opt-in to use esbuild which is much faster but results
      // in ~8-10% larger file size.
      minify && minify !== 'esbuild'
        ? require('rollup-plugin-terser').terser(terserOption)
        : undefined
    ].filter(Boolean)
  })
  const { output } = await bundle.generate({
    format: 'es',
    sourcemap,
    entryFileNames: `[name].[hash].js`,
    chunkFileNames: `[name].[hash].js`,
    ...rollupOutputOptions
  })
  spinner && spinner.stop()
  const indexHtml = emitIndex ? renderIndex(output) : ''
  if (write) {
    const cwd = process.cwd()
    const writeFile = async (filepath, content, type) => {
      await fs_extra_1.default.ensureDir(path_1.default.dirname(filepath))
      await fs_extra_1.default.writeFile(filepath, content)
      if (!silent) {
        const needCompression =
          type === 0 /* JS */ || type === 1 /* CSS */ || type === 3 /* HTML */
        const compressed = needCompression
          ? `, brotli: ${(require('brotli-size').sync(content) / 1024).toFixed(
              2
            )}kb`
          : ``
        console.log(
          `${chalk_1.default.gray(`[write]`)} ${writeColors[type](
            path_1.default.relative(cwd, filepath)
          )} ${(content.length / 1024).toFixed(2)}kb${compressed}`
        )
      }
    }
    await fs_extra_1.default.ensureDir(outDir)
    // write js chunks and assets
    for (const chunk of output) {
      if (chunk.type === 'chunk') {
        // write chunk
        const filepath = path_1.default.join(resolvedAssetsPath, chunk.fileName)
        let code = chunk.code
        if (chunk.map) {
          code += `\n//# sourceMappingURL=${path_1.default.basename(
            filepath
          )}.map`
        }
        await writeFile(filepath, code, 0 /* JS */)
        if (chunk.map) {
          await writeFile(
            filepath + '.map',
            chunk.map.toString(),
            4 /* SOURCE_MAP */
          )
        }
      } else if (emitAssets) {
        if (!chunk.source) continue
        // write asset
        const filepath = path_1.default.join(resolvedAssetsPath, chunk.fileName)
        await writeFile(
          filepath,
          chunk.source,
          chunk.fileName.endsWith('.css') ? 1 /* CSS */ : 2 /* ASSET */
        )
      }
    }
    // write html
    if (indexHtml && emitIndex) {
      await writeFile(
        path_1.default.join(outDir, 'index.html'),
        indexHtml,
        3 /* HTML */
      )
    }
    // copy over /public if it exists
    if (emitAssets) {
      const publicDir = path_1.default.resolve(root, 'public')
      if (fs_extra_1.default.existsSync(publicDir)) {
        for (const file of await fs_extra_1.default.readdir(publicDir)) {
          await fs_extra_1.default.copy(
            path_1.default.join(publicDir, file),
            path_1.default.resolve(outDir, file)
          )
        }
      }
    }
  }
  if (!silent) {
    console.log(
      `Build completed in ${((Date.now() - start) / 1000).toFixed(2)}s.\n`
    )
  }
  // stop the esbuild service after each build
  await esbuildService_1.stopService()
  return {
    assets: output,
    html: indexHtml
  }
}
exports.build = build
/**
 * Bundles the app in SSR mode.
 * - All Vue dependencies are automatically externalized
 * - Imports to dependencies are compiled into require() calls
 * - Templates are compiled with SSR specific optimizations.
 */
async function ssrBuild(options) {
  const {
    rollupInputOptions,
    rollupOutputOptions,
    rollupPluginVueOptions
  } = options
  return build({
    outDir: path_1.default.resolve(options.root || process.cwd(), 'dist-ssr'),
    assetsDir: '.',
    ...options,
    rollupPluginVueOptions: {
      ...rollupPluginVueOptions,
      target: 'node'
    },
    rollupInputOptions: {
      ...rollupInputOptions,
      external: resolveExternal(
        rollupInputOptions && rollupInputOptions.external
      )
    },
    rollupOutputOptions: {
      ...rollupOutputOptions,
      format: 'cjs',
      exports: 'named',
      entryFileNames: '[name].js'
    },
    emitIndex: false,
    emitAssets: false,
    cssCodeSplit: false,
    minify: false
  })
}
exports.ssrBuild = ssrBuild
function resolveExternal(userExternal) {
  const required = ['vue', /^@vue\//]
  if (!userExternal) {
    return required
  }
  if (Array.isArray(userExternal)) {
    return [...required, ...userExternal]
  } else if (typeof userExternal === 'function') {
    return (src, importer, isResolved) => {
      if (src === 'vue' || /^@vue\//.test(src)) {
        return true
      }
      return userExternal(src, importer, isResolved)
    }
  } else {
    return [...required, userExternal]
  }
}
//# sourceMappingURL=index.js.map
