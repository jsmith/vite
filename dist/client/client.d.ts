export declare function updateStyle(id: string, content: string): void
interface HotCallback {
  deps: string | string[]
  fn: (modules: object | object[]) => void
}
export declare const createHotContext: (
  id: string
) => {
  readonly data: any
  accept(callback?: HotCallback['fn']): void
  acceptDeps(deps: HotCallback['deps'], callback?: HotCallback['fn']): void
  dispose(cb: (data: any) => void): void
  decline(): void
  invalidate(): void
  on(event: string, cb: () => void): void
}
export {}
