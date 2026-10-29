import { PluginOption } from "vite";
//#region src/options.d.ts
interface VitePluginVueDevToolsOptions {
  /**
   * Whether to install Vue Devtools and register its Vite DevTools dock entry.
   *
   * @default true
   */
  enabled?: boolean;
  /**
   * Append the early Vue hook install import to a module instead of injecting it into HTML.
   * This is useful for apps without a Vite HTML entry. The Vite DevTools dock shell still
   * follows Vite DevTools' own HTML injection path.
   *
   * @default ''
   */
  appendTo?: string | RegExp | Array<string | RegExp>;
}
//#endregion
//#region src/index.d.ts
export declare function vueDevtools(options?: VitePluginVueDevToolsOptions): PluginOption[];
//#endregion
export { type VitePluginVueDevToolsOptions, vueDevtools as default };