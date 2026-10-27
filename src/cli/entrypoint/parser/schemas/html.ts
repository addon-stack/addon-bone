import {z} from "zod";

const AttributesSchema = z.record(z.union([z.string(), z.boolean(), z.number().finite()]));

const CommonSchema = z.object({
    append: z.boolean().optional(),
    useHash: z.boolean().optional(),
    addHash: z.never({invalid_type_error: "Configure addHash in config.html"}).optional(),
    hash: z.union([z.boolean(), z.string()]).optional(),
    usePublicPath: z.boolean().optional(),
    addPublicPath: z.never({invalid_type_error: "Configure addPublicPath in config.html"}).optional(),
    publicPath: z.union([z.boolean(), z.string()]).optional(),
});

const BaseTagSchema = CommonSchema.extend({
    glob: z.string().optional(),
    globPath: z.string().optional(),
    globFlatten: z.boolean().optional(),
    sourcePath: z.string().optional(),
});

const LinkSchema = BaseTagSchema.extend({
    path: z.string(),
    attributes: AttributesSchema.optional(),
    external: z.never({invalid_type_error: "external is only supported for scripts"}).optional(),
});

const ScriptSchema = LinkSchema.extend({
    external: z.object({packageName: z.string(), variableName: z.string()}).optional(),
});

const MetaSchema = BaseTagSchema.extend({
    path: z.string().optional(),
    attributes: AttributesSchema.refine(attributes => Object.keys(attributes).length > 0, {
        message: "A meta tag requires a nonempty attributes object",
    }),
    external: z.never({invalid_type_error: "external is only supported for scripts"}).optional(),
});

const TagSchema = ScriptSchema.extend({type: z.enum(["css", "js"]).optional()});
const LinkValueSchema = z.union([z.string(), LinkSchema]);
const ScriptValueSchema = z.union([z.string(), ScriptSchema]);
const TagValueSchema = z.union([z.string(), TagSchema]);

export const HtmlEntrypointOptionsSchema = CommonSchema.extend({
    prependExternals: z.boolean().optional(),
    jsExtensions: z.union([z.string(), z.array(z.string())]).optional(),
    cssExtensions: z.union([z.string(), z.array(z.string())]).optional(),
    files: z
        .never({invalid_type_error: "The entrypoint selects its HTML file; configure files in config.html"})
        .optional(),
    links: z.union([LinkValueSchema, z.array(LinkValueSchema)]).optional(),
    scripts: z.union([ScriptValueSchema, z.array(ScriptValueSchema)]).optional(),
    tags: z.union([TagValueSchema, z.array(TagValueSchema)]).optional(),
    metas: z
        .union([MetaSchema, z.array(MetaSchema)], {
            errorMap: () => ({
                message: "Expected a meta object with nonempty attributes, or an array of such objects",
            }),
        })
        .optional(),
});

export const HtmlEntrypointOptionKeys = Object.keys(HtmlEntrypointOptionsSchema.shape);
