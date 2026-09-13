import {build} from "esbuild";
import {cp, mkdir, mkdtemp, rm, writeFile} from "fs/promises";
import path from "path";

import {waitFor} from "../utils/browser";
import {startBrowserSession} from "../utils/session";
import {startIntegrationSite} from "../utils/site";

const State = `Array.from(document.querySelectorAll('[data-probe]'), host => ({...host.dataset,
    links: Array.from(host.querySelector('iframe').contentDocument.querySelectorAll('link'), link => link.href)}))`;

export const runIsolationSpike = async (browser: "chrome" | "firefox", manifestVersion: 2 | 3) => {
    const root = path.resolve(__dirname, "../../../..");
    const fixture = path.join(__dirname, "isolation-spike");
    const cache = path.join(root, ".cache/integration");
    await mkdir(cache, {recursive: true});
    const extension = await mkdtemp(path.join(cache, "isolation-spike-"));
    let session: Awaited<ReturnType<typeof startBrowserSession>> | undefined;
    const measurements: unknown[] = [];
    let state: Array<Record<string, any>> = [];
    let embedState: unknown;
    try {
        await build({
            entryPoints: [path.join(fixture, "src/probe.tsx")],
            outfile: path.join(extension, "probe.js"),
            bundle: true,
            format: "iife",
            platform: "browser",
            define: {"process.env.NODE_ENV": '"production"'},
        });
        await build({
            entryPoints: [path.join(fixture, "src/embed.ts")],
            outfile: path.join(extension, "embed.js"),
            bundle: true,
            format: "iife",
            platform: "browser",
        });
        await cp(path.join(extension, "embed.js"), path.join(extension, "main.js"));
        for (const file of ["initial.css", "lazy.css", "panel.html", "panel.js"])
            await cp(path.join(fixture, "src", file), path.join(extension, file));
        await cp(
            path.join(__dirname, "isolation-shadow/src/probe.content/probe.woff2"),
            path.join(extension, "probe.woff2")
        );
        const resources = ["initial.css", "lazy.css", "probe.woff2", "panel.html"];
        await writeFile(
            path.join(extension, "manifest.json"),
            JSON.stringify({
                manifest_version: manifestVersion,
                name: "Iframe feasibility probe",
                version: "1.0.0",
                ...(browser === "firefox"
                    ? {browser_specific_settings: {gecko: {id: "isolation-spike@adnbn.test"}}}
                    : {}),
                content_scripts: [
                    {matches: ["http://127.0.0.1/top.html"], js: ["probe.js", "embed.js"], run_at: "document_end"},
                    ...(manifestVersion === 3
                        ? [
                              {
                                  matches: ["http://127.0.0.1/top.html"],
                                  js: ["main.js"],
                                  world: "MAIN",
                                  run_at: "document_end",
                              },
                          ]
                        : []),
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
            const site = await startIntegrationSite(path.join(fixture, "site"), policy, {
                "allowed.html": {"Content-Security-Policy": "script-src 'self'; frame-ancestors *"},
                "csp-blocked.html": {"Content-Security-Policy": "script-src 'self'; frame-ancestors 'none'"},
                "xfo-blocked.html": {"Content-Security-Policy": "script-src 'self'", "X-Frame-Options": "DENY"},
            });
            try {
                await session.navigate(site.origin + "/top.html");
                const ready = async (previous = 0) =>
                    waitFor(async () => {
                        state = await session!.evaluate(State);
                        if (state.some(probe => probe.ready === "error")) throw new Error(JSON.stringify(state));
                        return state.length === 2 &&
                            state.every(probe => probe.ready === "true" && Number(probe.generation) > previous)
                            ? state
                            : undefined;
                    }, 8000);
                // The probe moves both hosts synchronously while initial CSS is still pending.
                await ready(1);
                const initial = state;
                for (const operation of ["append", "insert", "reinsert"]) {
                    const previous = Math.max(...state.map(probe => Number(probe.generation)));
                    await session.evaluate(`(() => {
                        const destination = document.querySelector('#destination');
                        for (const host of document.querySelectorAll('[data-probe]')) {
                            if (${JSON.stringify(operation)} === 'reinsert') host.remove();
                            if (${JSON.stringify(operation)} === 'insert') destination.insertBefore(host, destination.firstChild);
                            else destination.appendChild(host);
                        }
                    })()`);
                    await ready(previous);
                }
                expect(state.every(probe => probe.links.length === 2)).toBe(true);
                expect(
                    await session.evaluate("getComputedStyle(document.querySelector('body > .probe')).color")
                ).not.toBe("rgb(17, 85, 153)");
                const embeds = await waitFor(async () => {
                    const probes = await session!.evaluate(
                        "Array.from(document.querySelectorAll('[data-embed-probe]'), element => ({...element.dataset}))"
                    );
                    embedState = probes;
                    const allowed = probes.filter((probe: Record<string, string>) =>
                        /-(allowed|page)$/.test(probe.embedProbe)
                    );
                    return allowed.length === (manifestVersion === 3 ? 3 : 2) &&
                        allowed.every((probe: Record<string, string>) => probe.loaded === "true")
                        ? probes
                        : undefined;
                }, 5000);
                expect(
                    embeds
                        .filter((probe: Record<string, string>) => /blocked$/.test(probe.embedProbe))
                        .every((probe: Record<string, string>) => probe.loaded !== "true")
                ).toBe(true);
                measurements.push({policy, initial, recovered: state, embeds});
            } finally {
                await site.close();
            }
        }
        expect(session.errors).toEqual([]);
    } catch (error) {
        throw new Error(
            `${String(error)}; last state: ${JSON.stringify(state)}; embed state: ${JSON.stringify(embedState)}; runtime errors: ${JSON.stringify(session?.errors)}`,
            {cause: error}
        );
    } finally {
        await writeFile(
            path.join(cache, `isolation-spike-${browser}-mv${manifestVersion}.json`),
            JSON.stringify(
                {
                    browser: session?.version,
                    manifestVersion,
                    measurements,
                    lastState: state,
                    embedState,
                    errors: session?.errors,
                },
                null,
                2
            )
        );
        await session?.close();
        await rm(extension, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
};
