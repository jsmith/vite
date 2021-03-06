/// <reference types="node" />
import { Context } from '../server'
import { Readable } from 'stream'
import { HMRWatcher } from '../server/serverPluginHmr'
/**
 * Read a file with in-memory cache.
 * Also sets appropriate headers and body on the Koa context.
 * This is exposed on middleware context as `ctx.read` with the `ctx` already
 * bound, so it can be used as `ctx.read(file)`.
 */
export declare function cachedRead(
  ctx: Context | null,
  file: string
): Promise<Buffer>
/**
 * Read already set body on a Koa context and normalize it into a string.
 * Useful in post-processing middlewares.
 */
export declare function readBody(
  stream: Readable | Buffer | string | null
): Promise<string | null>
export declare function lookupFile(
  dir: string,
  formats: string[],
  pathOnly?: boolean
): string | undefined
/**
 * Files under root are watched by default, but with user aliases we can still
 * serve files out of root. Add such files to the watcher (if not node_modules)
 */
export declare function watchFileIfOutOfRoot(
  watcher: HMRWatcher,
  root: string,
  file: string
): void
