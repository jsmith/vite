import { ServerPlugin } from '.'
import {
  SFCDescriptor,
  SFCStyleCompileResults,
  BindingMetadata
} from '@vue/compiler-sfc'
import LRUCache from 'lru-cache'
import { SourceMap } from './serverPluginSourceMap'
export declare const srcImportMap: Map<any, any>
interface CacheEntry {
  descriptor?: SFCDescriptor
  template?: ResultWithMap
  script?: ResultWithMap
  styles: SFCStyleCompileResults[]
  customs: string[]
}
interface ResultWithMap {
  code: string
  map: SourceMap | null | undefined
  bindings?: BindingMetadata
}
export declare const vueCache: LRUCache<string, CacheEntry>
export declare const vuePlugin: ServerPlugin
export {}
