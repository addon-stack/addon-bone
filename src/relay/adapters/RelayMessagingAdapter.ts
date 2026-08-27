import {isRemoteMessageError} from "@message/error";

import type {MessageSendOptions} from "@typing/message";
import {RelayAllFrames, RelayFrameErrorKind, type RelayAddressTarget, type RelayCallOptions} from "@typing/relay";
import type {TransportMessage} from "@typing/transport";

import RelayDiscovery from "../discovery/RelayDiscovery";
import RelayMessage from "../RelayMessage";
import {
    fulfilledRelayFrame,
    messageErrorKind,
    rejectedRelayFrame,
    RelayFrameTimeoutError,
    sortRelayFrameResults,
    withRelayTimeout,
} from "../result";
import RelayAdapter from "./RelayAdapter";

export default class RelayMessagingAdapter extends RelayAdapter {
    private readonly discovery = new RelayDiscovery();
    private readonly message: TransportMessage;

    public constructor(name: string, target: RelayCallOptions) {
        super(name, target);

        this.message = new RelayMessage(name);
    }

    public async invoke(args: any[], path?: string): Promise<any> {
        if (!this.isBatchTarget(this.target)) {
            const target = this.scalarTarget();

            return withRelayTimeout(
                this.message.send({path, args}, this.messageOptions(target)),
                this.target.timeoutMs
            );
        }

        if (this.target.allFrames === true || this.target.allFrames === RelayAllFrames.Any) {
            const target = {tabId: this.target.tabId, allFrames: RelayAllFrames.Any} as const;

            try {
                const result = await withRelayTimeout(
                    this.message.send({path, args}, {tabId: this.target.tabId}),
                    this.target.timeoutMs
                );

                return [fulfilledRelayFrame(target, result)];
            } catch (error) {
                const kind =
                    error instanceof RelayFrameTimeoutError
                        ? RelayFrameErrorKind.Timeout
                        : isRemoteMessageError(error)
                          ? RelayFrameErrorKind.Remote
                          : messageErrorKind(error);

                return [rejectedRelayFrame(target, error, kind)];
            }
        }

        const targets = await this.batchTargets();
        const results = await Promise.all(
            targets.map(async target => {
                try {
                    const result = await withRelayTimeout(
                        this.message.send({path, args}, this.messageOptions(target)),
                        this.target.timeoutMs
                    );

                    return fulfilledRelayFrame(target, result);
                } catch (error) {
                    const kind =
                        error instanceof RelayFrameTimeoutError
                            ? RelayFrameErrorKind.Timeout
                            : isRemoteMessageError(error)
                              ? RelayFrameErrorKind.Remote
                              : messageErrorKind(error);

                    return rejectedRelayFrame(target, error, kind);
                }
            })
        );

        return sortRelayFrameResults(results);
    }

    private scalarTarget(): RelayAddressTarget {
        if (this.target.frameId !== undefined) {
            return {tabId: this.target.tabId, frameId: this.target.frameId};
        }

        if (this.target.documentId !== undefined) {
            return {tabId: this.target.tabId, documentId: this.target.documentId};
        }

        return {tabId: this.target.tabId, frameId: 0};
    }

    private async batchTargets(): Promise<RelayAddressTarget[]> {
        if (this.target.allFrames === RelayAllFrames.All) {
            return this.discovery.discover(this.target.tabId);
        }

        if (this.target.frameIds !== undefined) {
            return this.target.frameIds.map(frameId => ({tabId: this.target.tabId, frameId}));
        }

        return (this.target.documentIds ?? []).map(documentId => ({tabId: this.target.tabId, documentId}));
    }

    private messageOptions(target: RelayAddressTarget): MessageSendOptions {
        if (target.frameId !== undefined) {
            return {
                tabId: target.tabId,
                frameId: target.frameId,
                ...(target.documentId === undefined ? {} : {documentId: target.documentId}),
            };
        }

        return {tabId: target.tabId, documentId: target.documentId};
    }
}
