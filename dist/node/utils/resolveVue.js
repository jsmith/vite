'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.resolveCompiler = exports.resolveVue = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const pathUtils_1 = require('./pathUtils')
const chalk_1 = __importDefault(require('chalk'))
const fsUtils_1 = require('./fsUtils')
let resolved = undefined
// Resolve the correct `vue` and `@vue.compiler-sfc` to use.
// If the user project has local installations of these, they should be used;
// otherwise, fallback to the dependency of Vite itself.
function resolveVue(root) {
  if (resolved) {
    return resolved
  }
  let vueVersion
  let vueBasePath
  let compilerPath
  const projectPkg = JSON.parse(
    fsUtils_1.lookupFile(root, ['package.json']) || `{}`
  )
  let isLocal = !!(projectPkg.dependencies && projectPkg.dependencies.vue)
  if (isLocal) {
    try {
      const userVuePkg = pathUtils_1.resolveFrom(root, 'vue/package.json')
      vueBasePath = path_1.default.dirname(userVuePkg)
      vueVersion = fs_extra_1.default.readJSONSync(userVuePkg).version
      isLocal = true
    } catch (e) {
      // user has vue listed but not actually installed.
      isLocal = false
    }
  }
  if (isLocal) {
    // user has local vue, verify that the same version of @vue/compiler-sfc
    // is also installed.
    try {
      const compilerPkgPath = pathUtils_1.resolveFrom(
        root,
        '@vue/compiler-sfc/package.json'
      )
      const compilerPkg = require(compilerPkgPath)
      if (compilerPkg.version !== vueVersion) {
        throw new Error()
      }
      compilerPath = path_1.default.join(
        path_1.default.dirname(compilerPkgPath),
        compilerPkg.main
      )
    } catch (e) {
      // user has local vue but has no compiler-sfc
      console.error(
        chalk_1.default.red(
          `[vite] Error: a local installation of \`vue\` is detected but ` +
            `no matching \`@vue/compiler-sfc\` is found. Make sure to install ` +
            `both and use the same version.`
        )
      )
      compilerPath = require.resolve('@vue/compiler-sfc')
    }
  } else {
    // user has no local vue, use vite's dependency version
    vueVersion = require('vue/package.json').version
    vueBasePath = path_1.default.dirname(require.resolve('vue/package.json'))
    compilerPath = require.resolve('@vue/compiler-sfc')
  }
  const resolvePath = (name, from) =>
    pathUtils_1.resolveFrom(from, `@vue/${name}/dist/${name}.esm-bundler.js`)
  // resolve nested dependencies with correct base dirs so that this works with
  // strict package managers - e.g. pnpm / yarn 2
  const runtimeDomPath = resolvePath('runtime-dom', vueBasePath)
  const runtimeCorePath = resolvePath('runtime-core', runtimeDomPath)
  const reactivityPath = resolvePath('reactivity', runtimeCorePath)
  const sharedPath = resolvePath('shared', runtimeCorePath)
  resolved = {
    version: vueVersion,
    vue: runtimeDomPath,
    '@vue/runtime-dom': runtimeDomPath,
    '@vue/runtime-core': runtimeCorePath,
    '@vue/reactivity': reactivityPath,
    '@vue/shared': sharedPath,
    compiler: compilerPath,
    isLocal
  }
  return resolved
}
exports.resolveVue = resolveVue
function resolveCompiler(cwd) {
  return require(resolveVue(cwd).compiler)
}
exports.resolveCompiler = resolveCompiler
//# sourceMappingURL=resolveVue.js.map
