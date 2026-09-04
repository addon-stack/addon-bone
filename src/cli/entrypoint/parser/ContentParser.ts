import z from "zod";

import AbstractParser from "./AbstractParser";

import {
    ContentScriptDeclarative,
    ContentScriptEntrypointOptions,
    ContentScriptMarker,
    ContentScriptMatches,
    ContentScriptWorld,
} from "@typing/content";
import {EntrypointFile, EntrypointOptions} from "@typing/entrypoint";

export default class<O extends EntrypointOptions = ContentScriptEntrypointOptions> extends AbstractParser<O> {
    protected definition(): string | string[] {
        return ["defineContentScript", "defineContentScriptAppend"];
    }

    protected schema(): z.AnyZodObject {
        return this.CommonPropertiesSchema.extend({
            matches: z.array(z.string()).optional(),
            excludeMatches: z.array(z.string()).optional(),
            matchAboutBlank: z.boolean().optional(),
            includeGlobs: z.array(z.string()).optional(),
            excludeGlobs: z.array(z.string()).optional(),
            allFrames: z.boolean().optional(),
            world: z.nativeEnum(ContentScriptWorld).optional(),
            runAt: z.enum(["document_start", "document_end", "document_idle"]).optional(),
            matchOriginAsFallback: z.boolean().optional(),
            declarative: z.union([z.nativeEnum(ContentScriptDeclarative), z.boolean()]).optional(),
            marker: z.union([z.nativeEnum(ContentScriptMarker), z.boolean()]).optional(),
            shadow: z.union([z.boolean(), z.record(z.unknown()).transform(() => true)]).optional(),
        });
    }

    public options(file: EntrypointFile): O {
        const shadow = this.getOptions(file).shadow;

        if (
            shadow !== undefined &&
            typeof shadow !== "boolean" &&
            (typeof shadow !== "object" || shadow === null || Array.isArray(shadow))
        ) {
            throw new Error(`Invalid options shadow in "${file.file}": shadow must be a boolean literal or an object`);
        }

        const options = super.options(file);

        return {
            matches: ContentScriptMatches,
            runAt: "document_idle",
            ...options,
        };
    }
}
