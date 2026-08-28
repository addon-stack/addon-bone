export interface ReadyFrameParams {
    key: string;
    url: string;
    readyTimeout?: number;
    isReady: (event: MessageEvent, frame: HTMLIFrameElement) => boolean;
    readyTimeoutMessage?: (loaded: boolean, readyTimeout: number) => string;
    loadErrorMessage?: () => string;
}

const DefaultReadyTimeout = 10000;

/**
 * Creates and tracks a hidden iframe that announces readiness via `postMessage`, resolving once
 * the injected `isReady` matcher accepts an inbound message — or rejecting on load error / ready
 * timeout. Concurrent `make` calls for the same `key` share a single creation.
 *
 * The `isReady` matcher is the seam: each caller decides how to recognize and *trust* its own
 * ready signal (a sandboxed frame has an opaque origin and matches by channel/name; a same-origin
 * frame additionally matches by `event.origin`). Keeping that decision out here is what lets one
 * deep module serve both the sandbox and the offscreen-fallback frames.
 */
export default class ReadyFrame {
    private readonly frames: Map<string, {element: HTMLIFrameElement; ready: boolean}> = new Map();

    private readonly pending: Map<string, Promise<HTMLIFrameElement>> = new Map();

    public async make(params: ReadyFrameParams): Promise<HTMLIFrameElement> {
        if (typeof window === "undefined" || typeof document === "undefined" || !document.body) {
            throw new Error("A frame can be created only from a page with DOM access.");
        }

        const entry = this.frames.get(params.key);

        if (entry?.ready && entry.element.isConnected && entry.element.contentWindow) {
            return entry.element;
        }

        const pending = this.pending.get(params.key);

        if (pending) {
            return pending;
        }

        const creation = this.create(params);

        this.pending.set(params.key, creation);

        try {
            return await creation;
        } finally {
            this.pending.delete(params.key);
        }
    }

    public remove(key: string): void {
        this.frames.get(key)?.element.remove();
        this.frames.delete(key);
        this.pending.delete(key);
    }

    private create(params: ReadyFrameParams): Promise<HTMLIFrameElement> {
        const {key, url, readyTimeout = DefaultReadyTimeout, isReady} = params;

        return new Promise((resolve, reject) => {
            const existing = this.frames.get(key)?.element;
            const frame = existing?.isConnected ? existing : document.createElement("iframe");

            let loaded = false;

            const cleanup = () => {
                clearTimeout(timeout);
                window.removeEventListener("message", listener);
                frame.onload = null;
                frame.onerror = null;
            };

            const fail = (error: Error) => {
                cleanup();
                frame.remove();
                this.frames.delete(key);
                reject(error);
            };

            const listener = (event: MessageEvent) => {
                if (!isReady(event, frame)) {
                    return;
                }

                this.frames.set(key, {element: frame, ready: true});

                cleanup();
                resolve(frame);
            };

            const timeout = setTimeout(() => {
                fail(
                    new Error(
                        params.readyTimeoutMessage?.(loaded, readyTimeout) ??
                            `Frame "${key}" was not ready within ${readyTimeout}ms.`
                    )
                );
            }, readyTimeout);

            frame.onload = () => {
                loaded = true;
            };

            frame.onerror = () => {
                fail(new Error(params.loadErrorMessage?.() ?? `Frame "${key}" failed to load: ${url}`));
            };

            frame.hidden = true;

            window.addEventListener("message", listener);

            if (!frame.parentElement) {
                frame.src = url;
                document.body.appendChild(frame);
            }

            this.frames.set(key, {element: frame, ready: false});
        });
    }
}
