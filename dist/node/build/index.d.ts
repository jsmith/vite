import { Ora } from 'ora'
import { RollupOutput, Plugin, InputOptions } from 'rollup'
import { InternalResolver } from '../resolver'
import { BuildConfig } from '../config'
export interface BuildResult {
  html: string
  assets: RollupOutput['output']
}
export declare function onRollupWarning(
  spinner: Ora | undefined,
  options: BuildConfig['optimizeDeps']
): InputOptions['onwarn']
/**
 * Creates non-application specific plugins that are shared between the main
 * app and the dependencies. This is used by the `optimize` command to
 * pre-bundle dependencies.
 */
export declare function createBaseRollupPlugins(
  root: string,
  resolver: InternalResolver,
  options: BuildConfig
): Promise<Plugin[]>
/**
 * Bundles the app for production.
 * Returns a Promise containing the build result.
 */
export declare function build(options: BuildConfig): Promise<BuildResult>
/**
 * Bundles the app in SSR mode.
 * - All Vue dependencies are automatically externalized
 * - Imports to dependencies are compiled into require() calls
 * - Templates are compiled with SSR specific optimizations.
 */
export declare function ssrBuild(options: BuildConfig): Promise<BuildResult>
