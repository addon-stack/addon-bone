import {sandboxChannel} from "./utils";

import {ReadyFrame} from "@frame/index";

import {SandboxParameters, SandboxReadyMessage, SandboxReadyMessageType} from "@typing/sandbox";

export default class SandboxFrame {
    private readonly frames = new ReadyFrame();

    public make(name: string, parameters: SandboxParameters): Promise<HTMLIFrameElement> {
        const {url, readyTimeout} = parameters;
        const channel = sandboxChannel(name);

        return this.frames.make({
            key: name,
            url,
            readyTimeout,
            isReady: (event, frame) => {
                if (event.source !== frame.contentWindow) {
                    return false;
                }

                const data = event.data as Partial<SandboxReadyMessage>;

                return data?.type === SandboxReadyMessageType && data.channel === channel && data.name === name;
            },
            readyTimeoutMessage: (loaded, timeout) =>
                loaded
                    ? `Sandbox "${name}" loaded but never signaled ready within ${timeout}ms. Ensure the sandbox entry runs and the manifest sandbox CSP allows its script.`
                    : `Sandbox "${name}" did not load "${url}" within ${timeout}ms. Ensure the page is listed in the manifest sandbox pages and is not blocked by CSP.`,
            loadErrorMessage: () => `Sandbox "${name}" failed to load: ${url}`,
        });
    }

    public remove(name: string): void {
        this.frames.remove(name);
    }
}
