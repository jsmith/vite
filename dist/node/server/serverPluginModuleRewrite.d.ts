import { ServerPlugin } from '.'
import { InternalResolver } from '../resolver'
export declare const moduleRewritePlugin: ServerPlugin
export declare function rewriteImports(
  root: string,
  source: string,
  importer: string,
  resolver: InternalResolver,
  timestamp?: string
): string
export declare const resolveImport: (
  root: string,
  importer: string,
  id: string,
  resolver: InternalResolver,
  timestamp?: string | undefined
) => string
