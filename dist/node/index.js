'use strict'
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        Object.defineProperty(o, k2, {
          enumerable: true,
          get: function () {
            return m[k]
          }
        })
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
      })
var __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (var p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p)
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.injectScriptToHtml = exports.isImportRequest = exports.isStaticAsset = exports.cachedRead = exports.readBody = void 0
__exportStar(require('./server'), exports)
__exportStar(require('./build'), exports)
__exportStar(require('./optimizer'), exports)
__exportStar(require('./config'), exports)
var utils_1 = require('./utils')
Object.defineProperty(exports, 'readBody', {
  enumerable: true,
  get: function () {
    return utils_1.readBody
  }
})
Object.defineProperty(exports, 'cachedRead', {
  enumerable: true,
  get: function () {
    return utils_1.cachedRead
  }
})
Object.defineProperty(exports, 'isStaticAsset', {
  enumerable: true,
  get: function () {
    return utils_1.isStaticAsset
  }
})
Object.defineProperty(exports, 'isImportRequest', {
  enumerable: true,
  get: function () {
    return utils_1.isImportRequest
  }
})
Object.defineProperty(exports, 'injectScriptToHtml', {
  enumerable: true,
  get: function () {
    return utils_1.injectScriptToHtml
  }
})
//# sourceMappingURL=index.js.map
