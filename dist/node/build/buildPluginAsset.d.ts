/// <reference types="node" />
import { Plugin, OutputBundle } from 'rollup'
interface AssetCacheEntry {
  content?: Buffer
  fileName?: string
  url: string
}
export declare const resolveAsset: (
  id: string,
  root: string,
  publicBase: string,
  assetsDir: string,
  inlineLimit: number
) => Promise<AssetCacheEntry>
export declare const registerAssets: (
  assets: Map<string, Buffer>,
  bundle: OutputBundle
) => void
export declare const createBuildAssetPlugin: (
  root: string,
  publicBase: string,
  assetsDir: string,
  inlineLimit: number
) => Plugin
export {}
