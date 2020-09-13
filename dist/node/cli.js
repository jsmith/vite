'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
const start = Date.now()
const argv = require('minimist')(process.argv.slice(2))
// make sure to set debug flag before requiring anything
if (argv.debug) {
  process.env.DEBUG = `vite:` + (argv.debug === true ? '*' : argv.debug)
  try {
    // this is only present during local development
    require('source-map-support').install()
  } catch (e) {}
}
const os_1 = __importDefault(require('os'))
const path_1 = __importDefault(require('path'))
const chalk_1 = __importDefault(require('chalk'))
const config_1 = require('./config')
const command = argv._[0]
const defaultMode = command === 'build' ? 'production' : 'development'
function logHelp() {
  console.log(`
Usage: vite [command] [args] [--options]

Commands:
  vite                       Start server in current directory.
  vite serve [root=cwd]      Start server in target directory.
  vite build [root=cwd]      Build target directory.

Options:
  --help, -h                 [boolean] show help
  --version, -v              [boolean] show version
  --config, -c               [string]  use specified config file
  --port                     [number]  port to use for serve
  --open                     [boolean] open browser on server start
  --base                     [string]  public base path for build (default: /)
  --outDir                   [string]  output directory for build (default: dist)
  --assetsDir                [string]  directory under outDir to place assets in (default: assets)
  --assetsInlineLimit        [number]  static asset base64 inline threshold in bytes (default: 4096)
  --sourcemap                [boolean] output source maps for build (default: false)
  --minify                   [boolean | 'terser' | 'esbuild'] enable/disable minification, or specify
                                       minifier to use. (default: 'terser')
  --mode, -m                 [string]  specify env mode (default: 'development' for dev, 'production' for build)
  --ssr                      [boolean] build for server-side rendering
  --jsx                      ['vue' | 'preact' | 'react']  choose jsx preset (default: 'vue')
  --jsx-factory              [string]  (default: React.createElement)
  --jsx-fragment             [string]  (default: React.Fragment)
  --force                    [boolean] force the optimizer to ignore the cache and re-bundle
`)
}
console.log(
  chalk_1.default.cyan(`vite v${require('../../package.json').version}`)
)
;(async () => {
  const { help, h, mode, m, version, v } = argv
  if (help || h) {
    logHelp()
    return
  } else if (version || v) {
    // noop, already logged
    return
  }
  const envMode = mode || m || defaultMode
  const options = await resolveOptions(envMode)
  process.env.NODE_ENV = process.env.NODE_ENV || envMode
  if (!options.command || options.command === 'serve') {
    runServe(options)
  } else if (options.command === 'build') {
    runBuild(options)
  } else if (options.command === 'optimize') {
    runOptimize(options)
  } else {
    console.error(chalk_1.default.red(`unknown command: ${options.command}`))
    process.exit(1)
  }
})()
async function resolveOptions(mode) {
  // specify env mode
  argv.mode = mode
  // map jsx args
  if (argv['jsx-factory']) {
    ;(argv.jsx || (argv.jsx = {})).factory = argv['jsx-factory']
  }
  if (argv['jsx-fragment']) {
    ;(argv.jsx || (argv.jsx = {})).fragment = argv['jsx-fragment']
  }
  // cast xxx=true | false into actual booleans
  Object.keys(argv).forEach((key) => {
    if (argv[key] === 'false') {
      argv[key] = false
    }
    if (argv[key] === 'true') {
      argv[key] = true
    }
  })
  // command
  if (argv._[0]) {
    argv.command = argv._[0]
  }
  // normalize root
  // assumes all commands are in the form of `vite [command] [root]`
  if (!argv.root && argv._[1]) {
    argv.root = argv._[1]
  }
  if (argv.root) {
    argv.root = path_1.default.isAbsolute(argv.root)
      ? argv.root
      : path_1.default.resolve(argv.root)
  }
  const userConfig = await config_1.resolveConfig(mode, argv.config || argv.c)
  if (userConfig) {
    return {
      ...userConfig,
      ...argv // cli options take higher priority
    }
  }
  // deprecation warning
  if (argv.sw || argv.serviceWorker) {
    console.warn(
      chalk_1.default.yellow(
        `[vite] service worker mode has been removed due to insufficient performance gains.`
      )
    )
  }
  return argv
}
function runServe(options) {
  const server = require('./server').createServer(options)
  let port = options.port || 3000
  let hostname = options.hostname || 'localhost'
  const protocol = options.https ? 'https' : 'http'
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying another one...`)
      setTimeout(() => {
        server.close()
        server.listen(++port)
      }, 100)
    } else {
      console.error(chalk_1.default.red(`[vite] server error:`))
      console.error(e)
    }
  })
  server.listen(port, () => {
    console.log()
    console.log(`  Dev server running at:`)
    const interfaces = os_1.default.networkInterfaces()
    Object.keys(interfaces).forEach((key) => {
      ;(interfaces[key] || [])
        .filter((details) => details.family === 'IPv4')
        .map((detail) => {
          return {
            type: detail.address.includes('127.0.0.1')
              ? 'Local:   '
              : 'Network: ',
            host: detail.address.replace('127.0.0.1', hostname)
          }
        })
        .forEach(({ type, host }) => {
          const url = `${protocol}://${host}:${chalk_1.default.bold(port)}/`
          console.log(`  > ${type} ${chalk_1.default.cyan(url)}`)
        })
    })
    console.log()
    require('debug')('vite:server')(`server ready in ${Date.now() - start}ms.`)
    if (options.open) {
      require('./utils/openBrowser').openBrowser(
        `${protocol}://${hostname}:${port}`
      )
    }
  })
}
async function runBuild(options) {
  try {
    await require('./build')[options.ssr ? 'ssrBuild' : 'build'](options)
    process.exit(0)
  } catch (err) {
    console.error(chalk_1.default.red(`[vite] Build errored out.`))
    console.error(err)
    process.exit(1)
  }
}
async function runOptimize(options) {
  try {
    await require('./optimizer').optimizeDeps(
      options,
      true /* as cli command */
    )
    process.exit(0)
  } catch (err) {
    console.error(chalk_1.default.red(`[vite] Dep optimization errored out.`))
    console.error(err)
    process.exit(1)
  }
}
//# sourceMappingURL=cli.js.map