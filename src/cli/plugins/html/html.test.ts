import {HtmlRspackPlugin} from "@rspack/core";

import htmlPlugin from "./index";

import type {ReadonlyConfig} from "@typing/config";

const configure = (html: unknown, withHtml = true) => {
    const bundler = htmlPlugin().bundler;

    if (typeof bundler !== "function") {
        throw new Error("Expected an HTML bundler handler");
    }

    return bundler({
        config: {html} as ReadonlyConfig,
        rspack: {plugins: withHtml ? [new HtmlRspackPlugin()] : []},
    });
};

const valid = {metas: {attributes: {name: "test", content: "ok"}}};

test.each([valid, [valid], () => valid, () => [valid]].map(html => ({html})))(
    "accepts every html configuration form",
    async ({html}) => {
        expect(await configure(html)).toMatchObject({plugins: [expect.anything()]});
    }
);

test("evaluates the html factory once", () => {
    let calls = 0;

    configure(() => {
        calls += 1;

        return valid;
    });

    expect(calls).toBe(1);
});

test("passes HTML callbacks to the package without executing them during configuration", () => {
    let calls = 0;
    const handler = (asset: string, suffix: string): string => {
        calls += 1;

        return `${asset}${suffix}`;
    };

    configure({
        ...valid,
        files: ["settings.html"],
        hash: handler,
        addPublicPath: handler,
        usePublicPath: true,
        links: {path: "style.css", publicPath: handler},
        scripts: {path: "script.js", useHash: true, addHash: handler},
        metas: {...valid.metas, hash: handler},
        tags: {path: "extra.js", addPublicPath: handler},
    });

    expect(calls).toBe(0);
});

test("does not evaluate html when there are no HTML outputs", async () => {
    expect(
        await configure(() => {
            throw new Error("This factory must not run");
        }, false)
    ).toEqual({});
});

test("adds no plugins when html is omitted", async () => {
    expect(await configure(undefined)).toEqual({});
});
