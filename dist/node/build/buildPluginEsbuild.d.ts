import { Plugin } from 'rollup'
import { SharedConfig } from '../config'
export declare const createEsbuildPlugin: (
  jsx: SharedConfig['jsx']
) => Promise<Plugin>
export declare const createEsbuildRenderChunkPlugin: (
  target: string,
  minify: boolean
) => Plugin
