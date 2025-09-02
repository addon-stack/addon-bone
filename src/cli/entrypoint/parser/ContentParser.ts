import z from "zod";

import AbstractParser from "./AbstractParser";

import {ContentScriptEntrypointOptions, ContentScriptMatches} from "@typing/content";
import {EntrypointFile} from "@typing/entrypoint";

export default class<
    O extends ContentScriptEntrypointOptions = ContentScriptEntrypointOptions,
> extends AbstractParser<O> {
    protected definition(): string | string[] {
        return ["defineContentScript", "defineContentScriptAppend"];
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        return this.CommonPropertiesSchema.extend({
            matches: z.array(z.string()).optional(),
            excludeMatches: z.array(z.string()).optional(),
            matchAboutBlank: z.boolean().optional(),
            includeGlobs: z.array(z.string()).optional(),
            excludeGlobs: z.array(z.string()).optional(),
            allFrames: z.boolean().optional(),
            world: z.enum(["ISOLATED", "MAIN"]).optional(),
            runAt: z.enum(["document_start", "document_end", "document_idle"]).optional(),
            matchOriginAsFallback: z.boolean().optional(),
            declarative: z.boolean().optional(),
        });
    }

    public options(file: EntrypointFile): O {
        const options = super.options(file);

        return {
            matches: ContentScriptMatches,
            runAt: "document_idle",
            ...options,
        };
    }
}
