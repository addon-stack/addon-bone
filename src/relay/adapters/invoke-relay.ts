import type {JsonValue} from "@addon-core/inject-script";
import type {MessageError} from "@typing/message";
import type {RelayInvocationResult} from "./scripting-response";

// Serialized by scripting.executeScript: all runtime dependencies must stay inside this function.
export const invokeRelay = (
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
        return Promise.resolve({ok: false, error: serialize(new Error("Relay manager not found."))});
    }

    return new Promise<RelayInvocationResult>(resolve => {
        const maxAttempts = 10;
        const delay = 300;
        // The synchronous lookup above is the first attempt.
        let attempts = 1;

        const findManager = () => {
            const delayedManager = globalThis[key];

            if (delayedManager) {
                resolve(invoke(delayedManager));

                return;
            }

            attempts++;

            if (attempts >= maxAttempts) {
                resolve({
                    ok: false,
                    error: serialize(new Error(`Relay manager not found after ${maxAttempts} attempts.`)),
                });

                return;
            }

            setTimeout(findManager, delay);
        };

        setTimeout(findManager, delay);
    });
};
