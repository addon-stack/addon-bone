import _ from "lodash";

import {getEnv} from "@main/env";

import type {ReadonlyConfig} from "@typing/config";

export default abstract class AbstractMeta<V extends string = string> {
    public static value<T extends AbstractMeta<any>>(
        this: new (config: ReadonlyConfig) => T,
        config: ReadonlyConfig
    ): T extends AbstractMeta<infer V> ? V | undefined : never {
        return new this(config).getResolved() as T extends AbstractMeta<infer V> ? V | undefined : never;
    }

    public abstract getValue(): undefined | V | (() => V | undefined);

    protected constructor(protected readonly config: ReadonlyConfig) {}

    public getResolved(): V | undefined {
        const value = this.getValue();

        let resolved = _.isFunction(value) ? value() : value;

        if (this.isValid(resolved)) {
            return resolved;
        }

        if (_.isString(resolved)) {
            resolved = getEnv(resolved);

            if (this.isValid(resolved)) {
                return resolved;
            }
        }
    }

    protected isValid(value?: V): boolean {
        return true;
    }
}
