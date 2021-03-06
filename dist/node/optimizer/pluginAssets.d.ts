import { Plugin } from 'rollup'
import { InternalResolver } from '../resolver'
export declare const isAsset: (id: string) => boolean
export declare const depAssetExternalPlugin: Plugin
export declare const createDepAssetPlugin: (
  resolver: InternalResolver,
  root: string
) => Plugin
