import path from "path";

import {startBrowserSession, type BrowserSession} from "../utils/session";
import {waitFor} from "../utils/browser";
import {createIntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.resolve(__dirname, "..", "..", "build", "jsx", "fixture");

jest.setTimeout(90_000);

test("Chrome MV3 renders JSX definitions, components and elements with working React state", async () => {
    const fixture = await createIntegrationFixture(rootDir, fixtureDir);
    let session: BrowserSession | undefined;

    try {
        const extensionDir = await fixture.build();
        const browser = await startBrowserSession("chrome", rootDir, extensionDir);
        session = browser;

        for (const [name, title] of [
            ["definition", "JSX definition"],
            ["named", "JSX named"],
            ["element", "JSX element"],
            ["react-typescript", "TSX page"],
        ]) {
            await browser.navigate(`chrome-extension://${browser.extensionId}/${name}.html`);

            const readButton = () => browser.evaluate("document.querySelector('button')?.textContent");

            await waitFor(
                async () => ((await readButton()) === `${title}: 0` ? true : undefined),
                10_000,
                `${name} initial render`
            );

            expect(await browser.evaluate("document.title")).toBe(title);

            await browser.evaluate("document.querySelector('button').click()");

            await waitFor(
                async () => ((await readButton()) === `${title}: 1` ? true : undefined),
                10_000,
                `${name} state update`
            );

            expect(await readButton()).toBe(`${title}: 1`);
        }

        for (const [name, title] of [
            ["javascript", "JavaScript page"],
            ["typescript", "TypeScript page"],
        ]) {
            await browser.navigate(`chrome-extension://${browser.extensionId}/${name}.html`);

            await waitFor(
                async () => ((await browser.evaluate("document.body.textContent.trim()")) === title ? true : undefined),
                10_000,
                `${name} render`
            );

            expect(await browser.evaluate("document.title")).toBe(title);
        }

        expect(browser.errors).toEqual([]);
    } catch (error) {
        throw new Error(`${String(error)}; Chrome output: ${session?.output ?? ""}`, {cause: error});
    } finally {
        try {
            await session?.close();
        } finally {
            await fixture.dispose();
        }
    }
});
