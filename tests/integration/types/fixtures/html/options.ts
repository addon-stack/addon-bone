import {defineConfig, definePage} from "adnbn";
import type {HtmlEntrypointOptions, HtmlMetaTagOptions, HtmlOptions, ViewOptions} from "adnbn";

const meta = {attributes: {charset: "utf-8"}} satisfies HtmlMetaTagOptions;
const handler = (asset: string, suffix: string): string => `${asset}${suffix}`;
const options: HtmlEntrypointOptions = {
    metas: [meta],
    links: ["extra.css", {path: "style.css", sourcePath: "style.css", hash: "v1"}],
    scripts: ["extra.js", {path: "vendor.js", external: {packageName: "vendor", variableName: "Vendor"}}],
    tags: ["tag.js", {path: "custom", type: "css"}],
    publicPath: "/",
};

definePage({...options, render: async () => "Page"});
definePage({metas: meta});
definePage({metas: [meta]});

const full: HtmlOptions = {
    files: ["settings.html"],
    hash: handler,
    addPublicPath: handler,
    usePublicPath: true,
    metas: {...meta, publicPath: handler},
    links: {path: "style.css", addHash: handler},
    scripts: {path: "script.js", addPublicPath: handler},
    tags: {path: "tag.js", hash: handler},
};

defineConfig({html: full});
defineConfig({html: [full]});
defineConfig({html: () => full});
defineConfig({html: () => [full]});
defineConfig(() => ({html: () => [full]}));

// @ts-expect-error: Only meta objects are accepted.
definePage({metas: "utf-8"});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: {metas: "utf-8"}});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: [{metas: "utf-8"}]});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: () => ({metas: "utf-8"})});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: () => [{metas: "utf-8"}]});
// @ts-expect-error: Only meta objects are accepted.
definePage({metas: ["utf-8"]});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: {metas: ["utf-8"]}});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: [{metas: ["utf-8"]}]});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: () => ({metas: ["utf-8"]})});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: () => [{metas: ["utf-8"]}]});
// @ts-expect-error: Only meta objects are accepted.
definePage({metas: [meta, "utf-8"]});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: {metas: [meta, "utf-8"]}});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: [{metas: [meta, "utf-8"]}]});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: () => ({metas: [meta, "utf-8"]})});
// @ts-expect-error: Every global configuration form has the same meta contract.
defineConfig({html: () => [{metas: [meta, "utf-8"]}]});

// @ts-expect-error: HTML functions belong to config.html.
definePage({hash: handler});
// @ts-expect-error: Nested HTML options must also be static.
definePage({links: [{path: "asset.js", hash: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({scripts: [{path: "asset.js", hash: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({tags: [{path: "asset.js", hash: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({metas: [{...meta, hash: handler}]});

// @ts-expect-error: HTML functions belong to config.html.
definePage({publicPath: handler});
// @ts-expect-error: Nested HTML options must also be static.
definePage({links: [{path: "asset.js", publicPath: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({scripts: [{path: "asset.js", publicPath: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({tags: [{path: "asset.js", publicPath: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({metas: [{...meta, publicPath: handler}]});

// @ts-expect-error: HTML functions belong to config.html.
definePage({addHash: handler});
// @ts-expect-error: Nested HTML options must also be static.
definePage({links: [{path: "asset.js", addHash: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({scripts: [{path: "asset.js", addHash: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({tags: [{path: "asset.js", addHash: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({metas: [{...meta, addHash: handler}]});

// @ts-expect-error: HTML functions belong to config.html.
definePage({addPublicPath: handler});
// @ts-expect-error: Nested HTML options must also be static.
definePage({links: [{path: "asset.js", addPublicPath: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({scripts: [{path: "asset.js", addPublicPath: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({tags: [{path: "asset.js", addPublicPath: handler}]});
// @ts-expect-error: Nested HTML options must also be static.
definePage({metas: [{...meta, addPublicPath: handler}]});

// @ts-expect-error: Missing attributes.
const invalidMeta: HtmlMetaTagOptions = {};

// @ts-expect-error: The entrypoint chooses its own output file.
definePage({files: ["other.html"]});

// @ts-expect-error: Typed variables must not smuggle callbacks into entrypoints.
const staticOptions: HtmlEntrypointOptions = full;

// @ts-expect-error: ViewOptions adopts the static contract too.
const viewOptions: ViewOptions = {metas: {...meta, hash: handler}};
