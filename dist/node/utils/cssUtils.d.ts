import {
  SFCAsyncStyleCompileOptions,
  SFCStyleCompileResults
} from '@vue/compiler-sfc'
export declare const urlRE: RegExp
export declare const cssPreprocessLangRE: RegExp
export declare const cssModuleRE: RegExp
export declare const isCSSRequest: (file: string) => boolean
declare type Replacer = (url: string) => string | Promise<string>
export declare function rewriteCssUrls(
  css: string,
  replacerOrBase: string | Replacer
): Promise<string>
export declare function compileCss(
  root: string,
  publicPath: string,
  {
    source,
    filename,
    scoped,
    vars,
    modules,
    preprocessLang,
    preprocessOptions,
    modulesOptions
  }: SFCAsyncStyleCompileOptions,
  isBuild?: boolean
): Promise<SFCStyleCompileResults | string>
export declare function resolvePostcssOptions(
  root: string,
  isBuild: boolean
): Promise<{
  options: import('postcss').ProcessOptions | null
  plugins: (
    | import('postcss').Plugin<any>
    | import('postcss').Transformer
    | import('postcss').Processor
  )[]
}>
export declare const cssImporterMap: Map<string, Set<string>>
export declare const cssImporteeMap: Map<string, Set<string>>
export declare function getCssImportBoundaries(
  filePath: string,
  boundaries?: Set<string>
): Set<string>
export declare function recordCssImportChain(
  dependencies: Set<string>,
  filePath: string
): void
export {}
