import {readFile, writeFile} from "fs/promises";
import path from "path";
import {createIntegrationFixture} from "../../utils/fixture";
import {startBrowserSession} from "../utils/session";
import {startIntegrationSite} from "../utils/site";
import {waitFor} from "../utils/browser";

export const runFramePagesIntegration = async (browser: "chrome" | "firefox", manifestVersion: 2 | 3) => {
    const root = path.resolve(__dirname, "../../../..");
    const fixture = await createIntegrationFixture(root, path.join(__dirname, "frame-pages"));
    const site = await startIntegrationSite(path.join(fixture.directory, "site"), null);
    let session: Awaited<ReturnType<typeof startBrowserSession>> | undefined;
    try {
        const source = path.join(fixture.directory, "src/source.content.ts");
        await writeFile(source, (await readFile(source, "utf8")).replace("http://127.0.0.1:1", site.origin));
        const extension = await fixture.build({browser, manifestVersion});
        const manifest = JSON.parse(await readFile(path.join(extension, "manifest.json"), "utf8"));
        expect(manifest.content_scripts).toHaveLength(2);
        const scripts = manifest.content_scripts.flatMap((entry: {js: string[]}) => entry.js);
        const code = (
            await Promise.all(scripts.map((file: string) => readFile(path.join(extension, file), "utf8")))
        ).join("\n");
        expect(code).not.toContain("react-dom");
        session = await startBrowserSession(browser, root, extension);
        await session.navigate(site.origin + "/top.html");
        const state = await waitFor(async () => {
            const result = await session!.evaluate(
                `Array.from(document.querySelectorAll('.page-host iframe, .source-host iframe'), frame => ({kind: frame.parentElement.className, src: frame.src, ready: frame.dataset.ready, height: frame.style.height}))`
            );
            return result.length === 2 && result.every((frame: {ready?: string}) => frame.ready === "true")
                ? result
                : undefined;
        });
        const pageState = state.find((frame: {kind: string}) => frame.kind === "page-host");
        const sourceState = state.find((frame: {kind: string}) => frame.kind === "source-host");
        expect(pageState.src).toMatch(/^(chrome|moz)-extension:\/\//);
        expect(pageState.height).toBe("250px");
        expect(sourceState.src).toBe(site.origin + "/page.html");
        expect(session.errors).toEqual([]);
        // Real framework build: a valid alias alone must not bypass WAR coverage.
        const page = path.join(fixture.directory, "src/panel.page/index.ts");
        await writeFile(
            page,
            (await readFile(page, "utf8")).replace("http://127.0.0.1/*", "https://unrelated.example/*")
        );
        if (manifestVersion === 3) {
            await expect(fixture.build({browser, manifestVersion})).rejects.toThrow(/add matches to the page/);

            // User-supplied WAR participates in late validation; a missing page.matches rule is not final.
            const config = path.join(fixture.directory, "adnbn.config.ts");
            const resources = manifest.web_accessible_resources.flatMap((rule: {resources: string[]}) =>
                rule.resources.filter(file => file.endsWith(".html"))
            );
            const customManifest = {
                web_accessible_resources: [{resources, matches: ["http://127.0.0.1/*"]}],
            };
            await writeFile(
                config,
                (await readFile(config, "utf8")).replace(
                    'version: "1.0.0",',
                    `version: "1.0.0", manifest: ${JSON.stringify(customManifest)},`
                )
            );
            await fixture.build({browser, manifestVersion});
            const restored = JSON.parse(await readFile(path.join(extension, "manifest.json"), "utf8"));
            expect(restored.web_accessible_resources).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        resources: expect.arrayContaining(resources),
                        matches: expect.arrayContaining(["http://127.0.0.1/*", "https://unrelated.example/*"]),
                    }),
                ])
            );
        }
    } finally {
        await session?.close();
        await site.close();
        await fixture.dispose();
    }
};
