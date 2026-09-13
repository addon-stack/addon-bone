/**
 * Signature of a method parameter.
 */
export interface ParameterSignature {
    name: string;
    type: string;
    optional: boolean;
}

/**
 * Signature of a method.
 */
export interface MethodSignature {
    kind: "method";
    typeParameters: string[];
    parameters: ParameterSignature[];
    returnType: string;
}

/**
 * Signature of a property.
 */
export interface PropertySignature {
    kind: "property";
    type: string;
    optional?: boolean;
}

/**
 * Member of an interface: either a method or a property.
 */
export type MemberSignature = MethodSignature | PropertySignature;

export enum ExportValueKind {
    Function = "function",
    Class = "class",
    Jsx = "jsx",
    Object = "object",
    String = "string",
    Number = "number",
    Other = "other",
}

/** Source-level facts about an export, without TypeScript nodes or entrypoint-specific meaning. */
export interface ExportValue {
    readonly kind: ExportValueKind;
    /** Property names identified statically, without evaluating the exported value. */
    readonly properties: readonly string[];
    readonly value?: string | number;
}
