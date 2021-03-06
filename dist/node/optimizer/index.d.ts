import { ResolvedConfig } from '../config'
export interface DepOptimizationOptions {
  /**
   * Force optimize listed dependencies (supports deep paths).
   */
  include?: string[]
  /**
   * Do not optimize these dependencies.
   */
  exclude?: string[]
  /**
   * A list of linked dependencies that should be treated as source code.
   * Use this to list linked packages in a monorepo so that their dependencies
   * are also included for optimization.
   */
  link?: string[]
  /**
   * A list of depdendencies that imports Node built-ins, but do not actually
   * use them in browsers.
   */
  allowNodeBuiltins?: string[]
  /**
   * Automatically run `vite optimize` on server start?
   * @default true
   */
  auto?: boolean
}
export declare const OPTIMIZE_CACHE_DIR = 'node_modules/.vite_opt_cache'
export declare function optimizeDeps(
  config: ResolvedConfig & {
    force?: boolean
  },
  asCommand?: boolean
): Promise<void>
export declare function getDepHash(
  root: string,
  configPath: string | undefined
): string
export declare function resolveOptimizedCacheDir(
  root: string,
  pkgPath?: string
): string | null
