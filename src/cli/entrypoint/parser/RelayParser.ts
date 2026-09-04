import z from "zod";

import ContentParser from "./ContentParser";

import {RelayAllFrames, RelayEntrypointOptions, RelayMethod} from "@typing/relay";
import {EntrypointFile} from "@typing/entrypoint";
import {ContentScriptDeclarative} from "@typing/content";

export default class extends ContentParser<RelayEntrypointOptions> {
    protected definition(): string {
        return "defineRelay";
    }

    protected agreement(): string {
        return "init";
    }

    protected schema() {
        return super
            .schema()
            .omit({shadow: true})
            .extend({
                allFrames: z.union([z.boolean(), z.nativeEnum(RelayAllFrames)]).optional(),
                name: z
                    .string()
                    .trim()
                    .min(1)
                    .max(100)
                    .regex(/^[\p{L}_$][\p{L}\p{N}_$]*$/u, {
                        message:
                            "Key must start with a Unicode letter, `$` or `_`, and may only contain letters, digits, `$` or `_`",
                    })
                    .optional(),
                method: z.nativeEnum(RelayMethod).optional(),
            });
    }

    public options(file: EntrypointFile): RelayEntrypointOptions {
        const {declarative, method, ...options} = super.options(file);

        return {
            ...options,
            method,
            declarative:
                declarative === undefined
                    ? method === RelayMethod.Scripting
                        ? ContentScriptDeclarative.Optional
                        : undefined
                    : declarative,
        };
    }
}
