import path from "node:path";
import {buildSync} from "esbuild";
import type {NodeScriptRuntime} from "@addon-core/browser/testing/node";
import {createTabFixture} from "@addon-core/browser/testing";
import {getBrowserTest} from "@tests/browser-harness/session";

const source = buildSync({
    entryPoints: [path.resolve(__dirname, "fixtures/runtime.ts")],
    tsconfig: path.resolve(__dirname, "../../../tsconfig.json"),
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2020",
}).outputFiles[0].text;

export function createRelayRuntime(register = true): NodeScriptRuntime {
    const session = getBrowserTest();

    session.harness.tabs.set([createTabFixture({id: 1})]);

    for (const frameId of [0, 2]) {
        session.harness.contexts.documents.create({
            documentId: `document-${frameId}`,
            tabId: 1,
            frameId,
            url: "https://example.com/",
        });
    }

    const runtime = session.createScriptRuntime({clock: true});

    for (const frameId of [0, 2]) {
        runtime.evaluate({documentId: `document-${frameId}`}, {source});

        if (register) {
            runtime.evaluate({documentId: `document-${frameId}`}, {source: "relayFixture.register();"});
        }
    }

    return runtime;
}
