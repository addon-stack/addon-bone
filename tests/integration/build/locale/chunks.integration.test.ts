/** @jest-environment node */

import {readFile, readdir, rm, writeFile} from "fs/promises";
import path from "path";
import vm from "vm";

import {createLocaleModule} from "@cli/plugins/locale/module";
import {Language} from "@typing/locale";
import {createIntegrationFixture} from "../../utils/fixture";

jest.setTimeout(90_000);

const Greeting = "Hello from the locale chunk fixture";
const Entries = [
    "popup",
    "options",
    "isolated.content",
    "isolated-secondary.content",
    "main.content",
    "main-secondary.content",
];

interface Scenario {
    browser: "chrome" | "firefox";
    entries: string[];
    bytes?: number;
    enabled?: boolean;
}

test.each<Scenario>([
    {browser: "chrome", entries: ["popup"]},
    {browser: "chrome", entries: ["isolated.content"]},
    {browser: "chrome", entries: ["main.content"]},
    {browser: "chrome", entries: ["popup", "isolated.content"]},
    {browser: "chrome", entries: ["isolated.content", "main.content"]},
    {browser: "chrome", entries: ["main.content", "main-secondary.content"]},
    {browser: "chrome", entries: ["main.content", "main-secondary.content"], bytes: 100_000},
    {browser: "chrome", entries: Entries},
    {browser: "chrome", entries: Entries, bytes: 100_000},
    {browser: "chrome", entries: ["popup"], bytes: 99_999},
    {browser: "chrome", entries: ["popup"], bytes: 100_000},
    {browser: "chrome", entries: ["isolated.content"], bytes: 100_000},
    {browser: "chrome", entries: ["main.content"], bytes: 100_000},
    {browser: "chrome", entries: ["isolated.content", "main.content"], bytes: 100_000},
    {browser: "chrome", entries: [], bytes: 100_000},
    {browser: "chrome", entries: Entries, enabled: false},
    {browser: "firefox", entries: Entries},
])("$browser: $entries, bytes=$bytes, commonChunks=$enabled", async ({browser, entries, bytes, enabled = true}) => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, path.join(__dirname, "chunks-fixture"));
    try {
        for (const entry of Entries) {
            if (!entries.includes(entry)) await rm(path.join(fixture.directory, "src", `${entry}.ts`));
        }
        if (bytes !== undefined) {
            const keys = new Set(["greeting", "padding", "locale"]);
            const empty = createLocaleModule(
                {en: {greeting: Greeting, padding: "", locale: "en"}},
                keys,
                Language.English
            );
            const padding = "x".repeat(bytes - Buffer.byteLength(empty));
            const messages = {greeting: Greeting, padding};
            expect(
                Buffer.byteLength(createLocaleModule({en: {...messages, locale: "en"}}, keys, Language.English))
            ).toBe(bytes);
            await writeFile(path.join(fixture.directory, "src/locales/en.json"), JSON.stringify(messages));
            await rm(path.join(fixture.directory, "src/locales/fr.json"));
        }
        if (!enabled) {
            const config = path.join(fixture.directory, "adnbn.config.ts");
            await writeFile(
                config,
                (await readFile(config, "utf8")).replace("commonChunks: true", "commonChunks: false")
            );
        }

        const directory = await fixture.build({browser});
        const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
        const backgroundFiles: string[] = manifest.background.service_worker
            ? [manifest.background.service_worker]
            : manifest.background.scripts;
        expect(backgroundFiles).toHaveLength(1);

        const sources = new Map<string, string>();
        for (const filename of await readdir(directory, {recursive: true})) {
            if (filename.endsWith(".js")) {
                sources.set(filename.split(path.sep).join("/"), await readFile(path.join(directory, filename), "utf8"));
            }
        }
        if (!enabled) expect([...sources.keys()].filter(file => /^js\/locale\.[^.]+\.js$/.test(file))).toEqual([]);

        const catalogueFiles = [...sources.keys()].filter(file => sources.get(file)!.includes(Greeting));
        expect(catalogueFiles).toContain(backgroundFiles[0]);

        const sandbox = {catalogue: undefined as Record<string, Record<string, string>> | undefined};
        vm.runInNewContext(sources.get(backgroundFiles[0])!, sandbox);
        expect(sandbox.catalogue!.en.greeting).toBe(Greeting);
        if (bytes === undefined) expect(sandbox.catalogue!.fr.greeting).toBe("Bonjour depuis le catalogue partagé");
        for (const [language, messages] of Object.entries(sandbox.catalogue!)) {
            const json = JSON.parse(
                await readFile(path.join(directory, "_locales", language, "messages.json"), "utf8")
            );
            expect(messages).toEqual(
                Object.fromEntries(
                    Object.entries(json).map(([key, value]) => [key, (value as {message: string}).message])
                )
            );
        }

        const consumers: Array<{files: string[]; main: boolean}> = [];
        for (const filename of [manifest.action?.default_popup, manifest.options_ui?.page]) {
            if (!filename) continue;
            const html = await readFile(path.join(directory, filename), "utf8");
            consumers.push({
                files: [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(([, file]) =>
                    path.posix.normalize(path.posix.join(path.posix.dirname(filename), file))
                ),
                main: false,
            });
        }
        consumers.push(
            ...(manifest.content_scripts ?? []).map((script: {js: string[]; world: string}) => ({
                files: script.js,
                main: script.world === "MAIN",
            }))
        );
        expect(consumers).toHaveLength(entries.length);

        const mainConsumers = consumers.filter(consumer => consumer.main);
        const localeConsumers = consumers.filter(consumer => !consumer.main);
        const split = enabled && localeConsumers.length > 0 && (localeConsumers.length >= 2 || (bytes ?? 0) >= 100_000);
        // The fixture's shared content runtime exceeds the regular 20,000-byte threshold.
        const splitMain = enabled && mainConsumers.length >= 2;
        const sharedFiles = new Set<string>();
        const mainFiles = new Set<string>();
        for (const {files, main} of consumers) {
            expect(files).not.toContain(backgroundFiles[0]);
            for (const file of files) expect(sources.has(file)).toBe(true);
            const found = files.filter(file => catalogueFiles.includes(file));
            expect(found).toHaveLength(1);
            if (main) {
                mainFiles.add(found[0]);
                expect(found[0]).not.toMatch(/^js\/locale[.-]/);
                if (splitMain) expect(found[0]).toMatch(/^js\/common-main\.content\.[a-f0-9]{8}\.js$/);
            } else {
                sharedFiles.add(found[0]);
            }
            if (enabled && !main) {
                expect(sources.get(found[0])!.includes("localeContext")).toBe(!split);
                if (split) expect(found[0]).toMatch(/^js\/locale\.[a-f0-9]{8}\.js$/);
            }
        }
        const otherFiles = new Set(localeConsumers.flatMap(consumer => consumer.files));
        for (const {files} of mainConsumers) {
            expect(files.filter(file => otherFiles.has(file))).toEqual([]);
        }
        expect([...sources.keys()].some(file => /locale-main/.test(file))).toBe(false);
        if (enabled) {
            expect(catalogueFiles).toHaveLength(
                1 + (split ? 1 : localeConsumers.length) + (splitMain ? 1 : mainConsumers.length)
            );
            expect(mainFiles.size).toBe(splitMain ? 1 : mainConsumers.length);
            expect(sharedFiles.size).toBe(split ? 1 : localeConsumers.length);
            if (split) {
                const source = sources.get([...sharedFiles][0])!;
                expect(source.split(Greeting)).toHaveLength(2);
            }
            if (splitMain) {
                expect(sources.get([...mainFiles][0])!.split(Greeting)).toHaveLength(2);
            }
        }
    } finally {
        await fixture.dispose();
    }
});
