import injectScriptFactory, {type InjectScriptContract, type InjectScriptOptions} from "@adnbn/inject-script";
import {requestPermissions} from '@adnbn/browser';

import ProxyTransport from "@transport/ProxyTransport";

import RelayManager from "../RelayManager";
import RelayMessage from "../RelayMessage";
import RelayPermission from "../RelayPermission";
import {isRelayContext} from "../utils";

import {RelayGlobalKey, RelayMethod, RelayOptions} from "@typing/relay";
import type {DeepAsyncProxy} from "@typing/helpers";
import type {MessageSendOptions} from "@typing/message";
import type {TransportDictionary, TransportManager, TransportMessage, TransportName} from "@typing/transport";

export type Permissions = chrome.permissions.Permissions;

export type ProxyRelayParams =
    | number
    | (Omit<InjectScriptOptions, "frameId" | "documentId" | "timeFallback"> & {
          frameId?: number;
          documentId?: string;
      });

export default class ProxyRelay<
    N extends TransportName,
    T = DeepAsyncProxy<TransportDictionary[N]>,
> extends ProxyTransport<N, T> {
    private injectScript: InjectScriptContract;
    private message: TransportMessage;

    constructor(
        name: N,
        protected options: RelayOptions,
        protected params: ProxyRelayParams
    ) {
        super(name);

        this.message = new RelayMessage(name);

        this.injectScript = injectScriptFactory({
            ...(typeof params === "number" ? {tabId: params} : params),
            timeFallback: 4000,
        });
    }

    protected manager(): TransportManager {
        return RelayManager.getInstance();
    }

    protected permission(): RelayPermission {
        return RelayPermission.getInstance();
    }

    protected async apply(args: any[], path?: string): Promise<any> {
        try {
            if (!this.permission().get(this.name)) {
                if (!(await requestPermissions({
                    origins: this.options.matches,
                    permissions: this.options.method === RelayMethod.Scripting ? ['scripting'] : [],
                }))) {
                    console.warn('ProxyRelay: User denied required permissions. Cannot proceed with the operation.');
                    return;
                }
                this.permission().set(this.name, true);
            }
        } catch (err) {
            console.error('ProxyRelay: Error while requesting permissions', err);
            return;
        }

        return this.options.method === RelayMethod.Scripting
            ? this.scriptingApply(args, path)
            : this.messagingApply(args, path);
    }

    private async scriptingApply(args: any[], path?: string): Promise<any> {
        const func = async (name: string, path: string, args: any[], key: string) => {
            try {
                const awaitManager = async (maxAttempts = 10, delay = 300): Promise<RelayManager> => {
                    for (let count = 0; count < maxAttempts; count++) {
                        const manager = globalThis[key];

                        if (manager) return manager;

                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    throw new Error(`Relay manager not found after ${maxAttempts} attempts.`);
                };

                const manager: RelayManager = await awaitManager();

                return await manager.property(name, {path, args});
            } catch (e) {
                console.error(
                    `ProxyRelay.scriptingApply(): failed to access relay "${name}" at path "${path}" via injected script; manager with key "${key}" is unavailable or property not found. URL: ${document.location.href}`,
                    e
                );

                throw e;
            }
        };

        const result = await this.injectScript.run(func, [this.name, path!, args, RelayGlobalKey]);

        return result?.[0]?.result;
    }

    private async messagingApply(args: any[], path?: string): Promise<any> {
        const options: MessageSendOptions =
            typeof this.params === "number"
                ? {
                      tabId: this.params,
                      frameId: 0,
                  }
                : {
                      tabId: this.params.tabId,
                      frameId: this.params.frameId || 0,
                      documentId: this.params.documentId,
                  };

        return this.message.send({path, args}, options);
    }

    public get(): T {
        if (isRelayContext()) {
            throw new Error(
                `You are trying to get proxy relay "${this.name}" from script content. You can get original relay instead`
            );
        }

        return super.get();
    }
}
