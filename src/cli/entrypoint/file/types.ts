import type ts from "typescript";
import type SourceFile from "./SourceFile";

export interface Variable {
    name: string;
    value: any;
    exported: boolean;
}

export interface Injector<T = any> {
    from: string;
    target: string;
    name: string;
    value: T;
}

export type VariableMap = Map<string, Variable>;

export type ImportMap = Map<string, string>;

export type SourceValue = string | number | boolean | null | undefined | SourceValue[] | {[key: string]: SourceValue};

export type SourceReadResult<T = SourceValue> =
    | {resolved: true; value: T}
    | {resolved: false; file: string; path: string; reason: string};

/** An unevaluated expression and the module in which its identifiers are defined. */
export interface SourceBinding {
    source: SourceFile;
    node: ts.Node;
}

export interface SourceReadContext {
    path: string;
    seen: ReadonlySet<string>;
}

export interface SourceResolvedBinding extends SourceBinding {
    context: SourceReadContext;
}
