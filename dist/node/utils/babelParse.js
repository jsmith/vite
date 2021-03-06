'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.parse = void 0
const parser_1 = require('@babel/parser')
function parse(source) {
  return parser_1.parse(source, {
    sourceType: 'module',
    plugins: [
      // required for import.meta.hot
      'importMeta',
      // by default we enable proposals slated for ES2020.
      // full list at https://babeljs.io/docs/en/next/babel-parser#plugins
      // this should be kept in async with @vue/compiler-core's support range
      'bigInt',
      'optionalChaining',
      'nullishCoalescingOperator'
    ]
  }).program.body
}
exports.parse = parse
//# sourceMappingURL=babelParse.js.map
