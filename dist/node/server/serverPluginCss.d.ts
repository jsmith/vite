import { ServerPlugin } from '.'
export declare const debugCSS: any
export declare const cssPlugin: ServerPlugin
export declare function codegenCss(
  id: string,
  css: string,
  modules?: Record<string, string>
): string
