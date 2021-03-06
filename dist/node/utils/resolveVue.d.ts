import sfcCompiler from '@vue/compiler-sfc'
interface ResolvedVuePaths {
  vue: string
  '@vue/runtime-dom': string
  '@vue/runtime-core': string
  '@vue/reactivity': string
  '@vue/shared': string
  compiler: string
  version: string
  isLocal: boolean
}
export declare function resolveVue(root: string): ResolvedVuePaths
export declare function resolveCompiler(cwd: string): typeof sfcCompiler
export {}
