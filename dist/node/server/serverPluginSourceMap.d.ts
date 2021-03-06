import { ServerPlugin } from '.'
import { ExistingRawSourceMap } from 'rollup'
import { RawSourceMap } from 'source-map'
export declare type SourceMap = ExistingRawSourceMap | RawSourceMap
export declare function mergeSourceMap(
  oldMap: SourceMap | null | undefined,
  newMap: SourceMap
): SourceMap
export declare const sourceMapPlugin: ServerPlugin
