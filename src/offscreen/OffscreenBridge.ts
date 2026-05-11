import {isBackground} from "@addon-core/browser";

import {Message} from "@message/providers";

import {OffscreenBridgeReadyMessageType} from "@typing/offscreen";

type CreateParameters = chrome.offscreen.CreateParameters;

export default class OffscreenBridge {
    protected readonly key: string = "offscreen-background";

    protected readonly message = new Message();

    protected readonly readyTimeout = 10000;

    private readonly framesReady: Map<string, Promise<void>> = new Map();

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

    protected apply({url}: CreateParameters): Promise<void> {
        const ready = this.framesReady.get(url);

        if (ready) {
            return ready;
        }

        const existing = this.getFrame(url);

        if (existing?.dataset.ready === "true") {
            return Promise.resolve();
        }

        const creation = this.createFrame(url, existing).finally(() => {
            this.framesReady.delete(url);
        });

        this.framesReady.set(url, creation);

        return creation;
    }

    private createFrame(url: string, existing?: HTMLIFrameElement): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const iframe = existing ?? document.createElement("iframe");

            const cleanup = () => {
                clearTimeout(timeout);
                window.removeEventListener("message", listener);
                iframe.onerror = null;
            };

            const listener = (event: MessageEvent) => {
                if (event.source !== iframe.contentWindow) {
                    return;
                }

                if (event.origin !== location.origin) {
                    return;
                }

                if (event.data?.type !== OffscreenBridgeReadyMessageType) {
                    return;
                }

                iframe.dataset.ready = "true";

                cleanup();
                resolve();
            };

            const timeout = setTimeout(() => {
                cleanup();
                iframe.remove();

                reject(new Error(`Offscreen iframe "${url}" was not ready in time.`));
            }, this.readyTimeout);

            iframe.onerror = () => {
                cleanup();
                iframe.remove();
                reject(new Error(`Offscreen iframe failed to load: ${url}`));
            };

            window.addEventListener("message", listener);

            if (!existing) {
                iframe.src = url;
                document.body.appendChild(iframe);
            }
        });
    }

    private getFrame(url: string): HTMLIFrameElement | undefined {
        return Array.from(document.querySelectorAll("iframe")).find(iframe => iframe.getAttribute("src") === url);
    }
}
