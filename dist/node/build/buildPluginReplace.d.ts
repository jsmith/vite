import { Plugin } from 'rollup'
export declare const createReplacePlugin: (
  test: (id: string) => boolean,
  replacements: Record<string, any>,
  sourcemap: boolean
) => Plugin
