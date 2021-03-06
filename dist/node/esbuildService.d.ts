import { TransformOptions } from 'esbuild'
import { SharedConfig } from './config'
export declare const tjsxRE: RegExp
export declare const vueJsxPublicPath = '/vite/jsx'
export declare const vueJsxFilePath: string
export declare function resolveJsxOptions(
  options?: SharedConfig['jsx']
): Pick<TransformOptions, 'jsxFactory' | 'jsxFragment'> | undefined
export declare const stopService: () => Promise<void>
export declare const transform: (
  src: string,
  request: string,
  options?: TransformOptions,
  jsxOption?: SharedConfig['jsx']
) => Promise<
  | {
      code: string
      map: string
    }
  | {
      code: string
      map: undefined
    }
>
