import z from "zod";

import ViewParser from "./ViewParser";

import {SandboxAllow, SandboxEntrypointOptions, SandboxSource} from "@typing/sandbox";

const sandboxAllowValues = Object.values(SandboxAllow) as [string, ...string[]];
const sandboxSourceValues = Object.values(SandboxSource) as [string, ...string[]];

export default class extends ViewParser<SandboxEntrypointOptions> {
    protected definition(): string {
        return "defineSandbox";
    }

    protected agreement(): string {
        return "init";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        const sources = z.array(z.enum(sandboxSourceValues)).optional();

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
            readyTimeout: z.number().positive().optional(),
            requestTimeout: z.number().positive().optional(),
            removeOnRequestTimeout: z.boolean().optional(),
            csp: z
                .object({
                    eval: z.boolean().optional(),
                    inline: z.boolean().optional(),
                    allow: z.array(z.enum(sandboxAllowValues)).optional(),
                    sources: z
                        .object({
                            connect: sources,
                            image: sources,
                            style: sources,
                            font: sources,
                            media: sources,
                            worker: sources,
                            child: sources,
                        })
                        .optional(),
                })
                .optional(),
        });
    }
}
