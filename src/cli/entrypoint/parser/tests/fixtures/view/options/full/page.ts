import {definePage} from "adnbn";

export default definePage({
    as: "panel",
    title: "HTML options",
    template: "./template.html",
    append: false,
    useHash: true,
    usePublicPath: false,
    prependExternals: false,
    jsExtensions: [".js", ".module"],
    cssExtensions: ".css",
    links: ["theme.css", {path: "icon.ico", sourcePath: "icon.ico", attributes: {rel: "icon"}}],
    scripts: ["script.js", {path: "vendor.js", external: {packageName: "vendor", variableName: "Vendor"}}],
    tags: ["extra.css", {path: "extra.module", type: "js"}],
    metas: {
        attributes: {name: "description", content: "test", hidden: false, priority: 1},
        path: "meta.png",
        glob: "*.png",
        globPath: "images",
        globFlatten: true,
    },
    render: () => "View",
});
