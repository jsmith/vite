'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.createBuildHtmlPlugin = void 0
const path_1 = __importDefault(require('path'))
const fs_extra_1 = __importDefault(require('fs-extra'))
const pathUtils_1 = require('../utils/pathUtils')
const buildPluginAsset_1 = require('./buildPluginAsset')
const magic_string_1 = __importDefault(require('magic-string'))
exports.createBuildHtmlPlugin = async (
  root,
  indexPath,
  publicBasePath,
  assetsDir,
  inlineLimit,
  resolver,
  shouldPreload
) => {
  if (!indexPath || !fs_extra_1.default.existsSync(indexPath)) {
    return {
      renderIndex: (...args) => '',
      htmlPlugin: null
    }
  }
  const rawHtml = await fs_extra_1.default.readFile(indexPath, 'utf-8')
  const assets = new Map()
  let { html: processedHtml, js } = await compileHtml(
    root,
    rawHtml,
    publicBasePath,
    assetsDir,
    inlineLimit,
    resolver,
    assets
  )
  const htmlPlugin = {
    name: 'vite:html',
    async load(id) {
      if (id === indexPath) {
        return js
      }
    },
    generateBundle(_options, bundle) {
      buildPluginAsset_1.registerAssets(assets, bundle)
    }
  }
  const injectCSS = (html, filename) => {
    const tag = `<link rel="stylesheet" href="${publicBasePath}${path_1.default.posix.join(
      assetsDir,
      filename
    )}">`
    if (/<\/head>/.test(html)) {
      return html.replace(/<\/head>/, `${tag}\n</head>`)
    } else {
      return tag + '\n' + html
    }
  }
  const injectScript = (html, filename) => {
    filename = pathUtils_1.isExternalUrl(filename)
      ? filename
      : `${publicBasePath}${path_1.default.posix.join(assetsDir, filename)}`
    const tag = `<script type="module" src="${filename}"></script>`
    if (/<\/body>/.test(html)) {
      return html.replace(/<\/body>/, `${tag}\n</body>`)
    } else {
      return html + '\n' + tag
    }
  }
  const injectPreload = (html, filename) => {
    filename = pathUtils_1.isExternalUrl(filename)
      ? filename
      : `${publicBasePath}${path_1.default.posix.join(assetsDir, filename)}`
    const tag = `<link rel="modulepreload" href="${filename}" />`
    if (/<\/head>/.test(html)) {
      return html.replace(/<\/head>/, `${tag}\n</head>`)
    } else {
      return tag + '\n' + html
    }
  }
  const renderIndex = (bundleOutput) => {
    for (const chunk of bundleOutput) {
      if (chunk.type === 'chunk') {
        if (chunk.isEntry) {
          // js entry chunk
          processedHtml = injectScript(processedHtml, chunk.fileName)
        } else if (shouldPreload && shouldPreload(chunk)) {
          // async preloaded chunk
          processedHtml = injectPreload(processedHtml, chunk.fileName)
        }
      } else {
        // imported css chunks
        if (
          chunk.fileName.endsWith('.css') &&
          chunk.source &&
          !assets.has(chunk.fileName)
        ) {
          processedHtml = injectCSS(processedHtml, chunk.fileName)
        }
      }
    }
    return processedHtml
  }
  return {
    renderIndex,
    htmlPlugin
  }
}
// this extends the config in @vue/compiler-sfc with <link href>
const assetAttrsConfig = {
  link: ['href'],
  video: ['src', 'poster'],
  source: ['src'],
  img: ['src'],
  image: ['xlink:href', 'href'],
  use: ['xlink:href', 'href']
}
// compile index.html to a JS module, importing referenced assets
// and scripts
const compileHtml = async (
  root,
  html,
  publicBasePath,
  assetsDir,
  inlineLimit,
  resolver,
  assets
) => {
  const { parse, transform } = require('@vue/compiler-dom')
  // @vue/compiler-core doesn't like lowercase doctypes
  html = html.replace(/<!doctype\s/i, '<!DOCTYPE ')
  const ast = parse(html)
  let js = ''
  const s = new magic_string_1.default(html)
  const assetUrls = []
  const viteHtmlTransform = (node) => {
    if (node.type === 1 /* ELEMENT */) {
      if (node.tag === 'script') {
        let shouldRemove = true
        const srcAttr = node.props.find(
          (p) => p.type === 6 /* ATTRIBUTE */ && p.name === 'src'
        )
        const typeAttr = node.props.find(
          (p) => p.type === 6 /* ATTRIBUTE */ && p.name === 'type'
        )
        const isJsModule =
          !typeAttr ||
          (typeAttr && typeAttr.value && typeAttr.value.content === 'module')
        if (srcAttr && srcAttr.value) {
          if (!pathUtils_1.isExternalUrl(srcAttr.value.content) && isJsModule) {
            // <script type="module" src="..."/>
            // add it as an import
            js += `\nimport ${JSON.stringify(srcAttr.value.content)}`
          } else {
            shouldRemove = false
          }
        } else if (node.children.length && isJsModule) {
          // <script type="module">...</script>
          // add its content
          // TODO: if there are multiple inline module scripts on the page,
          // they should technically be turned into separate modules, but
          // it's hard to imagine any reason for anyone to do that.
          js += `\n` + node.children[0].content.trim() + `\n`
        }
        if (shouldRemove && isJsModule) {
          // remove the script tag from the html. we are going to inject new
          // ones in the end.
          s.remove(node.loc.start.offset, node.loc.end.offset)
        }
      }
      // For asset references in index.html, also generate an import
      // statement for each - this will be handled by the asset plugin
      const assetAttrs = assetAttrsConfig[node.tag]
      if (assetAttrs) {
        for (const p of node.props) {
          if (
            p.type === 6 /* ATTRIBUTE */ &&
            p.value &&
            assetAttrs.includes(p.name) &&
            !pathUtils_1.isExternalUrl(p.value.content) &&
            !pathUtils_1.isDataUrl(p.value.content)
          ) {
            assetUrls.push(p)
          }
        }
      }
    }
  }
  transform(ast, {
    nodeTransforms: [viteHtmlTransform]
  })
  // for each encountered asset url, rewrite original html so that it
  // references the post-build location.
  for (const attr of assetUrls) {
    const value = attr.value
    const { fileName, content, url } = await buildPluginAsset_1.resolveAsset(
      resolver.requestToFile(value.content),
      root,
      publicBasePath,
      assetsDir,
      pathUtils_1.cleanUrl(value.content).endsWith('.css') ? 0 : inlineLimit
    )
    s.overwrite(value.loc.start.offset, value.loc.end.offset, `"${url}"`)
    if (fileName && content) {
      assets.set(fileName, content)
    }
  }
  return {
    html: s.toString(),
    js
  }
}
//# sourceMappingURL=buildPluginHtml.js.map
