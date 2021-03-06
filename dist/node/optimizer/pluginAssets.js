'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.createDepAssetPlugin = exports.depAssetExternalPlugin = exports.isAsset = void 0
const es_module_lexer_1 = require('es-module-lexer')
const cssUtils_1 = require('../utils/cssUtils')
const magic_string_1 = __importDefault(require('magic-string'))
const utils_1 = require('../utils')
const path_1 = __importDefault(require('path'))
exports.isAsset = (id) =>
  cssUtils_1.isCSSRequest(id) || utils_1.isStaticAsset(id)
exports.depAssetExternalPlugin = {
  name: 'vite:optimize-dep-assets-external',
  resolveId(id) {
    if (exports.isAsset(id)) {
      return {
        id,
        external: true
      }
    }
  }
}
exports.createDepAssetPlugin = (resolver, root) => {
  return {
    name: 'vite:optimize-dep-assets',
    async transform(code, id) {
      if (id.endsWith('.js')) {
        await es_module_lexer_1.init
        const [imports] = es_module_lexer_1.parse(code)
        if (imports.length) {
          let s
          for (let i = 0; i < imports.length; i++) {
            const { s: start, e: end, d: dynamicIndex } = imports[i]
            if (dynamicIndex === -1) {
              const importee = code.slice(start, end)
              if (exports.isAsset(importee)) {
                // replace css/asset imports to deep imports to their original
                // location
                s = s || new magic_string_1.default(code)
                const deepPath = resolver.fileToRequest(
                  utils_1.bareImportRE.test(importee)
                    ? utils_1.resolveFrom(root, importee)
                    : path_1.default.resolve(
                        path_1.default.dirname(id),
                        importee
                      )
                )
                s.overwrite(start, end, deepPath)
              }
            } else {
              // ignore dynamic import
            }
          }
          if (s) {
            return s.toString()
          }
        }
      }
      return null
    }
  }
}
//# sourceMappingURL=pluginAssets.js.map
