import {build} from "esbuild";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "fs/promises";
import path from "path";

import {waitFor} from "../utils/browser";
import {startBrowserSession} from "../utils/session";
import {startIntegrationSite} from "../utils/site";

interface CssFontsProbeState {
    probe: string;
    mode: "shadow" | "iframe";
    ready: string;
    measurements?: string;
    error?: string;
}

export const runCssFontsProbe = async (browser: "chrome" | "firefox", manifestVersion: 2 | 3) => {
    const root = path.resolve(__dirname, "../../../..");
    const fixture = path.join(__dirname, "css-fonts");
    const cache = path.join(root, ".cache/integration");
    await mkdir(cache, {recursive: true});
    const extension = await mkdtemp(path.join(cache, "css-fonts-"));
    let session: Awaited<ReturnType<typeof startBrowserSession>> | undefined;
    const measurements: unknown[] = [];
    let failure: unknown;
    try {
        await build({
            entryPoints: {
                probe: path.join(fixture, "src/probe.ts"),
                "styles/isolated": path.join(fixture, "src/isolated.css"),
            },
            outdir: extension,
            bundle: true,
            format: "iife",
            platform: "browser",
            assetNames: "assets/[name]-[hash]",
            loader: {".woff2": "file"},
        });
        await build({
            entryPoints: {"styles/page": path.join(fixture, "src/page.css")},
            outdir: extension,
            bundle: true,
            assetNames: "assets/[name]-[hash]",
            loader: {".woff2": "file"},
            // Chrome resolves manifest CSS URLs against the host page. Its native CSS
            // localization supplies the installed extension ID, without a runtime bridge.
            publicPath: browser === "chrome" ? "chrome-extension://__MSG_@@extension_id__/" : undefined,
        });
        const source = await readFile(path.join(extension, "probe.js"), "utf8");
        expect(source).not.toMatch(/new FontFace\s*\(|\.fonts\.(add|load)\s*\(/);
        const resources = ["styles/*.css", "assets/*.woff2"];
        await writeFile(
            path.join(extension, "manifest.json"),
            JSON.stringify({
                manifest_version: manifestVersion,
                name: "CSS fonts without runtime registration",
                version: "1.0.0",
                ...(browser === "firefox" ? {browser_specific_settings: {gecko: {id: "css-fonts@adnbn.test"}}} : {}),
                content_scripts: [
                    {
                        matches: ["http://127.0.0.1/*"],
                        js: ["probe.js"],
                        css: ["styles/page.css"],
                        run_at: "document_end",
                    },
                ],
                web_accessible_resources:
                    manifestVersion === 2 ? resources : [{resources, matches: ["http://127.0.0.1/*"]}],
            })
        );
        session = await startBrowserSession(browser, root, extension);
        for (const policy of [
            null,
            "default-src 'none'; style-src 'none'; style-src-elem 'none'; font-src 'none'; frame-src 'self'",
        ]) {
            const site = await startIntegrationSite(path.join(fixture, "site"), policy);
            let state: CssFontsProbeState[] = [];
            try {
                await session.navigate(site.origin + "/top.html");
                await waitFor(async () => {
                    state = await session!.evaluate(
                        "Array.from(document.querySelectorAll('[data-probe]'), host => ({...host.dataset}))"
                    );
                    return state.length === 4 && state.every(probe => probe.ready !== "loading") ? state : undefined;
                }, 30_000);
                const result = state.map(probe => ({
                    ...probe,
                    measurements: probe.measurements ? JSON.parse(probe.measurements) : undefined,
                }));
                const page = await session.evaluate(`({
                    color: getComputedStyle(document.querySelector('#page-marker')).color,
                    outsideColor: getComputedStyle(document.querySelector('body > .scope-marker')).color,
                    fonts: Array.from(document.fonts, font => ({family: font.family, status: font.status}))
                })`);
                measurements.push({policy, result, page});
                const failed = result.filter(probe => probe.ready !== "true");
                if (failed.length) throw new Error(`CSS font probe failed: ${JSON.stringify(failed)}`);
                expect(page.color).toBe("rgb(34, 102, 68)");
                expect(page.outsideColor).not.toBe("rgb(17, 85, 153)");
                for (const probe of result.filter(probe => probe.mode === "iframe")) {
                    const {widths} = probe.measurements;
                    // A parent's font registration does not cross an iframe's document boundary.
                    expect(widths.manifest).toBeCloseTo(widths.fallback, 1);
                    expect(widths.imported).toBeCloseTo(widths.fallback, 1);
                    expect(widths.local).toBeCloseTo(320, 1);
                }
            } catch (error) {
                failure ??= error;
                // Preserve both CSP measurements even when one policy fails.
                if (state.length !== 4) measurements.push({policy, state, error: String(error)});
            } finally {
                await site.close();
            }
        }
        expect(session.errors).toEqual([]);
        if (failure) throw failure;
    } finally {
        try {
            await writeFile(
                path.join(cache, `css-fonts-${browser}-mv${manifestVersion}.json`),
                JSON.stringify(
                    {
                        browser: session?.version,
                        manifestVersion,
                        measurements,
                        failure: failure ? String(failure) : undefined,
                        errors: session?.errors,
                    },
                    null,
                    2
                )
            );
        } finally {
            try {
                await session?.close();
            } finally {
                await rm(extension, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
            }
        }
    }
};
