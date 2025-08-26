import z from "zod";

import ContentParser from "./ContentParser";

import {RelayEntrypointOptions, RelayMethod} from "@typing/relay";
import {EntrypointFile} from "@typing/entrypoint";

export default class extends ContentParser<RelayEntrypointOptions> {
    protected definition(): string {
        return "defineRelay";
    }

    protected agreement(): string {
        return "init";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        return super.schema().extend({
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
        return {...super.options(file), declarative: true};
    }
}
