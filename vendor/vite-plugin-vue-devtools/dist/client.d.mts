import { DevtoolsKit } from "@vue/devtools-kit";
import { DevToolsClientContext, DockClientScriptContext } from "@vitejs/devtools-kit/client";
//#region src/client.d.ts
export interface InstallVueDevToolsOptions {
  enabled: boolean;
}
export declare function installVueDevTools(options: InstallVueDevToolsOptions): DevtoolsKit;
export declare const injectVueDevTools: typeof installVueDevTools;
export declare function setupVueDevToolsDockController(context?: DevToolsClientContext | DockClientScriptContext): void;
export declare function disposeVueDevTools(): void;
//#endregion