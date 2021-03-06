'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.recordCssImportChain = exports.getCssImportBoundaries = exports.cssImporteeMap = exports.cssImporterMap = exports.resolvePostcssOptions = exports.compileCss = exports.rewriteCssUrls = exports.isCSSRequest = exports.cssModuleRE = exports.cssPreprocessLangRE = exports.urlRE = void 0
const path_1 = __importDefault(require('path'))
const chalk_1 = __importDefault(require('chalk'))
const transformUtils_1 = require('./transformUtils')
const pathUtils_1 = require('./pathUtils')
const resolveVue_1 = require('./resolveVue')
const hash_sum_1 = __importDefault(require('hash-sum'))
exports.urlRE = /url\(\s*('[^']+'|"[^"]+"|[^'")]+)\s*\)/
exports.cssPreprocessLangRE = /(.+)\.(less|sass|scss|styl|stylus|postcss)$/
exports.cssModuleRE = /(.+)\.module\.(less|sass|scss|styl|stylus|postcss|css)$/
exports.isCSSRequest = (file) =>
  file.endsWith('.css') || exports.cssPreprocessLangRE.test(file)
function rewriteCssUrls(css, replacerOrBase) {
  let replacer
  if (typeof replacerOrBase === 'string') {
    replacer = (rawUrl) => {
      return path_1.default.posix.resolve(
        path_1.default.posix.dirname(replacerOrBase),
        rawUrl
      )
    }
  } else {
    replacer = replacerOrBase
  }
  return transformUtils_1.asyncReplace(css, exports.urlRE, async (match) => {
    let [matched, rawUrl] = match
    let wrap = ''
    const first = rawUrl[0]
    if (first === `"` || first === `'`) {
      wrap = first
      rawUrl = rawUrl.slice(1, -1)
    }
    if (
      pathUtils_1.isExternalUrl(rawUrl) ||
      rawUrl.startsWith('data:') ||
      rawUrl.startsWith('#')
    ) {
      return matched
    }
    return `url(${wrap}${await replacer(rawUrl)}${wrap})`
  })
}
exports.rewriteCssUrls = rewriteCssUrls
async function compileCss(
  root,
  publicPath,
  {
    source,
    filename,
    scoped,
    vars,
    modules,
    preprocessLang,
    preprocessOptions = {},
    modulesOptions = {}
  },
  isBuild = false
) {
  const id = hash_sum_1.default(publicPath)
  const postcssConfig = await loadPostcssConfig(root)
  const { compileStyleAsync } = resolveVue_1.resolveCompiler(root)
  if (
    publicPath.endsWith('.css') &&
    !modules &&
    !postcssConfig &&
    !isBuild &&
    !source.includes('@import')
  ) {
    // no need to invoke compile for plain css if no postcss config is present
    return source
  }
  const {
    options: postcssOptions,
    plugins: postcssPlugins
  } = await resolvePostcssOptions(root, isBuild)
  if (preprocessLang) {
    preprocessOptions = preprocessOptions[preprocessLang] || preprocessOptions
    // include node_modules for imports by default
    switch (preprocessLang) {
      case 'scss':
      case 'sass':
        preprocessOptions = {
          includePaths: ['node_modules'],
          ...preprocessOptions
        }
        break
      case 'less':
      case 'stylus':
        preprocessOptions = {
          paths: ['node_modules'],
          ...preprocessOptions
        }
    }
  }
  return await compileStyleAsync({
    source,
    filename,
    id: `data-v-${id}`,
    scoped,
    vars,
    modules,
    modulesOptions: {
      generateScopedName: `[local]_${id}`,
      localsConvention: 'camelCase',
      ...modulesOptions
    },
    preprocessLang,
    preprocessCustomRequire: (id) => require(pathUtils_1.resolveFrom(root, id)),
    preprocessOptions,
    postcssOptions,
    postcssPlugins
  })
}
exports.compileCss = compileCss
let cachedPostcssConfig
async function loadPostcssConfig(root) {
  if (cachedPostcssConfig !== undefined) {
    return cachedPostcssConfig
  }
  try {
    const load = require('postcss-load-config')
    return (cachedPostcssConfig = await load({}, root))
  } catch (e) {
    if (!/No PostCSS Config found/.test(e.message)) {
      console.error(chalk_1.default.red(`[vite] Error loading postcss config:`))
      console.error(e)
    }
    return (cachedPostcssConfig = null)
  }
}
async function resolvePostcssOptions(root, isBuild) {
  const config = await loadPostcssConfig(root)
  const options = config && config.options
  const plugins = config && config.plugins ? config.plugins.slice() : []
  plugins.unshift(require('postcss-import')())
  if (isBuild) {
    plugins.push(require('postcss-discard-comments')({ removeAll: true }))
  }
  return {
    options,
    plugins
  }
}
exports.resolvePostcssOptions = resolvePostcssOptions
exports.cssImporterMap = new Map()
exports.cssImporteeMap = new Map()
function getCssImportBoundaries(filePath, boundaries = new Set()) {
  if (!exports.cssImporterMap.has(filePath)) {
    return boundaries
  }
  const importers = exports.cssImporterMap.get(filePath)
  for (const importer of importers) {
    boundaries.add(importer)
    getCssImportBoundaries(importer, boundaries)
  }
  return boundaries
}
exports.getCssImportBoundaries = getCssImportBoundaries
function recordCssImportChain(dependencies, filePath) {
  const preImportees = exports.cssImporteeMap.get(filePath)
  // if import code change, should removed unused previous importee
  if (preImportees) {
    for (const preImportee of preImportees) {
      if (!dependencies.has(preImportee)) {
        const importers = exports.cssImporterMap.get(preImportee)
        if (importers) {
          importers.delete(filePath)
        }
      }
    }
  }
  dependencies.forEach((dependency) => {
    if (exports.cssImporterMap.has(dependency)) {
      exports.cssImporterMap.get(dependency).add(filePath)
    } else {
      exports.cssImporterMap.set(dependency, new Set([filePath]))
    }
  })
  exports.cssImporteeMap.set(filePath, dependencies)
}
exports.recordCssImportChain = recordCssImportChain
//# sourceMappingURL=cssUtils.js.map
