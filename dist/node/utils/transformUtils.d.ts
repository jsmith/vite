export declare function asyncReplace(
  input: string,
  re: RegExp,
  replacer: (match: RegExpExecArray) => string | Promise<string>
): Promise<string>
export declare function injectScriptToHtml(html: string, script: string): string
