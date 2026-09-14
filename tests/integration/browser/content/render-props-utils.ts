import path from "path";
import {run} from "../../utils/process";
import {createIntegrationFixture} from "../../utils/fixture";
import {startBrowserSession} from "../utils/session";
import {startIntegrationSite} from "../utils/site";
import {waitFor} from "../utils/browser";

export async function expectRenderProps(browser: "chrome" | "firefox") {
    const root = path.resolve(__dirname, "../../../..");
    const fixture = await createIntegrationFixture(root, path.join(__dirname, "render-props"));
    const site = await startIntegrationSite(path.join(fixture.directory, "site"), null);
    let session: Awaited<ReturnType<typeof startBrowserSession>> | undefined;

    const until = (check: () => Promise<unknown>, description: string) =>
        waitFor(async () => ((await check()) ? true : undefined), 15_000, description);

    try {
        const extension = await fixture.build({browser, manifestVersion: browser === "chrome" ? 3 : 2});

        await run(
            process.execPath,
            [path.join(root, "node_modules/typescript/bin/tsc"), "--noEmit"],
            fixture.directory
        );

        session = await startBrowserSession(browser, root, extension);
        await session.navigate(site.origin + "/top.html");

        await until(
            async () => await session!.evaluate("document.querySelectorAll('[data-preparing]').length === 6"),
            "all anchors to enter preparation"
        );

        await until(
            async () => await session!.evaluate("document.body.dataset.relayRpc === JSON.stringify({ready: false})"),
            "Relay RPC before preparation finishes"
        );

        expect(await session.evaluate("document.querySelectorAll('article > *').length")).toBe(0);
        expect(await session.evaluate("document.querySelector('#headless').dataset.headless")).toBe("true");

        await session.evaluate(`(() => {
            const anchors = [...document.querySelectorAll('[data-preparing]')];
            document.querySelector('#removed').remove();
            for (const anchor of anchors) anchor.dispatchEvent(new Event('release'));
        })()`);

        await until(
            async () =>
                await session!.evaluate(
                    "['shadow','frame','vanilla','relay'].every(id => document.getElementById(id).dataset.snapshot)"
                ),
            "all render props snapshots"
        );

        await until(
            async () => await session!.evaluate("document.body.dataset.relayRpc === JSON.stringify({ready: true})"),
            "Relay main after preparation"
        );

        const snapshot = (id: string) =>
            session!.evaluate(`JSON.parse(document.getElementById(${JSON.stringify(id)}).dataset.snapshot)`);

        const command = (id: string, command: string) =>
            session!.evaluate(
                `document.dispatchEvent(new CustomEvent('probe-command', {detail: ${JSON.stringify(JSON.stringify({id, command}))}}))`
            );

        const shadow = await snapshot("shadow");

        expect(shadow).toMatchObject({
            label: "shadow",
            count: 0,
            containerConnected: true,
            targetConnected: true,
            same: false,
            shadow: true,
            closed: true,
            frame: false,
            portal: "shadow",
        });

        const frame = await snapshot("frame");
        expect(frame).toMatchObject({label: "frame", frame: true, portal: "frame", same: false});
        expect(await snapshot("vanilla")).toEqual({label: "vanilla", same: true, connected: true});
        expect(await snapshot("relay")).toMatchObject({label: "relay", shadow: true, portal: "relay"});
        await command("vanilla", "remount");

        expect(await session.evaluate("JSON.parse(document.getElementById('vanilla').dataset.lifecycle)")).toEqual({
            events: ["unmount", "mount"],
            mounted: true,
            connected: true,
            text: "vanilla",
        });

        await command("skip", "mount");

        await until(
            async () => await session!.evaluate("document.querySelector('#skip').dataset.tracked === '2'"),
            "headless anchor tracking"
        );

        expect(await session.evaluate("document.querySelector('#skip').childElementCount")).toBe(0);
        expect(await session.evaluate("document.querySelector('[data-host=removed]')")).toBeNull();
        await command("shadow", "click");
        await until(async () => (await snapshot("shadow")).count === 1, "React counter update");
        await command("shadow", "mount");
        expect((await snapshot("shadow")).count).toBe(1);
        expect((await snapshot("shadow")).targetId).toBe(shadow.targetId);
        await command("shadow", "remount");

        expect(await session.evaluate("JSON.parse(document.getElementById('shadow').dataset.lifecycle)")).toMatchObject(
            {events: ["unmount", "mount"], mounted: true, connected: true}
        );

        await until(async () => (await snapshot("shadow")).targetId !== shadow.targetId, "new Shadow DOM target");
        expect(await snapshot("shadow")).toMatchObject({count: 0, closed: true, portal: "shadow"});
        await command("frame", "frame-reload");
        await until(async () => (await snapshot("frame")).targetId !== frame.targetId, "iframe document recovery");
        expect(await snapshot("frame")).toMatchObject({frame: true, portal: "frame", targetConnected: true});
        expect(await session.evaluate("document.body.dataset.error ?? null")).toBeNull();
        expect(session.errors).toEqual([]);
    } catch (error) {
        throw new Error(
            `${String(error)}; errors: ${JSON.stringify(session?.errors)}; state: ${session ? await session.evaluate("document.body.innerHTML") : "no session"}`
        );
    } finally {
        await session?.close();
        await site.close();
        await fixture.dispose();
    }
}
