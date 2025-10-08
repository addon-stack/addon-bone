import {isBackground} from "@addon-core/browser";

import {Message} from "@message/providers";

type CreateParameters = chrome.offscreen.CreateParameters;

export default class OffscreenBridge {
    protected readonly key: string = "offscreen-background";

    protected readonly message = new Message();

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
        return new Promise<void>((resolve, reject) => {
            if (document.querySelector(`iframe[src="${url}"]`)) {
                resolve();

                return;
            }

            const iframe = document.createElement("iframe");

            iframe.src = url;
            iframe.onload = () => resolve();
            iframe.onerror = () => reject();

            document.body.appendChild(iframe);
        });
    }
}
