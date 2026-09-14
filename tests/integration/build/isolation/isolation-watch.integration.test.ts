import {spawn, type ChildProcess} from "child_process";
import {copyFile, readFile, rm, writeFile} from "fs/promises";
import path from "path";
import vm from "vm";
import {createIntegrationFixture} from "../../utils/fixture";
import {waitFor, stop} from "../../browser/utils/browser";

jest.setTimeout(90_000);

test("real CLI watch changes isolation and page aliases and removes outdated WAR matches", async () => {
    const root = path.resolve(__dirname, "../../../..");
    const fixture = await createIntegrationFixture(
        root,
        path.join(root, "tests/integration/browser/content/frame-pages")
    );
    let watcher: ChildProcess | undefined;
    let output = "";
    try {
        await copyFile(path.join(__dirname, "states/background.ts"), path.join(fixture.directory, "src/background.ts"));
        await rm(path.join(fixture.directory, "src/source.content.ts"));
        await copyFile(
            path.join(root, "tests/integration/browser/content/isolation-shadow/src/probe.content/probe.woff2"),
            path.join(fixture.directory, "src/probe.woff2")
        );
        await writeFile(path.join(fixture.directory, "src/watch.css"), ".watch-ui { color: red; }\n");
        await copyFile(path.join(__dirname, "states/fonts.css"), path.join(fixture.directory, "src/watch-fonts.css"));
        const entry = path.join(fixture.directory, "src/page.content.ts");
        // Save like an editor: Windows copyFile preserves the fixture's old mtime, so watch can miss the edit.
        const setState = async (state: string) =>
            writeFile(entry, await readFile(path.join(__dirname, "states", state + ".ts")));
        await setState("page-isolated");
        await expect(fixture.build({browser: "chrome"})).rejects.toThrow(
            "uses ?isolation CSS with isolation.page/isolation.src, but has no local render target"
        );
        await setState("none");
        const directory = await fixture.build({browser: "chrome"});
        const readPages = async () => {
            const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
            const source = await readFile(path.join(directory, manifest.background.service_worker), "utf8");
            const sandbox = {readPages: undefined as undefined | (() => unknown)};
            vm.runInNewContext(source, sandbox);
            return sandbox.readPages!();
        };
        expect(await readPages()).toEqual({panel: "panel.html"});
        await rm(path.join(directory, "manifest.json"));
        watcher = spawn(process.execPath, [path.join(root, "bin/adnbn.js"), "watch", ".", "-b", "chrome"], {
            cwd: fixture.directory,
            stdio: ["ignore", "pipe", "pipe"],
        });
        watcher.stdout?.on("data", chunk => {
            output += chunk;
        });
        watcher.stderr?.on("data", chunk => {
            output += chunk;
        });
        const observe = (state: string) =>
            waitFor(
                async () => {
                    const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
                    const script = manifest.content_scripts.find((script: {js: string[]}) =>
                        script.js.some(file => /page\.content/.test(file))
                    );
                    if (!script) return undefined;
                    const source = (
                        await Promise.all(script.js.map((file: string) => readFile(path.join(directory, file), "utf8")))
                    ).join("\n");
                    if (!source.includes(JSON.stringify("isolation-watch-" + state))) return undefined;
                    return {manifest, script, source};
                },
                15000,
                `CLI watch state "${state}"`
            );
        for (const state of [
            "none",
            "shadow",
            "shadow-closed",
            "shadow-document",
            "shadow",
            "iframe",
            "fonts",
            "iframe",
            "page",
            "source",
            "none",
        ]) {
            const beforeBuild = output.length;
            if (state !== "none" || output) await setState(state);
            const {manifest, script, source} = await observe(state);
            if (state === "shadow-document") {
                await waitFor(
                    async () => output.slice(beforeBuild).includes("[adnbn:missing-isolation-css]") || undefined,
                    15000,
                    "CLI watch missing-isolation-css warning"
                );
            }
            const isolated = ["shadow", "shadow-closed", "shadow-document", "iframe", "fonts"].includes(state);
            expect(!!script.css?.length).toBe(!isolated || state === "shadow-document");
            expect(
                /__webpack_require__(?:\.__adnbnIsolatedStyles|\["__adnbnIsolatedStyles"\])\s*=\s*\{/.test(source)
            ).toBe(isolated);
            expect(script.js.some((file: string) => /background/.test(file))).toBe(false);
            const resources = manifest.web_accessible_resources.flatMap(
                (rule: {resources: string[]}) => rule.resources
            );
            expect(resources.some((file: string) => file.endsWith(".woff2"))).toBe(state === "fonts");
        }
        // Start broad, then narrow: the old WAR rule must disappear, not accumulate in the builder.
        const page = path.join(fixture.directory, "src/panel.page/index.ts");
        const pageSource = await readFile(page, "utf8");
        await writeFile(
            page,
            pageSource.replace('name: "panel"', 'name: "renamed-panel"').replace("http://127.0.0.1/*", "http://*/*")
        );
        await setState("renamed");
        const renamed = await observe("renamed");
        expect(renamed.source).toContain("renamed-panel");
        await waitFor(
            async () => {
                const pages = await readPages();
                expect(pages).toEqual({"renamed-panel": "panel.html"});
                return pages;
            },
            15000,
            "CLI watch to refresh page data without editing its background consumer"
        );
        const compiled = output;
        await writeFile(page, pageSource.replace('name: "panel"', 'name: "renamed-panel"'));
        await waitFor(
            async () => {
                if (output === compiled) return undefined;
                const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
                const pageRules = manifest.web_accessible_resources.filter((rule: {resources: string[]}) =>
                    rule.resources.some(file => file.endsWith(".html"))
                );
                return pageRules.length &&
                    pageRules.every((rule: {matches: string[]}) => !rule.matches.includes("http://*/*"))
                    ? true
                    : undefined;
            },
            15000,
            "CLI watch to remove outdated WAR matches"
        );

        // Validation is late, but an invalid build must not replace the last valid manifest or stop watch.
        const validManifest = await readFile(path.join(directory, "manifest.json"), "utf8");
        const beforeFailure = output.length;
        await writeFile(
            page,
            pageSource
                .replace('name: "panel"', 'name: "renamed-panel"')
                .replace("http://127.0.0.1/*", "https://unrelated.example/*")
        );
        await waitFor(
            async () => output.slice(beforeFailure).includes("add matches to the page") || undefined,
            15000,
            "CLI watch page access validation error"
        );
        expect(await readFile(path.join(directory, "manifest.json"), "utf8")).toBe(validManifest);
        await writeFile(
            page,
            pageSource
                .replace('name: "panel"', 'name: "renamed-panel"')
                .replace("http://127.0.0.1/*", "*://127.0.0.1/*")
        );
        await waitFor(
            async () => {
                const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
                return manifest.web_accessible_resources.some(
                    (rule: {resources: string[]; matches: string[]}) =>
                        rule.resources.some(file => file.endsWith(".html")) && rule.matches.includes("*://127.0.0.1/*")
                )
                    ? true
                    : undefined;
            },
            15000,
            "CLI watch to restore valid page access"
        );
    } catch (error) {
        throw new Error(`${String(error)}\n${output}`, {cause: error});
    } finally {
        if (watcher) await stop(watcher);
        await fixture.dispose();
    }
});
