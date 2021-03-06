/// <reference types="node" />
import { Server } from 'http'
import Koa, { DefaultState, DefaultContext } from 'koa'
import { InternalResolver } from '../resolver'
import { HMRWatcher } from './serverPluginHmr'
import { ServerConfig } from '../config'
export { rewriteImports } from './serverPluginModuleRewrite'
import { SourceMap } from './serverPluginSourceMap'
export declare type ServerPlugin = (ctx: ServerPluginContext) => void
export interface ServerPluginContext {
  root: string
  app: Koa<State, Context>
  server: Server
  watcher: HMRWatcher
  resolver: InternalResolver
  config: ServerConfig & {
    __path?: string
  }
  port: number
}
export interface State extends DefaultState {}
export declare type Context = DefaultContext &
  ServerPluginContext & {
    read: (filePath: string) => Promise<Buffer | string>
    map?: SourceMap | null
  }
export declare function createServer(config: ServerConfig): Server
