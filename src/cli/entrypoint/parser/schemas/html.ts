import {z} from "zod";

const HtmlTypeStringSchema = z.enum(["css", "js"]);

const HtmlAttributesObjectSchema = z.record(z.string(), z.union([z.string(), z.boolean(), z.number()]));

const HtmlAddHashFunctionSchema = z.function().args(z.string(), z.string()).returns(z.string());

const HtmlAddPublicPathFunctionSchema = z.function().args(z.string(), z.string()).returns(z.string());

const HtmlCommonOptionsSchema = z.object({
    append: z.boolean().optional(),
    useHash: z.boolean().optional(),
    addHash: HtmlAddHashFunctionSchema.optional(),
    hash: z.union([z.boolean(), z.string(), HtmlAddHashFunctionSchema]).optional(),
    usePublicPath: z.boolean().optional(),
    addPublicPath: HtmlAddPublicPathFunctionSchema.optional(),
    publicPath: z.union([z.boolean(), z.string(), HtmlAddPublicPathFunctionSchema]).optional(),
});

const HtmlExternalObjectSchema = z.object({
    packageName: z.string(),
    variableName: z.string(),
});

const HtmlBaseTagOptionsSchema = HtmlCommonOptionsSchema.extend({
    glob: z.string().optional(),
    globPath: z.string().optional(),
    globFlatten: z.boolean().optional(),
    sourcePath: z.string().optional(),
});

const HtmlLinkTagOptionsSchema = HtmlBaseTagOptionsSchema.extend({
    path: z.string(),
    attributes: HtmlAttributesObjectSchema.optional(),
});

const HtmlScriptTagOptionsSchema = HtmlBaseTagOptionsSchema.extend({
    path: z.string(),
    attributes: HtmlAttributesObjectSchema.optional(),
    external: HtmlExternalObjectSchema.optional(),
});

const HtmlMaybeLinkTagOptionsSchema = HtmlLinkTagOptionsSchema.extend({
    type: HtmlTypeStringSchema.optional(),
});

const HtmlMaybeScriptTagOptionsSchema = HtmlScriptTagOptionsSchema.extend({
    type: HtmlTypeStringSchema.optional(),
});

const HtmlMetaTagOptionsSchema = HtmlBaseTagOptionsSchema.extend({
    path: z.string().optional(),
    attributes: HtmlAttributesObjectSchema,
});

/**
 * Options a view passes to the HTML tags plugin.
 *
 * The same list validates what an entrypoint may declare and selects what reaches the HTML plugin,
 * so manifest-only options such as permissions or CSP never leak into it.
 */
export const HtmlOptionsSchema = HtmlCommonOptionsSchema.extend({
    append: z.boolean().optional(),
    prependExternals: z.boolean().optional(),
    jsExtensions: z.union([z.string(), z.array(z.string())]).optional(),
    cssExtensions: z.union([z.string(), z.array(z.string())]).optional(),
    tags: z
        .union([
            z.string(),
            HtmlMaybeLinkTagOptionsSchema,
            HtmlMaybeScriptTagOptionsSchema,
            z.array(z.union([z.string(), HtmlMaybeLinkTagOptionsSchema, HtmlMaybeScriptTagOptionsSchema])),
        ])
        .optional(),
    links: z
        .union([z.string(), HtmlLinkTagOptionsSchema, z.array(z.union([z.string(), HtmlLinkTagOptionsSchema]))])
        .optional(),
    scripts: z
        .union([z.string(), HtmlScriptTagOptionsSchema, z.array(z.union([z.string(), HtmlScriptTagOptionsSchema]))])
        .optional(),
    metas: z
        .union([z.string(), HtmlMetaTagOptionsSchema, z.array(z.union([z.string(), HtmlMetaTagOptionsSchema]))])
        .optional(),
});

export const HtmlOptionKeys: readonly string[] = Object.keys(HtmlOptionsSchema.shape);
