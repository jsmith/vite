import { ServerPlugin } from './server'
import { Plugin as RollupPlugin } from 'rollup'
import { SourceMap } from './server/serverPluginSourceMap'
import { InternalResolver } from './resolver'
declare type ParsedQuery = Record<string, string | string[] | undefined>
interface TransformTestContext {
  /**
   * Full specifier of the transformed module, including query parameters
   */
  id: string
  /**
   * Path without query (use this to check for file extensions)
   */
  path: string
  /**
   * Parsed query object
   */
  query: ParsedQuery
  /**
   * Indicates whether this is a request made by js import(), or natively by
   * the browser (e.g. `<img src="...">`).
   */
  isImport: boolean
  isBuild: boolean
  /**
   * Indicates that the file for this request was not modified since last call.
   */
  notModified?: true
}
export interface TransformContext extends TransformTestContext {
  code: string
}
export interface TransformResult {
  code: string
  map?: SourceMap
}
export declare type TransformFn = (
  ctx: TransformContext
) => string | TransformResult | Promise<string | TransformResult>
export interface Transform {
  test: (ctx: TransformTestContext) => boolean
  transform: TransformFn
}
export declare type CustomBlockTransform = TransformFn
export declare function createServerTransformPlugin(
  transforms: Transform[],
  customBlockTransforms: Record<string, CustomBlockTransform>,
  resolver: InternalResolver
): ServerPlugin
export declare function createBuildJsTransformPlugin(
  transforms: Transform[],
  customBlockTransforms: Record<string, CustomBlockTransform>
): RollupPlugin
export {}
