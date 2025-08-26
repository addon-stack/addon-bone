import {getManifestVersion, isAvailableScripting} from "@adnbn/browser";

import injectScriptFactory, {type InjectScriptContract, type InjectScriptOptions} from "@adnbn/inject-script";

import ProxyTransport from "@transport/ProxyTransport";
import {MessageSendOptions} from "@message/providers";

import RelayManager from "../RelayManager";
import RelayMessage from "../RelayMessage";

import {RelayGlobalKey, RelayMethod} from "@typing/relay";

import type {DeepAsyncProxy} from "@typing/helpers";
import type {TransportDictionary, TransportManager, TransportMessage, TransportName} from "@typing/transport";

export type ProxyRelayOptions =
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
        protected method: RelayMethod,
        protected options: ProxyRelayOptions
    ) {
        super(name);

        this.message = new RelayMessage(name);

        this.injectScript = injectScriptFactory({
            ...(typeof options === "number" ? {tabId: options} : options),
            timeFallback: 4000,
        });
    }

    protected manager(): TransportManager {
        return RelayManager.getInstance();
    }

    protected async apply(args: any[], path?: string): Promise<any> {
        return this.method === RelayMethod.Scripting
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
            } catch (error) {
                console.error("ProxyRelay.createProxy()", document.location.href, error);

                throw error;
            }
        };

        const result = await this.injectScript.run(func, [this.name, path!, args, RelayGlobalKey]);

        return result?.[0]?.result;
    }

    private async messagingApply(args: any[], path?: string): Promise<any> {
        const options: MessageSendOptions = typeof this.options === "number"
            ? {
                tabId: this.options,
                frameId: 0
            }
            : {
                tabId: this.options.tabId,
                frameId: this.options.frameId || 0,
                documentId: this.options.documentId,
            };

        return this.message.send({path, args}, options);
    }

    public get(): T {
        if (!isAvailableScripting() && getManifestVersion() !== 2) {
            throw new Error(
                `You are trying to get proxy relay "${this.name}" from script content. You can get original relay instead`
            );
        }

        return super.get();
    }
}
