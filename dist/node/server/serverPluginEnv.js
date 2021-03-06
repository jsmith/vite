'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.envPlugin = exports.envPublicPath = void 0
exports.envPublicPath = '/vite/env'
exports.envPlugin = ({ app, config }) => {
  // configMode = mode of the .env{.mode} file that was loaded
  const configMode = config.mode || 'development'
  // resolvedMode = potentially overwritten by NODE_ENV inside the .env
  // (which is set as VITE_ENV to avoid system default NODE_ENV)
  const resolvedMode = process.env.VITE_ENV || configMode
  const env = JSON.stringify({
    ...config.env,
    BASE_URL: '/',
    MODE: configMode,
    DEV: resolvedMode !== 'production',
    PROD: resolvedMode === 'production'
  })
  app.use((ctx, next) => {
    if (ctx.path === exports.envPublicPath) {
      ctx.type = 'js'
      ctx.body = `export default ${env}`
      return
    }
    return next()
  })
}
//# sourceMappingURL=serverPluginEnv.js.map
