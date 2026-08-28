import injectScriptFactory, {
    type InjectScriptContract,
    type InjectScriptOptions,
    type InjectScriptResult,
    type InjectScriptResultTarget,
    type InjectScriptTarget,
    type JsonValue,
} from "@addon-core/inject-script";

import {restoreError} from "@message/error";

import type {MessageError} from "@typing/message";
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

import {fulfilledRelayFrame, injectScriptErrorKind, rejectedRelayFrame, sortRelayFrameResults} from "../result";
import RelayAdapter from "./RelayAdapter";

type RelayInvocationResult =
    | {
          ok: true;
          hasResult: false;
      }
    | {
          ok: true;
          hasResult: true;
          result: any;
      }
    | {
          ok: false;
          error: MessageError;
      };

export default class RelayScriptingAdapter extends RelayAdapter {
    private _injectScript?: InjectScriptContract;

    public constructor(name: string, target: RelayCallOptions) {
        super(name, target);
    }

    private get injectScript(): InjectScriptContract {
        return (this._injectScript ??= injectScriptFactory(this.injectScriptOptions()));
    }

    public async invoke(args: any[], path?: string): Promise<any> {
        const func = (
            name: string,
            path: string | null,
            args: JsonValue[],
            key: string,
            retryManager: boolean
        ): Promise<RelayInvocationResult> => {
            const serialize = (error: unknown): MessageError => {
                if (error instanceof Error) {
                    return {
                        name: error.name,
                        message: error.message,
                        ...(error.stack ? {stack: error.stack} : {}),
                    };
                }

                if (typeof error === "object" && error !== null) {
                    const record = error as Record<string, unknown>;

                    return {
                        name: typeof record.name === "string" ? record.name : "Error",
                        message:
                            typeof record.message === "string"
                                ? record.message
                                : (() => {
                                      try {
                                          return JSON.stringify(error) ?? String(error);
                                      } catch {
                                          return String(error);
                                      }
                                  })(),
                        ...(typeof record.stack === "string" ? {stack: record.stack} : {}),
                    };
                }

                return {name: "Error", message: String(error)};
            };

            const invoke = (manager: any): Promise<RelayInvocationResult> => {
                try {
                    return Promise.resolve(manager.property(name, {path, args})).then(
                        result =>
                            result === undefined
                                ? {ok: true as const, hasResult: false as const}
                                : {ok: true as const, hasResult: true as const, result},
                        error => ({ok: false as const, error: serialize(error)})
                    );
                } catch (error) {
                    return Promise.resolve({ok: false as const, error: serialize(error)});
                }
            };

            const manager = globalThis[key];

            if (manager) {
                // Keep the normal Scripting path synchronous until the remote method starts.
                return invoke(manager);
            }

            if (!retryManager) {
                return Promise.reject(new Error("Relay manager not found."));
            }

            return new Promise<RelayInvocationResult>((resolve, reject) => {
                const maxAttempts = 10;
                const delay = 300;
                let attempts = 0;

                const findManager = () => {
                    const delayedManager = globalThis[key];

                    if (delayedManager) {
                        resolve(invoke(delayedManager));
                        return;
                    }

                    attempts++;

                    if (attempts >= maxAttempts) {
                        reject(new Error(`Relay manager not found after ${maxAttempts} attempts.`));
                        return;
                    }

                    setTimeout(findManager, delay);
                };

                findManager();
            });
        };

        const scriptArgs: [string, string | null, JsonValue[], string, boolean] = [
            this.name,
            path ?? null,
            args as JsonValue[],
            RelayGlobalKey,
            !this.isAnyFramesTarget(),
        ];
        const outcomes = await this.injectScript.run(func, scriptArgs);
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

    private normalize(outcomes: readonly InjectScriptResult<RelayInvocationResult>[]): RelayFramesResult<any> {
        return sortRelayFrameResults(
            outcomes.map(outcome => {
                const target = this.resultTarget(outcome.target);

                if (!outcome.success) {
                    return rejectedRelayFrame(target, outcome.error, injectScriptErrorKind(outcome.error.kind));
                }

                if (!outcome.value.ok) {
                    return rejectedRelayFrame(target, outcome.value.error, RelayFrameErrorKind.Remote);
                }

                return fulfilledRelayFrame(target, outcome.value.hasResult ? outcome.value.result : undefined);
            })
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
