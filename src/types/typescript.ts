import type {Get, PartialDeep, TsConfigJson} from "type-fest";

export type DotPath<T> = T extends object
    ? {
          [K in Extract<keyof T, string>]: NonNullable<T[K]> extends object
              ? K | `${K}.${DotPath<NonNullable<T[K]>>}`
              : K;
      }[Extract<keyof T, string>]
    : never;

export type PathValue<T, P extends string> = Get<T, P>;

export interface TsConfigBuilder {
    get<P extends DotPath<TsConfigJson>>(path: P): PathValue<TsConfigJson, P> | undefined;

    get(): TsConfigJson;

    set<P extends DotPath<TsConfigJson>>(path: P, value: PathValue<TsConfigJson, P>): this;

    has(path: DotPath<TsConfigJson>): boolean;

    delete(path: DotPath<TsConfigJson>): this;

    merge(config: PartialDeep<TsConfigJson>): this;

    raw(config: PartialDeep<TsConfigJson>): this;

    toJSON(): string;
}
