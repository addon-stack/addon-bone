import {getAllFrames, getManifest} from "@addon-core/browser";

import type {RelayAddressTarget} from "@typing/relay";

export class RelayDiscoveryError extends Error {
    public constructor(message: string, cause?: unknown) {
        super(message, cause === undefined ? undefined : {cause});
        this.name = "RelayDiscoveryError";
    }
}

/** Enumerates frame addresses for strict Messaging All calls, without checking whether Relay is registered. */
export default class RelayDiscovery {
    public async discover(tabId: number): Promise<RelayAddressTarget[]> {
        this.assertSupported();

        try {
            const frames = await getAllFrames(tabId);

            return this.normalize(
                frames.map(frame => ({
                    tabId,
                    frameId: frame.frameId,
                    ...(frame.documentId ? {documentId: frame.documentId} : {}),
                }))
            );
        } catch (error) {
            throw new RelayDiscoveryError(
                `Relay failed to discover frames in tab ${tabId} through webNavigation.getAllFrames().`,
                error
            );
        }
    }

    private assertSupported(): void {
        let permissions: string[];

        try {
            permissions = getManifest().permissions ?? [];
        } catch (error) {
            throw new RelayDiscoveryError(
                'Relay could not verify the "webNavigation" permission required for Messaging "allFrames".',
                error
            );
        }

        if (!permissions.includes("webNavigation")) {
            throw new RelayDiscoveryError(
                'Messaging Relay with RelayAllFrames.All requires the "webNavigation" permission. Configure the Relay entrypoint with allFrames: RelayAllFrames.All so the framework can declare it automatically, or use RelayAllFrames.Any, "frameIds" or "documentIds".'
            );
        }
    }

    private normalize(targets: RelayAddressTarget[]): RelayAddressTarget[] {
        const unique = new Map<string, RelayAddressTarget>();

        for (const target of targets) {
            const key =
                target.frameId === undefined
                    ? `${target.tabId}:document:${target.documentId}`
                    : `${target.tabId}:frame:${target.frameId}`;

            unique.set(key, target);
        }

        return [...unique.values()].sort((a, b) => {
            const frameDifference = (a.frameId ?? Number.MAX_SAFE_INTEGER) - (b.frameId ?? Number.MAX_SAFE_INTEGER);

            if (frameDifference !== 0) {
                return frameDifference;
            }

            return (a.documentId ?? "").localeCompare(b.documentId ?? "");
        });
    }
}
