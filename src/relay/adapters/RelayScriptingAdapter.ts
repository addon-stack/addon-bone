import injectScriptFactory, {
    type InjectScriptContract,
    type InjectScriptOptions,
    type InjectScriptResult,
    type InjectScriptResultTarget,
    type InjectScriptTarget,
    type JsonValue,
} from "@addon-core/inject-script";

import {restoreError} from "@message/error";

import {
    RelayAllFrames,
    RelayFrameErrorKind,
    RelayGlobalKey,
    type RelayCallOptions,
    type RelayDocumentOptions,
    type RelayFrameOptions,
    type RelayFramesResult,
    type RelayResultTarget,
    type RelayScalarOptions,
} from "@typing/relay";

import {
    RelayProtocolError,
    fulfilledRelayFrame,
    injectScriptErrorKind,
    rejectedRelayFrame,
    sortRelayFrameResults,
} from "../result";
import RelayAdapter from "./RelayAdapter";
import {invokeRelay} from "./invoke-relay";
import type {RelayInvocationResult} from "./scripting-response";

export default class RelayScriptingAdapter extends RelayAdapter {
    private _injectScript?: InjectScriptContract;

    public constructor(name: string, target: RelayCallOptions) {
        super(name, target);
    }

    private get injectScript(): InjectScriptContract {
        return (this._injectScript ??= injectScriptFactory(this.injectScriptOptions()));
    }

    public async invoke(args: any[], path?: string): Promise<any> {
        const scriptArgs: [string, string | null, JsonValue[], string, boolean] = [
            this.name,
            path ?? null,
            args as JsonValue[],
            RelayGlobalKey,
            !this.isAnyFramesTarget(),
        ];
        const outcomes = await this.injectScript.run(invokeRelay, scriptArgs);
        const results = this.normalize(outcomes);

        if (this.isAnyFramesTarget()) {
            const result = results.find(result => result.status === "fulfilled") ?? results[0];

            return result
                ? [
                      {
                          ...result,
                          target: {tabId: this.target.tabId, allFrames: RelayAllFrames.Any},
                      },
                  ]
                : [];
        }

        if (this.isBatchTarget(this.target)) {
            return results;
        }

        return this.unwrap(results);
    }

    private normalize(outcomes: readonly InjectScriptResult<unknown>[]): RelayFramesResult<any> {
        return sortRelayFrameResults(
            outcomes.map(outcome => {
                const target = this.resultTarget(outcome.target);

                if (!outcome.success) {
                    return rejectedRelayFrame(target, outcome.error, injectScriptErrorKind(outcome.error.kind));
                }

                if (!this.isResponse(outcome.value)) {
                    const error = new RelayProtocolError(this.name);

                    if (!this.isBatchTarget(this.target)) {
                        throw error;
                    }

                    return rejectedRelayFrame(target, error, RelayFrameErrorKind.Execution);
                }

                if (!outcome.value.ok) {
                    return rejectedRelayFrame(target, outcome.value.error, RelayFrameErrorKind.Remote);
                }

                return fulfilledRelayFrame(target, outcome.value.hasResult ? outcome.value.result : undefined);
            })
        );
    }

    private isResponse(value: unknown): value is RelayInvocationResult {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            return false;
        }

        const response = value as Record<string, unknown>;

        if (response.ok === true) {
            return response.hasResult === false
                ? !Object.hasOwn(response, "result")
                : response.hasResult === true && Object.hasOwn(response, "result");
        }

        if (
            response.ok !== false ||
            typeof response.error !== "object" ||
            response.error === null ||
            Array.isArray(response.error)
        ) {
            return false;
        }

        const error = response.error as Record<string, unknown>;

        return (
            typeof error.name === "string" &&
            typeof error.message === "string" &&
            (error.stack === undefined || typeof error.stack === "string")
        );
    }

    private resultTarget(target: InjectScriptResultTarget): RelayResultTarget {
        if (target.allFrames === true) {
            return {
                tabId: target.tabId,
                allFrames: this.target.allFrames === RelayAllFrames.All ? RelayAllFrames.All : RelayAllFrames.Any,
            };
        }

        return target;
    }

    private unwrap(results: RelayFramesResult<any>): any {
        const result = results[0];

        if (!result) {
            throw new Error(`Relay "${this.name}" did not return a frame result.`);
        }

        if (result.status === "fulfilled") {
            return result.result;
        }

        throw restoreError(result.error);
    }

    private injectScriptOptions(): InjectScriptOptions {
        let injectTarget: InjectScriptTarget;

        if (
            this.target.allFrames === true ||
            this.target.allFrames === RelayAllFrames.Any ||
            this.target.allFrames === RelayAllFrames.All
        ) {
            injectTarget = {tabId: this.target.tabId, allFrames: true};
        } else if (this.target.frameIds !== undefined) {
            injectTarget = {tabId: this.target.tabId, frameIds: this.target.frameIds};
        } else if (this.target.documentIds !== undefined) {
            injectTarget = {tabId: this.target.tabId, documentIds: this.target.documentIds};
        } else if (this.isFrameTarget(this.target)) {
            injectTarget = {tabId: this.target.tabId, frameIds: [this.target.frameId]};
        } else if (this.isDocumentTarget(this.target)) {
            injectTarget = {tabId: this.target.tabId, documentIds: [this.target.documentId]};
        } else {
            injectTarget = {tabId: (this.target as RelayScalarOptions).tabId};
        }

        return {
            target: injectTarget,
            ...(this.target.timeoutMs === undefined ? {} : {timeoutMs: this.target.timeoutMs}),
        };
    }

    private isFrameTarget(target: RelayCallOptions): target is RelayFrameOptions {
        return target.frameId !== undefined;
    }

    private isDocumentTarget(target: RelayCallOptions): target is RelayDocumentOptions {
        return target.documentId !== undefined;
    }

    private isAnyFramesTarget(): boolean {
        return this.target.allFrames === true || this.target.allFrames === RelayAllFrames.Any;
    }
}
