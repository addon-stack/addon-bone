import {closeOffscreen, createOffscreen, hasOffscreen, isManifestVersion3} from "@addon-core/browser";

import {getBrowser} from "@main/env";

import {__t} from "@locale/helpers";

import ProxyTransport from "@transport/ProxyTransport";

import OffscreenManager from "../OffscreenManager";
import OffscreenMessage from "../OffscreenMessage";
import OffscreenBridge from "../OffscreenBridge";

import {isOffscreen} from "../utils";

import {Browser} from "@typing/browser";
import {DeepAsyncProxy} from "@typing/helpers";
import {TransportDictionary, TransportManager, TransportMessage, TransportName} from "@typing/transport";

type CreateParameters = chrome.offscreen.CreateParameters;

export default class ProxyOffscreen<
    N extends TransportName,
    T = DeepAsyncProxy<TransportDictionary[N]>,
> extends ProxyTransport<N, T> {
    protected message: TransportMessage;

    private url?: string;

    private static instance?: ProxyOffscreen<any, any>;

    public static getInstance<N extends TransportName, T = DeepAsyncProxy<TransportDictionary[N]>>(
        name: N,
        parameters: CreateParameters
    ): ProxyOffscreen<N, T> {
        return (this.instance ??= new ProxyOffscreen(name, parameters));
    }

    constructor(
        name: N,
        private parameters: CreateParameters
    ) {
        super(name);

        this.message = new OffscreenMessage(name);
    }

    protected manager(): TransportManager {
        return OffscreenManager.getInstance();
    }

    protected async apply(args: any[], path?: string): Promise<any> {
        const parameters: CreateParameters = {
            ...this.parameters,
            justification: __t(this.parameters.justification),
        };

        if (!isManifestVersion3() || getBrowser() === Browser.Firefox) {
            await OffscreenBridge.createOffscreen(parameters);
        } else {
            const exists = await hasOffscreen();

            if (!exists || this.url !== parameters.url) {
                if (exists) {
                    await closeOffscreen();
                }

                await createOffscreen(parameters);

                this.url = parameters.url;
            }
        }

        return this.message.send({path, args});
    }

    public get(): T {
        if (isOffscreen()) {
            throw new Error(
                `You are trying to get proxy offscreen service "${this.name}" from offscreen. You can get original offscreen service instead`
            );
        }

        return super.get();
    }
}
