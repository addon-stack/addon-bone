/** @jest-environment node */
import {copyFile, readFile} from "fs/promises";
import path from "path";
import vm from "vm";

import {createIntegrationFixture} from "../../utils/fixture";

jest.setTimeout(60_000);

test("generated entrypoint data reach public getters and disappear without consumers", async () => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, path.join(__dirname, "fixture"));

    try {
        const directory = await fixture.build();
        const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
        const background = path.join(directory, manifest.background.service_worker);
        const source = await readFile(background, "utf8");
        const runtime = {readData: undefined as undefined | (() => unknown)};
        vm.runInNewContext(source, runtime);
        expect(runtime.readData!()).toEqual({
            popup: {popup: {path: "popup.html", title: "Popup data", icon: "dataicons"}},
            sidebar: {sidebar: {path: "sidebar.html", title: "Sidebar data"}},
            offscreen: {
                dataOffscreen: {url: "offscreen.html", reasons: ["DOM_PARSER"], justification: "Offscreen data"},
            },
            sandbox: {
                dataSandbox: {
                    url: "sandbox.html",
                    readyTimeout: 1234,
                    requestTimeout: 5678,
                    removeOnRequestTimeout: false,
                },
            },
            icon: {dataicons: {16: "/icons/dataicons-16.png"}},
        });
        expect(await readFile(path.join(directory, "icons/dataicons-16.png"))).toEqual(
            await readFile(path.join(fixture.directory, "src/icons/dataicons16.png"))
        );

        await copyFile(
            path.join(__dirname, "states/unused-background.ts"),
            path.join(fixture.directory, "src/background.ts")
        );
        await fixture.build();
        const unusedSource = await readFile(background, "utf8");
        for (const marker of ["Popup data", "Sidebar data", "dataOffscreen", "dataSandbox", "dataicons"]) {
            expect(unusedSource).not.toContain(marker);
        }
        const unusedRuntime = {definitions: undefined as unknown};
        vm.runInNewContext(unusedSource, unusedRuntime);
        expect(unusedRuntime.definitions).toHaveLength(4);
    } finally {
        await fixture.dispose();
    }
});
