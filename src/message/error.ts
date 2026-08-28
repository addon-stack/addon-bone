import {MessageError} from "@typing/message";

const RemoteMessageErrorMarker = Symbol("RemoteMessageError");

export class UnsupportedMessageTargetError extends Error {
    public override readonly cause?: unknown;

    public constructor(message: string, cause?: unknown) {
        super(message);
        this.name = "UnsupportedMessageTargetError";

        if (cause !== undefined) {
            this.cause = cause;
        }
    }
}

const build = (name: string, message: string, stack?: string): MessageError => {
    return stack ? {name, message, stack} : {name, message};
};

const stringify = (error: object): string => {
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
};

const constructorFor = (name: string): new (message?: string) => Error => {
    switch (name) {
        case "EvalError":
            return EvalError;
        case "RangeError":
            return RangeError;
        case "ReferenceError":
            return ReferenceError;
        case "SyntaxError":
            return SyntaxError;
        case "TypeError":
            return TypeError;
        case "URIError":
            return URIError;
        default:
            return Error;
    }
};

/**
 * Convert any thrown value into a transferable {@link MessageError} envelope. Handles real
 * `Error` instances, error-like objects, and primitives (JSON-stringifying objects when no
 * `message` is present). The standard serialize step for every cross-context transport.
 */
export const serializeError = (error: unknown): MessageError => {
    if (error instanceof Error) {
        return build(error.name, error.message, error.stack);
    }

    if (typeof error === "object" && error !== null) {
        const record = error as Record<string, unknown>;
        const name = typeof record.name === "string" ? record.name : "Error";
        const message = typeof record.message === "string" ? record.message : stringify(error);
        const stack = typeof record.stack === "string" ? record.stack : undefined;

        return build(name, message, stack);
    }

    return build("Error", String(error));
};

/**
 * Reconstruct an `Error` from a {@link MessageError} envelope, mapping the serialized `name`
 * back to its native constructor (so `instanceof TypeError` survives the boundary).
 */
export const restoreError = (error?: MessageError): Error => {
    const ErrorConstructor = constructorFor(error?.name ?? "Error");
    const restored = new ErrorConstructor(error?.message ?? "Request failed.");

    restored.name = error?.name || "Error";

    if (error?.stack) {
        restored.stack = error.stack;
    }

    return restored;
};

export const markRemoteMessageError = <T extends Error>(error: T): T => {
    Object.defineProperty(error, RemoteMessageErrorMarker, {value: true});

    return error;
};

export const isRemoteMessageError = (error: unknown): error is Error => {
    return (
        error instanceof Error &&
        (error as Error & {[RemoteMessageErrorMarker]?: boolean})[RemoteMessageErrorMarker] === true
    );
};
