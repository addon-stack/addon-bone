import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from "fs/promises";
import path from "path";

import {
    closeCompiler,
    createCompiler,
    orders,
    project,
    runCompiler,
} from "../../build/style-routing/selective-split/compiler";
import {waitFor} from "../utils/browser";
import {startBrowserSession} from "../utils/session";
import {startIntegrationSite} from "../utils/site";

interface SelectiveSplitProbe {
    name: string;
    state?: string;
    error?: string;
    completion?: {order: string; color: string; border: string};
    color: string;
    border: string;
    links: string[];
}

const stateExpression = `['normal', 'shadow'].map(name => {
    const host = document.querySelector('#selective-' + name);

    if (!host) {
        return {name};
    }

    const root = host.shadowRoot || host;
    const style = getComputedStyle(root.querySelector('.cascade-probe'));

    return {
        name,
        state: host.dataset.state,
        error: host.dataset.error,
        completion: host.dataset.completion ? JSON.parse(host.dataset.completion) : undefined,
        color: style.color,
        border: style.borderTopWidth,
        links: Array.from(root.querySelectorAll('link'), link => new URL(link.href).pathname.slice(1))
    };
})`;

export const runSelectiveSplitProbe = async (browser: "chrome" | "firefox", manifestVersion: 2 | 3) => {
    const cache = path.join(project, ".cache/integration");
    await mkdir(cache, {recursive: true});
    const extension = await mkdtemp(path.join(cache, "selective-split-"));
    let session: Awaited<ReturnType<typeof startBrowserSession>> | undefined;
    const measurements: unknown[] = [];
    let state: SelectiveSplitProbe[] = [];

    try {
        const compiler = await createCompiler(extension, true, {initial: true});
        const stats = await runCompiler(compiler).finally(() => closeCompiler(compiler));
        const scripts = ["normal", "shadow"].flatMap(entry =>
            stats.compilation.entrypoints
                .get(entry)!
                .getFiles()
                .filter(file => file.endsWith(".js"))
        );

        const initialScripts = orders.map(order => ({
            matches: [`http://127.0.0.1/${order}.html`],
            css: stats.compilation.entrypoints
                .get(`content-${order}`)!
                .getFiles()
                .filter(file => file.endsWith(".css")),
            run_at: "document_start",
        }));
        const resources = stats.compilation.getAssets().map(asset => asset.name);

        await writeFile(
            path.join(extension, "manifest.json"),
            JSON.stringify({
                manifest_version: manifestVersion,
                name: "Selective CSS split probe",
                version: "1.0.0",
                ...(browser === "firefox"
                    ? {browser_specific_settings: {gecko: {id: "selective-split@adnbn.test"}}}
                    : {}),
                content_scripts: [
                    {matches: ["http://127.0.0.1/top.html*"], js: scripts, run_at: "document_end"},
                    ...initialScripts,
                ],
                web_accessible_resources:
                    manifestVersion === 2 ? resources : [{resources, matches: ["http://127.0.0.1/*"]}],
            })
        );

        session = await startBrowserSession(browser, project, extension);
        const sourceSite = path.join(__dirname, "../../build/style-routing/selective-split/site");
        const siteDirectory = path.join(extension, "site");
        await mkdir(siteDirectory);
        await copyFile(path.join(sourceSite, "top.html"), path.join(siteDirectory, "top.html"));

        for (const order of orders) {
            await copyFile(path.join(sourceSite, "initial.html"), path.join(siteDirectory, `${order}.html`));
        }

        const site = await startIntegrationSite(siteDirectory, null);

        try {
            for (const order of orders) {
                for (const first of ["normal", "shadow"] as const) {
                    await session.navigate(`${site.origin}/top.html?order=${order}`);
                    await waitFor(async () => {
                        const buttons = await session!.evaluate("document.querySelectorAll('button').length");

                        return buttons === 2 ? true : undefined;
                    }, 10_000);

                    expect(await session.evaluate("document.querySelectorAll('link').length")).toBe(0);
                    expect(
                        await session.evaluate(
                            "document.querySelector('#selective-shadow').shadowRoot.querySelectorAll('link').length"
                        )
                    ).toBe(0);

                    for (const name of [first, first === "normal" ? "shadow" : "normal"]) {
                        await session.evaluate(`document.querySelector('#load-${name}').click()`);
                        const loaded = await waitFor(async () => {
                            state = await session!.evaluate(stateExpression);
                            const probe = state.find(probe => probe.name === name)!;

                            if (probe.state === "error") {
                                throw new Error(probe.error);
                            }

                            return probe.state === "loaded" ? probe : undefined;
                        }, 10_000);

                        // Recorded inside the import continuation: the Promise must wait for applied CSS.
                        expect(loaded.completion).toEqual({
                            order,
                            color: "rgb(0, 0, 204)",
                            border: name === "normal" ? "7px" : "0px",
                        });
                    }

                    state = await session.evaluate(stateExpression);
                    const documentLinks: string[] = await session.evaluate(
                        "Array.from(document.head.querySelectorAll('link'), link => new URL(link.href).pathname.slice(1))"
                    );

                    const documentCss = await Promise.all(
                        documentLinks.map(file => readFile(path.join(extension, file), "utf8"))
                    );

                    expect(documentCss).toHaveLength(2);
                    expect(documentCss[0]).toContain("--split-document:");
                    expect(documentCss[0]).not.toContain("--split-ui:");
                    expect(documentCss[1]).toContain("--split-ui:");
                    expect(documentCss[1]).not.toContain("--split-document:");
                    const shadow = state.find(probe => probe.name === "shadow")!;
                    expect(shadow.links).toEqual([documentLinks[1]]);
                    expect(state.map(probe => ({name: probe.name, color: probe.color, border: probe.border}))).toEqual([
                        {name: "normal", color: "rgb(0, 0, 204)", border: "7px"},
                        {name: "shadow", color: "rgb(0, 0, 204)", border: "0px"},
                    ]);

                    measurements.push({order, first, state, documentLinks});
                }
            }

            for (const order of orders) {
                await session.navigate(`${site.origin}/${order}.html`);
                const color = order === "document-first" ? "rgb(0, 0, 204)" : "rgb(204, 0, 0)";
                const initial = await waitFor(
                    async () => {
                        const result = await session!.evaluate(`(() => {
                        const probe = document.querySelector('.cascade-probe');

                        if (!probe) {
                            return;
                        }

                        const style = getComputedStyle(probe);

                        return {color: style.color, border: style.borderTopWidth};
                    })()`);

                        return result?.color === color ? result : undefined;
                    },
                    10_000,
                    `initial content CSS cascade for ${order}`
                );
                expect(initial).toEqual({color, border: "7px"});
                measurements.push({initial: order, ...initial});
            }

            expect(session.errors).toEqual([]);
        } finally {
            await site.close();
        }
    } catch (error) {
        throw new Error(
            `${String(error)}; last state: ${JSON.stringify(state)}; browser errors: ${JSON.stringify(session?.errors)}`,
            {cause: error}
        );
    } finally {
        try {
            await writeFile(
                path.join(cache, `selective-split-${browser}-mv${manifestVersion}.json`),
                JSON.stringify(
                    {
                        browser: session?.version,
                        manifestVersion,
                        measurements,
                        lastState: state,
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
