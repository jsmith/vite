import { Plugin } from 'rollup'
export declare const createBuildWasmPlugin: (
  root: string,
  publicBase: string,
  assetsDir: string,
  inlineLimit: number
) => Plugin
