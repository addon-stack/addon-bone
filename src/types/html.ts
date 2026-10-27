import type {
    AddHashFunction,
    AddPublicPathFunction,
    HtmlTagsPluginOptions,
    MetaTagOptions,
} from "@rspackjs/plugin-html-tags";

export type HtmlHashHandler = AddHashFunction;
export type HtmlPublicPathHandler = AddPublicPathFunction;
export type HtmlMetaTagOptions = MetaTagOptions;

/** HTML tag options evaluated in the build configuration. */
export type HtmlOptions = Omit<HtmlTagsPluginOptions, "metas"> & {
    /** A meta tag needs a nonempty attributes object; string paths are not supported. */
    metas?: HtmlMetaTagOptions | HtmlMetaTagOptions[];
};

type HtmlStaticOptions<T> = T extends (...args: never[]) => unknown
    ? never
    : T extends (infer Item)[]
      ? HtmlStaticOptions<Item>[]
      : T extends object
        ? {[Key in keyof T]: HtmlStaticOptions<T[Key]>}
        : T;

/** Statically read HTML options. The framework selects the entrypoint's output file. */
export type HtmlEntrypointOptions = HtmlStaticOptions<Omit<HtmlOptions, "files">> & {
    files?: never;
};
