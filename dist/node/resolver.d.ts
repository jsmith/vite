export interface Resolver {
  requestToFile?(publicPath: string, root: string): string | undefined
  fileToRequest?(filePath: string, root: string): string | undefined
  alias?: ((id: string) => string | undefined) | Record<string, string>
}
export interface InternalResolver {
  requestToFile(publicPath: string): string
  fileToRequest(filePath: string): string
  normalizePublicPath(publicPath: string): string
  alias(id: string): string | undefined
  resolveRelativeRequest(
    publicPath: string,
    relativePublicPath: string
  ): {
    pathname: string
    query: string
  }
  isPublicRequest(publicPath: string): boolean
}
export declare const supportedExts: string[]
export declare const mainFields: string[]
export declare function createResolver(
  root: string,
  resolvers?: Resolver[],
  userAlias?: Record<string, string>
): InternalResolver
export declare const jsSrcRE: RegExp
/**
 * Redirects a bare module request to a full path under /@modules/
 * It resolves a bare node module id to its full entry path so that relative
 * imports from the entry can be correctly resolved.
 * e.g.:
 * - `import 'foo'` -> `import '/@modules/foo/dist/index.js'`
 * - `import 'foo/bar/baz'` -> `import '/@modules/foo/bar/baz.js'`
 */
export declare function resolveBareModuleRequest(
  root: string,
  id: string,
  importer: string,
  resolver: InternalResolver
): string
export declare function resolveOptimizedModule(
  root: string,
  id: string
): string | undefined
interface NodeModuleInfo {
  entry: string | undefined
  entryFilePath: string | undefined
  pkg: any
}
export declare function resolveNodeModule(
  root: string,
  id: string,
  resolver: InternalResolver
): NodeModuleInfo | undefined
export declare function resolveNodeModuleFile(
  root: string,
  id: string
): string | undefined
export {}
