import ProxyTransport from "@transport/ProxyTransport";

import RelayAdapter from "../adapters/RelayAdapter";
import RelayMessagingAdapter from "../adapters/RelayMessagingAdapter";
import RelayScriptingAdapter from "../adapters/RelayScriptingAdapter";
import RelayManager from "../RelayManager";
import RelayPermission from "../RelayPermission";
import {isRelayContext} from "../utils";

import type {RpcAsyncProxy} from "@typing/rpc";
import {RelayAllFrames, RelayMethod, type RelayCallOptions, type RelayOptions} from "@typing/relay";
import type {TransportDictionary, TransportManager, TransportName} from "@typing/transport";

export type ProxyRelayParams = number | RelayCallOptions;

export default class ProxyRelay<
    N extends TransportName,
    T = RpcAsyncProxy<TransportDictionary[N]>,
> extends ProxyTransport<N, T> {
    private static readonly SelectorKeys = ["allFrames", "frameId", "frameIds", "documentId", "documentIds"] as const;

    private _adapter?: RelayAdapter;
    private _target?: RelayCallOptions;

    constructor(
        name: N,
        protected readonly options: RelayOptions,
        private readonly params: ProxyRelayParams,
        private readonly permission: RelayPermission
    ) {
        super(name);
    }

    private get adapter(): RelayAdapter {
        return (this._adapter ??=
            this.options.method === RelayMethod.Scripting
                ? new RelayScriptingAdapter(this.name, this.target)
                : new RelayMessagingAdapter(this.name, this.target));
    }

    private get target(): RelayCallOptions {
        if (this._target) {
            return this._target;
        }

        const target: Record<string, unknown> =
            typeof this.params === "number" ? {tabId: this.params} : {...this.params};

        this.validateTabId(target.tabId);
        this.validateTimeout(target.timeoutMs);

        const selected = ProxyRelay.SelectorKeys.filter(key => target[key] !== undefined);

        if (selected.length > 1) {
            this.invalid(`selectors are mutually exclusive; received ${selected.map(key => `"${key}"`).join(", ")}.`);
        }

        if (
            target.allFrames !== undefined &&
            target.allFrames !== false &&
            target.allFrames !== true &&
            target.allFrames !== RelayAllFrames.Any &&
            target.allFrames !== RelayAllFrames.All
        ) {
            this.invalid('"allFrames" accepts only false, true, RelayAllFrames.Any or RelayAllFrames.All.');
        }

        if (target.frameId !== undefined) {
            this.validateFrameId(target.frameId);
        }

        if (target.frameIds !== undefined) {
            this.validateArray(target.frameIds, "frameIds", (item, property) => this.validateFrameId(item, property));
        }

        if (target.documentId !== undefined) {
            this.validateDocumentId(target.documentId);
        }

        if (target.documentIds !== undefined) {
            this.validateArray(target.documentIds, "documentIds", (item, property) =>
                this.validateDocumentId(item, property)
            );
        }

        return (this._target = target as unknown as RelayCallOptions);
    }

    protected manager(): TransportManager {
        return RelayManager.getInstance();
    }

    protected async apply(args: any[], path?: string): Promise<any> {
        if (!this.permission.allow(this.name)) {
            if (!(await this.permission.request(this.name))) {
                throw new Error(
                    `ProxyRelay: User denied required permissions for relay "${this.name}" at path "${path}". Cannot proceed with the operation.`
                );
            }
        }

        return this.adapter.invoke(args, path);
    }

    private validateTabId(tabId: unknown): void {
        if (!Number.isInteger(tabId) || (tabId as number) < 0) {
            this.invalid('"tabId" must be a non-negative integer.');
        }
    }

    private validateFrameId(frameId: unknown, property = "frameId"): void {
        if (!Number.isInteger(frameId) || (frameId as number) < 0) {
            this.invalid(`"${property}" must contain only non-negative integers.`);
        }
    }

    private validateDocumentId(documentId: unknown, property = "documentId"): void {
        if (typeof documentId !== "string" || documentId.trim() === "") {
            this.invalid(`"${property}" must contain only non-empty strings.`);
        }
    }

    private validateTimeout(timeoutMs: unknown): void {
        if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || (timeoutMs as number) <= 0)) {
            this.invalid('"timeoutMs" must be greater than zero.');
        }
    }

    private validateArray(
        value: unknown,
        property: "frameIds" | "documentIds",
        validate: (item: unknown, property: string) => void
    ): void {
        if (!Array.isArray(value) || value.length === 0) {
            this.invalid(`"${property}" must be a non-empty array.`);
        }

        const items = value as unknown[];

        items.forEach(item => validate(item, property));

        if (new Set(items).size !== items.length) {
            this.invalid(`"${property}" must not contain duplicate values.`);
        }
    }

    private invalid(message: string): never {
        throw new TypeError(`Invalid Relay target: ${message}`);
    }

    public get(): T {
        if (isRelayContext()) {
            throw new Error(
                `You are trying to get proxy relay "${this.name}" from script content. You can get original relay instead`
            );
        }

        void this.target;

        return super.get();
    }
}
