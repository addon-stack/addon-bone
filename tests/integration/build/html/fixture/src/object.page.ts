import {definePage} from "adnbn";

export default definePage({
    title: "Object metadata",
    metas: {attributes: {name: "entry-object", content: "object"}},
    links: [
        "string.css",
        {
            path: "styles",
            glob: "*.css",
            globPath: "assets",
            sourcePath: "assets/style.css",
            attributes: {media: "screen"},
        },
    ],
    scripts: [
        "string.js",
        {
            path: "local.js",
            sourcePath: "assets/local.js",
            attributes: {defer: true},
        },
        {
            path: "vendor.js",
            external: {packageName: "html-test-external", variableName: "HtmlTestExternal"},
        },
    ],
    tags: ["tag.css", "tag.js", {path: "custom.module", type: "js"}],
    publicPath: "/",
    hash: "static",
    render: () => "Object page",
});
