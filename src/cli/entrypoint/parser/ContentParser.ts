import {isContentScriptFrameNavigation, resolveContentScriptIsolation} from "@shared/content";
import z from "zod";

import AbstractParser from "./AbstractParser";
import {ExportValueKind} from "../file";

import {
    ContentScriptDeclarative,
    ContentScriptEntrypointOptions,
    ContentScriptMarker,
    ContentScriptMatches,
    ContentScriptWorld,
    ContentScriptIsolation,
    ContentScriptIsolationOptions,
    ContentScriptShadowMode,
} from "@typing/content";
import {EntrypointFile, EntrypointOptions} from "@typing/entrypoint";

export default class<O extends EntrypointOptions = ContentScriptEntrypointOptions> extends AbstractParser<O> {
    protected definition(): string | string[] {
        return ["defineContentScript", "defineContentScriptAppend"];
    }

    protected schema(): z.AnyZodObject {
        const frameSchema = z
            .object({
                type: z.literal(ContentScriptIsolation.Iframe),
                width: z.union([z.number(), z.string()]),
                height: z.union([z.number(), z.string()]),
            })
            .strict();

        // getOptions normalizes shorthand and defaults before validating this object contract.
        const isolationSchema = z.union([
            z.object({type: z.literal(ContentScriptIsolation.None)}).strict(),
            z
                .object({
                    type: z.literal(ContentScriptIsolation.Shadow),
                    mode: z.nativeEnum(ContentScriptShadowMode),
                })
                .strict(),
            frameSchema,
            frameSchema.extend({page: z.string()}),
            frameSchema.extend({src: z.string()}),
        ]) satisfies z.ZodType<ContentScriptIsolationOptions>;

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
            isolation: isolationSchema,
        });
    }

    protected getOptions(file: EntrypointFile): Record<string, any> {
        const optionFile = this.optionFile(file);
        const declared = optionFile.getDeclaredProperties();
        const values = optionFile.getOptions();

        try {
            const hasRender =
                declared.has("render") ||
                (isContentScriptFrameNavigation(values.isolation) &&
                    !optionFile.getDefinition() &&
                    this.hasDefaultRender(file));
            return {...values, isolation: resolveContentScriptIsolation(values.isolation, hasRender)};
        } catch (error) {
            throw new Error(
                `Invalid content isolation in "${file.file}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    public options(file: EntrypointFile): O {
        const options = super.options(file);

        return {
            matches: ContentScriptMatches,
            runAt: "document_idle",
            ...options,
        };
    }

    /** Interprets generic export metadata using content render rules; Relay overrides this policy. */
    protected hasDefaultRender(file: EntrypointFile): boolean {
        const exported = this.expressionFile(file).getDefaultExport();

        if (!exported) {
            return false;
        }

        switch (exported.kind) {
            case ExportValueKind.Function:
            case ExportValueKind.Class:
            case ExportValueKind.Jsx:
            case ExportValueKind.Number:
                return true;
            case ExportValueKind.String:
                return exported.value !== "";
            default:
                return exported.properties.includes("$$typeof");
        }
    }
}
