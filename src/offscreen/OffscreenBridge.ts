import {isBackground} from "@addon-core/browser";

import {Message} from "@message/providers";
import {ReadyFrame} from "@frame/index";

import {OffscreenBridgeReadyMessageType} from "@typing/offscreen";

type CreateParameters = chrome.offscreen.CreateParameters;

export default class OffscreenBridge {
    protected readonly key: string = "offscreen-background";

    protected readonly message = new Message();

    protected readonly readyTimeout = 10000;

    private readonly frames = new ReadyFrame();

    private static instance?: OffscreenBridge;

    public static getInstance(): OffscreenBridge {
        return (OffscreenBridge.instance ??= new OffscreenBridge());
    }

    public static async createOffscreen(parameters: CreateParameters): Promise<void> {
        return OffscreenBridge.getInstance().create(parameters);
    }

    public async create(parameters: CreateParameters): Promise<any> {
        if (isBackground()) {
            await this.apply(parameters);

            return;
        }

        await this.message.send(this.key, parameters);
    }

    protected async apply({url}: CreateParameters): Promise<void> {
        await this.frames.make({
            key: url,
            url,
            readyTimeout: this.readyTimeout,
            isReady: (event, frame) =>
                event.source === frame.contentWindow &&
                event.origin === location.origin &&
                event.data?.type === OffscreenBridgeReadyMessageType,
            readyTimeoutMessage: () => `Offscreen iframe "${url}" was not ready in time.`,
            loadErrorMessage: () => `Offscreen iframe failed to load: ${url}`,
        });
    }
}
