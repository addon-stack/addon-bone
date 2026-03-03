import _ from "lodash";

import type {PartialDeep} from "type-fest";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) return false;

    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

export function mergeDeep<T extends object>(target: T, source: PartialDeep<T>): T {
    return _.mergeWith(target, source, (_objValue, srcValue) => {
        if (Array.isArray(srcValue)) {
            return srcValue;
        }
    });
}
