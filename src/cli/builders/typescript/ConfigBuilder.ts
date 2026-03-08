import _ from "lodash";

import {isPlainObject, mergeDeep} from "./utils";

import type {PartialDeep, TsConfigJson} from "type-fest";

import type {DotPath, PathValue, TsConfigBuilder} from "@typing/typescript";

export class ConfigBuilder implements TsConfigBuilder {
    private readonly state?: TsConfigJson;

    private constructor(initial?: TsConfigJson) {
        this.state = mergeDeep({}, initial || {});
    }

    static from(initial?: TsConfigJson): TsConfigBuilder {
        return new ConfigBuilder(initial);
    }

    public get(): TsConfigJson;
    public get<P extends DotPath<TsConfigJson>>(path: P): PathValue<TsConfigJson, P> | undefined;
    public get(path?: string) {
        if (!path) {
            return _.cloneDeep(this.state);
        }

        const segments = path.split(".");
        let current: any = this.state;

        for (const segment of segments) {
            if (!current || typeof current !== "object") {
                return undefined;
            }
            current = current[segment];
        }

        return current;
    }

    public set<P extends DotPath<TsConfigJson>>(path: P, value: PathValue<TsConfigJson, P>) {
        const segments = path.split(".");
        let current: any = this.state;

        while (segments.length > 1) {
            const segment = segments.shift()!;
            if (!isPlainObject(current[segment])) {
                current[segment] = {};
            }
            current = current[segment];
        }

        current[segments[0]] = value;
        return this;
    }

    public has(path: DotPath<TsConfigJson>): boolean {
        return this.get(path) !== undefined;
    }

    public delete(path: DotPath<TsConfigJson>) {
        const segments = path.split(".");
        let current: any = this.state;

        while (segments.length > 1) {
            const segment = segments.shift()!;
            if (!isPlainObject(current[segment])) {
                return this;
            }
            current = current[segment];
        }

        delete current[segments[0]];
        return this;
    }

    public merge(config: PartialDeep<TsConfigJson>) {
        return this.raw(config);
    }

    public raw(config: PartialDeep<TsConfigJson>) {
        mergeDeep(this.state || {}, config);
        return this;
    }

    public toJSON(): string {
        return JSON.stringify(this.get());
    }
}
