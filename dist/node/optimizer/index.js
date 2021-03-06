'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.resolveOptimizedCacheDir = exports.getDepHash = exports.optimizeDeps = exports.OPTIMIZE_CACHE_DIR = void 0
const fs_extra_1 = __importDefault(require('fs-extra'))
const path_1 = __importDefault(require('path'))
const crypto_1 = require('crypto')
const resolver_1 = require('../resolver')
const build_1 = require('../build')
const utils_1 = require('../utils')
const es_module_lexer_1 = require('es-module-lexer')
const chalk_1 = __importDefault(require('chalk'))
const pluginAssets_1 = require('./pluginAssets')
const debug = require('debug')('vite:optimize')
const KNOWN_IGNORE_LIST = new Set([
  'vite',
  'vitepress',
  'tailwindcss',
  '@tailwindcss/ui',
  '@pika/react',
  '@pika/react-dom'
])
exports.OPTIMIZE_CACHE_DIR = `node_modules/.vite_opt_cache`
async function optimizeDeps(config, asCommand = false) {
  const log = asCommand ? console.log : debug
  const root = config.root || process.cwd()
  // warn presence of web_modules
  if (fs_extra_1.default.existsSync(path_1.default.join(root, 'web_modules'))) {
    console.warn(
      chalk_1.default.yellow(
        `[vite] vite 0.15 has built-in dependency pre-bundling and resolving ` +
          `from web_modules is no longer supported.`
      )
    )
  }
  const pkgPath = utils_1.lookupFile(
    root,
    [`package.json`],
    true /* pathOnly */
  )
  if (!pkgPath) {
    log(`package.json not found. Skipping.`)
    return
  }
  const cacheDir = resolveOptimizedCacheDir(root, pkgPath)
  const hashPath = path_1.default.join(cacheDir, 'hash')
  const depHash = getDepHash(root, config.__path)
  if (!config.force) {
    let prevhash
    try {
      prevhash = await fs_extra_1.default.readFile(hashPath, 'utf-8')
    } catch (e) {}
    // hash is consistent, no need to re-bundle
    if (prevhash === depHash) {
      log('Hash is consistent. Skipping. Use --force to override.')
      return
    }
  }
  await fs_extra_1.default.remove(cacheDir)
  await fs_extra_1.default.ensureDir(cacheDir)
  const options = config.optimizeDeps || {}
  const resolver = resolver_1.createResolver(
    root,
    config.resolvers,
    config.alias
  )
  // Determine deps to optimize. The goal is to only pre-bundle deps that falls
  // under one of the following categories:
  // 1. Has imports to relative files (e.g. lodash-es, lit-html)
  // 2. Has imports to bare modules that are not in the project's own deps
  //    (i.e. esm that imports its own dependencies, e.g. styled-components)
  await es_module_lexer_1.init
  const { qualified, external } = resolveQualifiedDeps(root, options, resolver)
  // Resolve deps from linked packages in a monorepo
  if (options.link) {
    options.link.forEach((linkedDep) => {
      const depRoot = path_1.default.dirname(
        utils_1.resolveFrom(root, `${linkedDep}/package.json`)
      )
      const { qualified: q, external: e } = resolveQualifiedDeps(
        depRoot,
        options,
        resolver
      )
      Object.keys(q).forEach((id) => {
        if (!qualified[id]) {
          qualified[id] = q[id]
        }
      })
      e.forEach((id) => {
        if (!external.includes(id)) {
          external.push(id)
        }
      })
    })
  }
  // Force included deps - these can also be deep paths
  if (options.include) {
    options.include.forEach((id) => {
      const pkg = resolver_1.resolveNodeModule(root, id, resolver)
      if (pkg && pkg.entryFilePath) {
        qualified[id] = pkg.entryFilePath
      } else {
        const filePath = resolver_1.resolveNodeModuleFile(root, id)
        if (filePath) {
          qualified[id] = filePath
        }
      }
    })
  }
  if (!Object.keys(qualified).length) {
    await fs_extra_1.default.writeFile(hashPath, depHash)
    log(`No listed dependency requires optimization. Skipping.`)
    return
  }
  if (!asCommand) {
    // This is auto run on server start - let the user know that we are
    // pre-optimizing deps
    console.log(
      chalk_1.default.greenBright(`[vite] Optimizable dependencies detected:`)
    )
    console.log(
      Object.keys(qualified)
        .map((id) => chalk_1.default.yellow(id))
        .join(`, `)
    )
  }
  let spinner
  const msg = asCommand
    ? `Pre-bundling dependencies to speed up dev server page load...`
    : `Pre-bundling them to speed up dev server page load...\n` +
      `(this will be run only when your dependencies have changed)`
  if (process.env.DEBUG || process.env.NODE_ENV === 'test') {
    console.log(msg)
  } else {
    spinner = require('ora')(msg + '\n').start()
  }
  try {
    const rollup = require('rollup')
    const bundle = await rollup.rollup({
      input: qualified,
      external,
      // treeshake: { moduleSideEffects: 'no-external' },
      onwarn: build_1.onRollupWarning(spinner, options),
      ...config.rollupInputOptions,
      plugins: [
        pluginAssets_1.depAssetExternalPlugin,
        ...(await build_1.createBaseRollupPlugins(root, resolver, config)),
        pluginAssets_1.createDepAssetPlugin(resolver, root)
      ]
    })
    const { output } = await bundle.generate({
      ...config.rollupOutputOptions,
      format: 'es',
      exports: 'named',
      entryFileNames: '[name].js',
      chunkFileNames: 'common/[name]-[hash].js'
    })
    spinner && spinner.stop()
    for (const chunk of output) {
      if (chunk.type === 'chunk') {
        const fileName = chunk.fileName
        const filePath = path_1.default.join(cacheDir, fileName)
        await fs_extra_1.default.ensureDir(path_1.default.dirname(filePath))
        await fs_extra_1.default.writeFile(filePath, chunk.code)
      }
    }
    await fs_extra_1.default.writeFile(hashPath, depHash)
  } catch (e) {
    spinner && spinner.stop()
    if (asCommand) {
      throw e
    } else {
      console.error(
        chalk_1.default.red(`\n[vite] Dep optimization failed with error:`)
      )
      console.error(chalk_1.default.red(e.message))
      if (e.code === 'PARSE_ERROR') {
        console.error(
          chalk_1.default.cyan(path_1.default.relative(root, e.loc.file))
        )
        console.error(chalk_1.default.dim(e.frame))
      } else if (e.message.match('Node built-in')) {
        console.log()
        console.log(
          chalk_1.default.yellow(
            `Tip:\nMake sure your "dependencies" only include packages that you\n` +
              `intend to use in the browser. If it's a Node.js package, it\n` +
              `should be in "devDependencies".\n\n` +
              `If you do intend to use this dependency in the browser and the\n` +
              `dependency does not actually use these Node built-ins in the\n` +
              `browser, you can add the dependency (not the built-in) to the\n` +
              `"optimizeDeps.allowNodeBuiltins" option in vite.config.js.\n\n` +
              `If that results in a runtime error, then unfortunately the\n` +
              `package is not distributed in a web-friendly format. You should\n` +
              `open an issue in its repo, or look for a modern alternative.`
          )
          // TODO link to docs once we have it
        )
      } else {
        console.error(e)
      }
      process.exit(1)
    }
  }
}
exports.optimizeDeps = optimizeDeps
function resolveQualifiedDeps(root, options, resolver) {
  const { include, exclude, link } = options
  const pkgContent = utils_1.lookupFile(root, ['package.json'])
  if (!pkgContent) {
    return {
      qualified: {},
      external: []
    }
  }
  const pkg = JSON.parse(pkgContent)
  const deps = Object.keys(pkg.dependencies || {})
  const qualifiedDeps = deps.filter((id) => {
    if (include && include.includes(id)) {
      // already force included
      return false
    }
    if (exclude && exclude.includes(id)) {
      debug(`skipping ${id} (excluded)`)
      return false
    }
    if (link && link.includes(id)) {
      debug(`skipping ${id} (link)`)
      return false
    }
    if (KNOWN_IGNORE_LIST.has(id)) {
      debug(`skipping ${id} (internal excluded)`)
      return false
    }
    const pkgInfo = resolver_1.resolveNodeModule(root, id, resolver)
    if (!pkgInfo || !pkgInfo.entryFilePath) {
      debug(`skipping ${id} (cannot resolve entry)`)
      console.log(root, id)
      console.error(
        chalk_1.default.yellow(
          `[vite] cannot resolve entry for dependency ${chalk_1.default.cyan(
            id
          )}.`
        )
      )
      return false
    }
    const { entryFilePath } = pkgInfo
    if (
      !resolver_1.supportedExts.includes(path_1.default.extname(entryFilePath))
    ) {
      debug(`skipping ${id} (entry is not js)`)
      return false
    }
    if (!fs_extra_1.default.existsSync(entryFilePath)) {
      debug(`skipping ${id} (entry file does not exist)`)
      console.error(
        chalk_1.default.yellow(
          `[vite] dependency ${id} declares non-existent entry file ${entryFilePath}.`
        )
      )
      return false
    }
    const content = fs_extra_1.default.readFileSync(entryFilePath, 'utf-8')
    const [imports, exports] = es_module_lexer_1.parse(content)
    if (!exports.length && !/export\s+\*\s+from/.test(content)) {
      debug(`optimizing ${id} (no exports, likely commonjs)`)
      return true
    }
    for (const { s, e } of imports) {
      let i = content.slice(s, e).trim()
      i = resolver.alias(i) || i
      if (i.startsWith('.')) {
        debug(`optimizing ${id} (contains relative imports)`)
        return true
      }
      if (!deps.includes(i)) {
        debug(`optimizing ${id} (imports sub dependencies)`)
        return true
      }
    }
    debug(`skipping ${id} (single esm file, doesn't need optimization)`)
  })
  const qualified = {}
  qualifiedDeps.forEach((id) => {
    qualified[id] = resolver_1.resolveNodeModule(
      root,
      id,
      resolver
    ).entryFilePath
  })
  // mark non-optimized deps as external
  const external = deps
    .filter((id) => !qualifiedDeps.includes(id))
    // make sure aliased deps are external
    // https://github.com/vitejs/vite-plugin-react/issues/4
    .map((id) => resolver.alias(id) || id)
  return {
    qualified,
    external
  }
}
const lockfileFormats = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']
let cachedHash
function getDepHash(root, configPath) {
  if (cachedHash) {
    return cachedHash
  }
  let content = utils_1.lookupFile(root, lockfileFormats) || ''
  const pkg = JSON.parse(utils_1.lookupFile(root, [`package.json`]) || '{}')
  content += JSON.stringify(pkg.dependencies)
  // also take config into account
  if (configPath) {
    content += fs_extra_1.default.readFileSync(configPath, 'utf-8')
  }
  return crypto_1.createHash('sha1').update(content).digest('base64')
}
exports.getDepHash = getDepHash
const cacheDirCache = new Map()
function resolveOptimizedCacheDir(root, pkgPath) {
  const cached = cacheDirCache.get(root)
  if (cached !== undefined) return cached
  pkgPath =
    pkgPath || utils_1.lookupFile(root, [`package.json`], true /* pathOnly */)
  if (!pkgPath) {
    return null
  }
  const cacheDir = path_1.default.join(
    path_1.default.dirname(pkgPath),
    exports.OPTIMIZE_CACHE_DIR
  )
  cacheDirCache.set(root, cacheDir)
  return cacheDir
}
exports.resolveOptimizedCacheDir = resolveOptimizedCacheDir
//# sourceMappingURL=index.js.map
