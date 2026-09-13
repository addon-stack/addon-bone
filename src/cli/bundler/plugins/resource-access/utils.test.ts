import {validateResourceAccess} from "./utils";

const page = {
    issuer: "Panel client",
    resource: "pages/panel.html",
    matches: ["*://*.example.com/*"],
};

test("resource access requires full origin coverage, including the union of WAR rules", () => {
    expect(() =>
        validateResourceAccess([page], {
            manifest_version: 3,
            web_accessible_resources: [
                {resources: ["pages/*"], matches: ["http://*.example.com/*"]},
                {resources: ["pages/panel.html"], matches: ["https://*.example.com/*"]},
            ],
        })
    ).not.toThrow();
    expect(() =>
        validateResourceAccess([page], {
            manifest_version: 3,
            web_accessible_resources: [{resources: ["pages/*"], matches: ["https://example.com/*"]}],
        })
    ).toThrow(/Panel client.*pages\/panel.html.*web_accessible_resources/);
    expect(() =>
        validateResourceAccess([page], {manifest_version: 2, web_accessible_resources: ["pages/*"]})
    ).not.toThrow();
    expect(() => validateResourceAccess([page], {manifest_version: 2, web_accessible_resources: []})).toThrow(/panel/);
});

test("resource access uses origins rather than paths and leaves final WAR untouched", () => {
    const rule = Object.freeze({
        resources: Object.freeze(["/assets/*.bin"]),
        matches: Object.freeze(["https://*.example.com/only-this-path"]),
    });
    const manifest = Object.freeze({manifest_version: 3, web_accessible_resources: Object.freeze([rule])});
    expect(() =>
        validateResourceAccess(
            [{issuer: "Data client", resource: "assets/data.bin", matches: ["https://api.example.com/different-path"]}],
            manifest
        )
    ).not.toThrow();
    expect(() =>
        validateResourceAccess(
            [{issuer: "Data client", resource: "assets/data.bin", matches: ["https://otherexample.com/*"]}],
            manifest
        )
    ).toThrow(/Data client.*otherexample.com/);
});

test("a resource accessible only by extension id does not grant access to web origins", () => {
    expect(() =>
        validateResourceAccess([page], {
            manifest_version: 3,
            web_accessible_resources: [{resources: [page.resource], extension_ids: ["*"]}],
        })
    ).toThrow(/requested matches|example.com/);
});
