'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.createBuildAssetPlugin = exports.registerAssets = exports.resolveAsset = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const utils_1 = require('../utils')
const hash_sum_1 = __importDefault(require('hash-sum'))
const slash_1 = __importDefault(require('slash'))
const mime_types_1 = __importDefault(require('mime-types'))
const debug = require('debug')('vite:build:asset')
const assetResolveCache = new Map()
const publicDirRE = /^public(\/|\\)/
exports.resolveAsset = async (id, root, publicBase, assetsDir, inlineLimit) => {
  id = utils_1.cleanUrl(id)
  const cached = assetResolveCache.get(id)
  if (cached) {
    return cached
  }
  let resolved
  const relativePath = path_1.default.relative(root, id)
  if (!fs_extra_1.default.existsSync(id)) {
    // try resolving from public dir
    const publicDirPath = path_1.default.join(root, 'public', relativePath)
    if (fs_extra_1.default.existsSync(publicDirPath)) {
      // file is resolved from public dir, it will be copied verbatim so no
      // need to read content here.
      resolved = {
        url: publicBase + slash_1.default(relativePath)
      }
    }
  }
  if (!resolved) {
    if (publicDirRE.test(relativePath)) {
      resolved = {
        url: publicBase + slash_1.default(relativePath.replace(publicDirRE, ''))
      }
    }
  }
  if (!resolved) {
    const ext = path_1.default.extname(id)
    const baseName = path_1.default.basename(id, ext)
    const resolvedFileName = `${baseName}.${hash_sum_1.default(id)}${ext}`
    let url =
      publicBase +
      slash_1.default(path_1.default.join(assetsDir, resolvedFileName))
    let content = await fs_extra_1.default.readFile(id)
    if (!id.endsWith(`.svg`) && content.length < Number(inlineLimit)) {
      url = `data:${mime_types_1.default.lookup(id)};base64,${content.toString(
        'base64'
      )}`
      content = undefined
    }
    resolved = {
      content,
      fileName: resolvedFileName,
      url
    }
  }
  assetResolveCache.set(id, resolved)
  return resolved
}
exports.registerAssets = (assets, bundle) => {
  for (const [fileName, source] of assets) {
    bundle[fileName] = {
      name: fileName,
      isAsset: true,
      type: 'asset',
      fileName,
      source
    }
  }
}
exports.createBuildAssetPlugin = (root, publicBase, assetsDir, inlineLimit) => {
  const assets = new Map()
  return {
    name: 'vite:asset',
    async load(id) {
      if (utils_1.isStaticAsset(id)) {
        const { fileName, content, url } = await exports.resolveAsset(
          id,
          root,
          publicBase,
          assetsDir,
          inlineLimit
        )
        if (fileName && content) {
          assets.set(fileName, content)
        }
        debug(`${id} -> ${url.startsWith('data:') ? `base64 inlined` : url}`)
        return `export default ${JSON.stringify(url)}`
      }
    },
    generateBundle(_options, bundle) {
      exports.registerAssets(assets, bundle)
    }
  }
}
//# sourceMappingURL=buildPluginAsset.js.map
