import { Plugin } from 'rollup'
import { BuildConfig } from '../config'
import { SFCAsyncStyleCompileOptions } from '@vue/compiler-sfc'
import { CssPreprocessOptions } from '../config'
interface BuildCssOption {
  root: string
  publicBase: string
  assetsDir: string
  minify?: BuildConfig['minify']
  inlineLimit?: number
  cssCodeSplit?: boolean
  preprocessOptions?: CssPreprocessOptions
  modulesOptions?: SFCAsyncStyleCompileOptions['modulesOptions']
}
export declare const createBuildCssPlugin: ({
  root,
  publicBase,
  assetsDir,
  minify,
  inlineLimit,
  cssCodeSplit,
  preprocessOptions,
  modulesOptions
}: BuildCssOption) => Plugin
export {}
