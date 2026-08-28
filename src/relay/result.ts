import {serializeError} from "@message/error";

import {InjectScriptTargetErrorKind} from "@addon-core/inject-script";

import {
    RelayFrameErrorKind,
    type RelayFrameResult,
    type RelayFramesResult,
    type RelayResultTarget,
} from "@typing/relay";

export class RelayFrameTimeoutError extends Error {
    public constructor(public readonly timeoutMs: number) {
        super(`Relay frame did not respond within ${timeoutMs}ms.`);
        this.name = "RelayFrameTimeoutError";
    }
}

export const fulfilledRelayFrame = <T>(target: RelayResultTarget, result: T): RelayFrameResult<T> => ({
    target,
    status: "fulfilled",
    result,
});

export const rejectedRelayFrame = <T>(
    target: RelayResultTarget,
    error: unknown,
    kind: RelayFrameErrorKind
): RelayFrameResult<T> => ({
    target,
    status: "rejected",
    error: {
        kind,
        ...serializeError(error),
    },
});

export const messageErrorKind = (error: unknown): RelayFrameErrorKind => {
    const message = error instanceof Error ? error.message : String(error);

    if (
        /receiving end does not exist|no matching message handler|frame.*(?:removed|not found)|no frame with id|invalid frame id/i.test(
            message
        )
    ) {
        return RelayFrameErrorKind.TargetGone;
    }

    return RelayFrameErrorKind.Delivery;
};

export const injectScriptErrorKind = (kind: `${InjectScriptTargetErrorKind}`): RelayFrameErrorKind => {
    switch (kind) {
        case InjectScriptTargetErrorKind.Execution:
            return RelayFrameErrorKind.Execution;
        case InjectScriptTargetErrorKind.Delivery:
            return RelayFrameErrorKind.Delivery;
        case InjectScriptTargetErrorKind.Timeout:
            return RelayFrameErrorKind.Timeout;
        case InjectScriptTargetErrorKind.TargetGone:
            return RelayFrameErrorKind.TargetGone;
        case InjectScriptTargetErrorKind.Unobservable:
            return RelayFrameErrorKind.Unobservable;
        default:
            throw new TypeError(`Unsupported Inject Script target error kind: ${kind}`);
    }
};

export const withRelayTimeout = <T>(promise: Promise<T>, timeoutMs?: number): Promise<T> => {
    if (timeoutMs === undefined) {
        return promise;
    }

    return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new RelayFrameTimeoutError(timeoutMs)), timeoutMs);

        promise.then(
            result => {
                clearTimeout(timeout);
                resolve(result);
            },
            error => {
                clearTimeout(timeout);
                reject(error);
            }
        );
    });
};

export const sortRelayFrameResults = <T>(results: RelayFramesResult<T>): RelayFramesResult<T> => {
    return [...results].sort((a, b) => {
        const frameDifference =
            (a.target.frameId ?? Number.MAX_SAFE_INTEGER) - (b.target.frameId ?? Number.MAX_SAFE_INTEGER);

        if (frameDifference !== 0) {
            return frameDifference;
        }

        return (a.target.documentId ?? "").localeCompare(b.target.documentId ?? "");
    });
};
