import { Plugin, RollupOutput, OutputChunk } from 'rollup'
import { InternalResolver } from '../resolver'
export declare const createBuildHtmlPlugin: (
  root: string,
  indexPath: string | null,
  publicBasePath: string,
  assetsDir: string,
  inlineLimit: number,
  resolver: InternalResolver,
  shouldPreload: ((chunk: OutputChunk) => boolean) | null
) => Promise<
  | {
      renderIndex: (...args: any[]) => string
      htmlPlugin: null
    }
  | {
      renderIndex: (bundleOutput: RollupOutput['output']) => string
      htmlPlugin: Plugin
    }
>
