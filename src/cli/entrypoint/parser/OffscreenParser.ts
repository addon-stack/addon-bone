import z from "zod";

import ViewCspParser from "./ViewCspParser";

import {OffscreenEntrypointOptions, OffscreenReason} from "@typing/offscreen";

export default class extends ViewCspParser<OffscreenEntrypointOptions> {
    protected definition(): string {
        return "defineOffscreen";
    }

    protected agreement(): string {
        return "init";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        const reasonEnumValues = Object.values(OffscreenReason);

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
            reasons: z
                .union(
                    [
                        z.enum(reasonEnumValues as [string, ...string[]]),
                        z.array(z.enum(reasonEnumValues as [string, ...string[]])),
                    ],
                    {
                        message:
                            'The "reasons" field must be a valid OffscreenReason enum value or array of enum values',
                    }
                )
                .optional(),
            justification: z.string().trim().optional(),
        });
    }
}
