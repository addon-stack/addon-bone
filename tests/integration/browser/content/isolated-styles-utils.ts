import {readFile, stat, writeFile} from "fs/promises";
import path from "path";

import {waitFor} from "../utils/browser";
import {startBrowserSession, type BrowserSession} from "../utils/session";
import CdpClient from "../utils/CdpClient";
import BidiClient from "../utils/BidiClient";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";
import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";

interface ShadowProbe {
    readonly anchor?: string;
    readonly asyncCss?: string;
    readonly error?: string;
    readonly font?: string;
    readonly frame?: string;
    readonly initialCss?: string;
    readonly measured?: boolean;
    readonly mounts?: number;
    readonly instance?: string;
    readonly kind?: string;
    readonly mode?: string;
    readonly closed?: boolean;
    readonly links: string[];
    readonly ready?: string;
    readonly sharedCss?: string;
    readonly styledFirstRender?: string;
}

interface ShadowDocumentState {
    readonly normalBorder: string;
    readonly normalReady: boolean;
    readonly outsideColor: string;
    readonly pageUrl: string;
    readonly probes: ShadowProbe[];
}

interface FrameState {
    readonly child: ShadowDocumentState;
    readonly top: ShadowDocumentState;
}

const documentStateExpression = `(document => {
    const view = document.defaultView;
    const hosts = Array.from(document.querySelectorAll("[data-shadow-probe]"));
    const probes = hosts.map(host => {
        const reported = host.getAttribute("data-shadow-report");
        if (reported) return {
            ...JSON.parse(reported),
            kind: host.getAttribute("data-shadow-probe"),
            instance: host.getAttribute("data-instance"),
            closed: host.shadowRoot === null,
            styledFirstRender: host.getAttribute("data-styled-first-render"),
        };
        const root = host.shadowRoot ?? host.querySelector("iframe")?.contentDocument;
        const result = root && root.querySelector("[data-shadow-result]");
        const style = result && result.ownerDocument.defaultView.getComputedStyle(result);
        const primary = host.getAttribute("data-shadow-probe") === "primary";
        const sample = result?.querySelector("span");
        const range = sample && result.ownerDocument.createRange();
        if (range) range.selectNodeContents(sample);
        const measured = style && style.color === (primary ? "rgb(17, 85, 153)" : "rgb(119, 51, 34)") &&
            style.backgroundColor === (primary ? "rgb(34, 102, 68)" : "rgb(85, 51, 119)") &&
            style.borderTopWidth === "3px" && (!primary || (range && Math.abs(range.getBoundingClientRect().width - 320) < 0.1));
        return {
            measured: !!measured,
            mode: host.shadowRoot?.mode,
            mounts: Number(host.getAttribute("data-mounts")),
            ...(result ? Object.fromEntries(Object.entries(result.dataset)) : {ready: "missing"}),
            instance: host.getAttribute("data-instance") || undefined,
            kind: host.getAttribute("data-shadow-probe") || undefined,
            styledFirstRender: host.getAttribute("data-styled-first-render") || undefined,
            links: root ? Array.from(root.querySelectorAll('link[rel="stylesheet"]'), link => link.href) : [],
        };
    });
    const primary = hosts.find(host => host.getAttribute("data-shadow-probe") === "primary");
    const primaryResult = (primary?.shadowRoot ?? primary?.querySelector("iframe")?.contentDocument)?.querySelector("[data-shadow-result]");
    const outside = document.querySelector("#outside");
    if (outside && primaryResult && outside.className !== primaryResult.className) {
        outside.className = primaryResult.className;
    }
    const normal = document.querySelector("[data-normal-probe]");
    return {
        pageUrl: document.location.href,
        probes,
        normalReady: normal?.getAttribute("data-normal-probe") === "ready",
        normalBorder: normal ? view.getComputedStyle(normal).borderTopWidth : "missing",
        outsideColor: outside ? view.getComputedStyle(outside).color : "missing",
    };
})`;

const strictCsp =
    "default-src 'none'; style-src 'none'; style-src-elem 'none'; font-src 'none'; frame-src 'self'; img-src 'self'";

const isReady = (state: ShadowDocumentState | undefined, expected: number): state is ShadowDocumentState => {
    return (
        state !== undefined &&
        state.probes.length === expected &&
        state.probes.every(probe => probe.ready === "true" && probe.measured && !probe.error) &&
        state.normalReady
    );
};

const expectDocument = (
    state: ShadowDocumentState,
    frame: "top" | "child",
    primaryCount: number,
    sharedCss: readonly string[]
): void => {
    const primary = state.probes.filter(probe => probe.kind === "primary");
    const secondary = state.probes.filter(probe => probe.kind === "secondary");

    expect(primary).toHaveLength(primaryCount);
    expect(secondary).toHaveLength(1);
    expect(state.normalReady).toBe(true);
    expect(state.normalBorder).toBe("3px");
    expect(state.outsideColor).not.toBe("rgb(17, 85, 153)");

    for (const probe of state.probes) {
        expect(probe.frame).toBe(frame);
        expect(probe.initialCss).toBe("applied");
        expect(probe.asyncCss).toBe("applied");
        expect(probe.sharedCss).toBe("applied");
        expect(probe.styledFirstRender).toBe("true");
        expect(probe.links.length).toBeGreaterThanOrEqual(3);
        expect(probe.links.every(url => /^(chrome|moz)-extension:\/\//.test(url))).toBe(true);

        for (const file of sharedCss) {
            expect(probe.links.some(url => new URL(url).pathname === "/" + file)).toBe(true);
        }
    }

    expect(primary.every(probe => probe.font === "applied")).toBe(true);
};

export const runIsolatedStylesIntegration = async (
    name: "chrome" | "firefox",
    manifestVersion: 2 | 3,
    fixtureName = "isolation-shadow"
): Promise<void> => {
    const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
    let session: BrowserSession | undefined;
    let chrome: CdpClient | undefined;
    let firefox: BidiClient | undefined;
    let fixture: IntegrationFixture | undefined;
    let site: IntegrationSite | undefined;
    let lastState: unknown;

    try {
        fixture = await createIntegrationFixture(rootDir, path.join(__dirname, fixtureName));
        const extensionDir = await fixture.build({browser: name, manifestVersion});
        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
        const scripts = manifest.content_scripts as Array<{css?: string[]; js: string[]}>;

        const resources: string[] =
            manifestVersion === 2
                ? manifest.web_accessible_resources
                : manifest.web_accessible_resources.flatMap((entry: {resources: string[]}) => entry.resources);

        const normal = scripts.find(script => script.js.some(file => file.includes("normal.content")));
        const shadows = scripts.filter(script => script !== normal);

        expect(scripts).toHaveLength(3);
        expect(normal).toBeDefined();
        expect(shadows).toHaveLength(2);
        expect(scripts.every(script => script.js.every(file => !/background/i.test(file)))).toBe(true);
        // The same emitted stylesheet is shared by document and isolated consumers.
        const sharedCss = normal!.css!.filter(file => resources.includes(file));
        expect(sharedCss.length).toBeGreaterThan(0);

        const documentCss = (
            await Promise.all(normal!.css!.map(file => readFile(path.join(extensionDir, file), "utf8")))
        ).join("\n");

        const isolatedCss = (
            await Promise.all(
                resources
                    .filter(file => file.endsWith(".css"))
                    .map(file => readFile(path.join(extensionDir, file), "utf8"))
            )
        ).join("\n");

        expect(documentCss).toMatch(/border-top:\s*3px/);
        expect(isolatedCss).toMatch(/border-top:\s*3px/);
        expect(resources.some(file => /^assets\/probe\.[a-f0-9]{8}\.woff2$/.test(file))).toBe(true);
        expect(resources.some(file => /^css\/.+\.[a-f0-9]{8}\.css$/.test(file))).toBe(true);

        for (const file of new Set([
            ...scripts.flatMap(script => [...script.js, ...(script.css ?? [])]),
            ...resources,
        ])) {
            await expect(stat(path.join(extensionDir, file))).resolves.toBeDefined();
        }

        session = await startBrowserSession(name, rootDir, extensionDir);
        chrome = session.chrome;
        firefox = session.firefox;
        const {navigate, evaluate, version} = session;

        expect(typeof session.extensionId).toBe("string");

        const measurements: Array<{policy: string; top: ShadowDocumentState; frames: FrameState}> = [];

        for (const policy of [null, strictCsp]) {
            site = await startIntegrationSite(path.join(fixture.directory, "site"), policy);
            const topUrl = site.origin + "/top.html";
            const response = await fetch(topUrl);
            expect(response.headers.get("content-security-policy")).toBe(policy);
            await response.arrayBuffer();
            await navigate(topUrl);

            const top = await waitFor(async () => {
                const state = await evaluate(`${documentStateExpression}(document)`);
                lastState = state;

                return state?.pageUrl === topUrl && isReady(state, 3) ? state : undefined;
            }, 30_000);

            expectDocument(top, "top", 2, sharedCss);

            if (fixtureName === "isolation-shadow" && name === "chrome") {
                // Firefox BiDi rejects navigation from a web tab to a private extension page.
                // Open the actual popup document: the same React component and lazy CSS
                // must work without isolated-style delivery in an extension page.
                const stylesheet = top.probes.find(probe => probe.kind === "primary")!.links[0];
                const popupPath = manifest.action?.default_popup ?? manifest.browser_action?.default_popup;
                expect(popupPath).toBeDefined();
                await navigate(new URL("/" + popupPath, stylesheet).href);

                await waitFor(
                    async () => {
                        const ready = await evaluate(`(() => {
                        const panel = document.querySelector('[data-shadow-result="primary"]');
                        return panel?.dataset.ready === "true" &&
                            getComputedStyle(panel).color === "rgb(17, 85, 153)" &&
                            getComputedStyle(panel).backgroundColor === "rgb(34, 102, 68)";
                    })()`);

                        return ready || undefined;
                    },
                    30_000,
                    "shared React component and lazy stylesheet in popup"
                );

                expect(
                    await evaluate(
                        `getComputedStyle(document.documentElement).getPropertyValue("--adnbn-cascade-order").trim()`
                    )
                ).toBe("default");

                await navigate(topUrl);

                await waitFor(
                    async () => {
                        const state = await evaluate(`${documentStateExpression}(document)`);

                        return isReady(state, 3) ? state : undefined;
                    },
                    30_000,
                    "content styles after popup reuse"
                );
            }

            if (fixtureName === "isolation-shadow") {
                expect(top.probes.filter(probe => probe.kind === "primary").every(probe => probe.mode === "open")).toBe(
                    true
                );

                expect(top.probes.find(probe => probe.kind === "secondary")).toMatchObject({
                    mode: "closed",
                    closed: true,
                });

                const instance = Number(top.probes.find(probe => probe.kind === "secondary")!.instance);

                await evaluate(`(() => {
                    document.querySelector('[data-shadow-secondary]')?.remove();
                    const anchor = document.createElement("div");
                    anchor.setAttribute("data-shadow-secondary", "");
                    document.body.appendChild(anchor);
                })()`);

                const replaced = await waitFor(async () => {
                    const state = await evaluate(`${documentStateExpression}(document)`);
                    lastState = state;

                    return isReady(state, 3) &&
                        Number(state.probes.find(probe => probe.kind === "secondary")?.instance) > instance
                        ? state
                        : undefined;
                }, 30_000);

                expectDocument(replaced, "top", 2, sharedCss);

                expect(replaced.probes.find(probe => probe.kind === "secondary")).toMatchObject({
                    mode: "closed",
                    closed: true,
                });
            }

            if (fixtureName === "isolation-iframe") {
                let mounts = top.probes.map(probe => probe.mounts!);

                for (const operation of ["append", "insert", "reinsert"]) {
                    await evaluate(`(() => {
                        const destination = document.createElement("section");
                        document.body.append(destination);
                        for (const host of document.querySelectorAll('[data-shadow-probe]')) {
                            if (${JSON.stringify(operation)} === 'reinsert') host.remove();
                            if (${JSON.stringify(operation)} === 'insert') destination.insertBefore(host, destination.firstChild);
                            else destination.appendChild(host);
                        }
                    })()`);

                    const recovered = await waitFor(async () => {
                        const state = await evaluate(`${documentStateExpression}(document)`);
                        lastState = state;

                        return isReady(state, 3) && state.probes.every(probe => probe.mounts! > Math.max(...mounts))
                            ? state
                            : undefined;
                    }, 10000);

                    expectDocument(recovered, "top", 2, sharedCss);
                    expect(recovered.probes.every(probe => probe.mounts === Math.max(...mounts) + 1)).toBe(true);
                    mounts = recovered.probes.map(probe => probe.mounts!);
                }
            }

            const oldInstance = Number(top.probes.find(probe => probe.anchor === "first")?.instance);

            await evaluate(`(() => {
                document.querySelector('[data-shadow-primary="first"]')?.remove();
                const replacement = document.createElement("div");
                replacement.setAttribute("data-shadow-primary", "first");
                document.body.append(replacement);
            })()`);

            const remounted = await waitFor(async () => {
                const state = await evaluate(`${documentStateExpression}(document)`);
                lastState = state;
                const instance = Number(state?.probes.find(probe => probe.anchor === "first")?.instance);

                return isReady(state, 3) && instance > oldInstance ? state : undefined;
            }, 30_000);

            expectDocument(remounted, "top", 2, sharedCss);

            const framesUrl = site.origin + "/frames.html";
            await navigate(framesUrl);

            const frames = await waitFor(async () => {
                const state = await evaluate(`(() => {
                    const child = document.querySelector('[data-testid="child-frame"]')?.contentDocument;
                    if (!child || child.readyState !== "complete") return undefined;
                    return {top: ${documentStateExpression}(document), child: ${documentStateExpression}(child)};
                })()`);

                lastState = state;

                return isReady(state?.top, 2) && isReady(state?.child, 2) ? state : undefined;
            }, 30_000);

            expectDocument(frames.top, "top", 1, sharedCss);
            expectDocument(frames.child, "child", 1, sharedCss);

            if (fixtureName === "isolation-shadow") {
                for (const document of [frames.top, frames.child]) {
                    expect(document.probes.find(probe => probe.kind === "secondary")).toMatchObject({
                        mode: "closed",
                        closed: true,
                    });
                }
            }

            measurements.push({policy: policy === null ? "none" : "strict", top: remounted, frames});
            await site.close();
            site = undefined;
        }

        const report = {browser: version, manifestVersion, measurements};

        const reportPath = path.join(
            rootDir,
            ".cache",
            "integration",
            fixtureName + "-" + name + "-mv" + manifestVersion + ".json"
        );

        await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
        console.info(JSON.stringify(report, null, 2));
        expect(version).toMatch(new RegExp(`^${name === "chrome" ? "Chrome" : "Firefox"}\\/\\d+(?:\\.\\d+)+$`));
        expect(name === "chrome" ? chrome?.runtimeErrors : firefox?.runtimeErrors).toEqual([]);
    } catch (error) {
        throw new Error(
            `${error instanceof Error ? error.message : String(error)}; last state: ${JSON.stringify(lastState)}; runtime errors: ${JSON.stringify(chrome?.runtimeErrors ?? firefox?.runtimeErrors ?? [])}; browser output: ${session?.output ?? ""}`,
            {cause: error}
        );
    } finally {
        await session?.close();
        await site?.close();
        await fixture?.dispose();
    }
};
