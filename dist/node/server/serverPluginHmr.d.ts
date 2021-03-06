import { ServerPlugin } from '.'
import { FSWatcher } from 'chokidar'
import MagicString from 'magic-string'
import { InternalResolver } from '../resolver'
import LRUCache from 'lru-cache'
import { HMRPayload } from '../../hmrPayload'
export declare const debugHmr: any
export declare type HMRWatcher = FSWatcher & {
  handleVueReload: (
    filePath: string,
    timestamp?: number,
    content?: string
  ) => void
  handleJSReload: (filePath: string, timestamp?: number) => void
  send: (payload: HMRPayload) => void
}
declare type HMRStateMap = Map<string, Set<string>>
export declare const hmrAcceptanceMap: HMRStateMap
export declare const hmrDeclineSet: Set<string>
export declare const importerMap: HMRStateMap
export declare const importeeMap: HMRStateMap
export declare const hmrDirtyFilesMap: LRUCache<string, Set<string>>
export declare const latestVersionsMap: Map<string, string>
export declare const hmrPlugin: ServerPlugin
export declare function ensureMapEntry(
  map: HMRStateMap,
  key: string
): Set<string>
export declare function rewriteFileWithHMR(
  root: string,
  source: string,
  importer: string,
  resolver: InternalResolver,
  s: MagicString
): void
export {}
