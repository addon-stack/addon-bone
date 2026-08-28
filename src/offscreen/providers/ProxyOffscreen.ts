import {closeOffscreen, createOffscreen, hasOffscreen, hasOffscreenPath, isManifestVersion3} from "@addon-core/browser";

import {isBrowser} from "@main/env";

import ProxyTransport from "@transport/ProxyTransport";

import OffscreenManager from "../OffscreenManager";
import OffscreenMessage from "../OffscreenMessage";
import OffscreenBridge from "../OffscreenBridge";

import {isOffscreen} from "../utils";

import {Browser} from "@typing/browser";
import {RpcAsyncProxy} from "@typing/rpc";
import {TransportDictionary, TransportManager, TransportMessage, TransportName} from "@typing/transport";

type CreateParameters = chrome.offscreen.CreateParameters;
type ReleaseLock = () => void;

const GateLockName = "adnbn:offscreen:gate";
const ActiveLockName = "adnbn:offscreen:active";

export default class ProxyOffscreen<
    N extends TransportName,
    T = RpcAsyncProxy<TransportDictionary[N]>,
> extends ProxyTransport<N, T> {
    protected message: TransportMessage;

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
        if (!isManifestVersion3() || isBrowser(Browser.Firefox)) {
            await OffscreenBridge.createOffscreen(this.parameters);

            return this.message.send({path, args});
        }

        const release = await this.acquire(this.parameters);

        try {
            return await this.message.send({path, args});
        } finally {
            release();
        }
    }

    private async acquire(parameters: CreateParameters): Promise<ReleaseLock> {
        return navigator.locks.request(GateLockName, {mode: "exclusive"}, async () => {
            if (await hasOffscreenPath(parameters.url)) {
                return this.acquireLock(ActiveLockName, {mode: "shared"});
            }

            const releaseActive = await this.acquireLock(ActiveLockName, {mode: "exclusive"});

            try {
                if (!(await hasOffscreenPath(parameters.url))) {
                    if (await hasOffscreen()) {
                        await closeOffscreen();
                    }

                    await createOffscreen(parameters);
                }
            } finally {
                releaseActive();
            }

            return this.acquireLock(ActiveLockName, {mode: "shared"});
        });
    }

    private async acquireLock(name: string, options: LockOptions): Promise<ReleaseLock> {
        let releaseLock!: ReleaseLock;

        // Keep the Web Lock callback pending and expose its resolver as a manual release function.
        const lockHeld = new Promise<void>(resolve => {
            releaseLock = resolve;
        });

        return new Promise<ReleaseLock>((resolve, reject) => {
            navigator.locks
                .request(name, options, async () => {
                    resolve(releaseLock);

                    await lockHeld;
                })
                .catch(reject);
        });
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
