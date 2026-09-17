import {spawn, type ChildProcess} from "child_process";
import {copyFile, readFile, readdir, rm, writeFile} from "fs/promises";
import path from "path";
import vm from "vm";
import {createIntegrationFixture} from "../../utils/fixture";
import {stop, waitFor} from "../../browser/utils/browser";
import {escapeLocaleMessages} from "@shared/locale";

jest.setTimeout(90_000);

type Catalogue = Record<string, Record<string, string>>;

const inspect = async (directory: string) => {
    const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
    const files: string[] = manifest.background.service_worker
        ? [manifest.background.service_worker]
        : manifest.background.scripts;
    const sandbox = {
        readLocaleCatalogue: undefined as (() => Catalogue) | undefined,
        readLocaleKeys: undefined as (() => readonly string[]) | undefined,
        readLocaleLanguage: undefined as (() => string) | undefined,
        readLocaleLanguages: undefined as (() => readonly string[]) | undefined,
    };
    const context = vm.createContext(sandbox);
    for (const file of files) {
        vm.runInContext(await readFile(path.join(directory, file), "utf8"), context);
    }
    const catalogue = sandbox.readLocaleCatalogue!();
    const lang = sandbox.readLocaleLanguage!();
    expect(lang).toBe(manifest.default_locale);
    const exportedLanguages = sandbox.readLocaleLanguages!();
    expect(exportedLanguages).toEqual(Object.keys(catalogue));
    const languages = await readdir(path.join(directory, "_locales"));
    expect(Object.keys(catalogue).sort()).toEqual(languages.sort());
    for (const lang of languages) {
        const messages = JSON.parse(await readFile(path.join(directory, "_locales", lang, "messages.json"), "utf8"));
        const native = escapeLocaleMessages(
            Object.fromEntries(Object.entries(catalogue[lang]).map(([key, message]) => [key, {message}]))
        );
        expect(messages).toEqual(native);
        expect(catalogue[lang].locale).toBe(lang);
    }
    return {catalogue, keys: sandbox.readLocaleKeys!(), lang, languages: exportedLanguages};
};

test.each(["chrome", "firefox"])("%s build imports the catalogue and preserves the native JSON data", async browser => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, path.join(__dirname, "fixture"));
    try {
        const {catalogue, keys} = await inspect(await fixture.build({browser}));
        expect([...keys].sort()).toEqual([
            "__proto__",
            "app.greeting",
            "app.title",
            "empty",
            "items",
            "literal",
            "locale",
        ]);
        expect(catalogue.fr.secondaryOnly).toBe("Only in French");
        expect(catalogue.fr).toMatchObject({
            app_title: browser === "chrome" ? "Catalogue pour Chrome" : "Catalogue de traductions",
            app_greeting: "Hello {{name}}",
            items: "{{count}} article|{{count}} articles",
            empty: "",
            literal: 'Quotes: "hello"; slash: \\; line:\nnext; dollar: $&',
        });
        expect(Object.hasOwn(catalogue.fr, "__proto__")).toBe(true);
        expect(catalogue.fr.__proto__).toBe("An ordinary translation key");
    } finally {
        await fixture.dispose();
    }
});

test("exports the configured default language even when it is not the first catalogue language", async () => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, path.join(__dirname, "fixture"));
    try {
        // Give the new default the complete message contract, including own __proto__ keys.
        await copyFile(
            path.join(fixture.directory, "src/locales/en.json"),
            path.join(fixture.directory, "src/locales/fr.json")
        );
        const filename = path.join(fixture.directory, "adnbn.config.ts");
        await writeFile(
            filename,
            (await readFile(filename, "utf8")).replace('version: "1.0.0",', 'version: "1.0.0", lang: "fr",')
        );
        const {lang, languages} = await inspect(await fixture.build());
        expect(languages[0]).toBe("en");
        expect(lang).toBe("fr");
    } finally {
        await fixture.dispose();
    }
});

test("CLI watch discovers, edits and removes locales and recovers from invalid translations", async () => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, path.join(__dirname, "fixture"));
    let compilations = 0;
    const update = async (change: () => Promise<unknown>) => {
        const previous = compilations;
        await change();
        await waitFor(
            async () => (compilations > previous ? true : undefined),
            15000,
            "locale watch compilation and watcher reconnection after an edit"
        );
    };
    // Save like an editor: Windows copyFile can preserve the fixture's old mtime and hide an edit from watch.
    const updateLocale = async (language: string, state: string) =>
        update(async () =>
            writeFile(
                path.join(fixture.directory, "src/locales", `${language}.json`),
                await readFile(path.join(__dirname, "states", state))
            )
        );
    let watcher: ChildProcess | undefined;
    let output = "";
    try {
        const directory = await fixture.build();
        await rm(path.join(directory, "manifest.json"));
        watcher = spawn(process.execPath, [path.join(ADNBN_TEST_ROOT, "bin/adnbn.js"), "watch", ".", "-b", "chrome"], {
            cwd: fixture.directory,
            stdio: ["ignore", "pipe", "pipe", "ipc"],
        });
        watcher.stdout?.on("data", chunk => (output += chunk));
        watcher.stderr?.on("data", chunk => (output += chunk));
        watcher.on("message", message => {
            if (message === "locale-watch-ready") compilations++;
        });
        // CLI output and emitted files precede watcher reconnection in the child process.
        await waitFor(async () => compilations || undefined, 15000, "initial locale watcher readiness");
        await waitFor(() => inspect(directory), 15000, "initial locale watch build");
        await updateLocale("de", "de.json");
        await waitFor(
            async () => {
                const {catalogue, languages} = await inspect(directory);
                expect([...languages].sort()).toEqual(["de", "en", "fr"]);
                expect(catalogue.de.app_title).toBe("Übersetzungskatalog");
                return true;
            },
            15000,
            "a new locale without editing an existing file"
        );

        await updateLocale("de", "de-updated.json");
        await waitFor(
            async () => {
                expect((await inspect(directory)).catalogue.de.app_title).toBe("Aktualisierter Katalog");
                return true;
            },
            15000,
            "an edit to the newly discovered locale"
        );

        await updateLocale("en", "en.json");
        await waitFor(
            async () => {
                const {catalogue, keys, languages} = await inspect(directory);
                expect([...languages].sort()).toEqual(["de", "en", "fr"]);
                expect(catalogue.de.app_title).toBe("Aktualisierter Katalog");
                expect(catalogue.fr.app_greeting).toBe("Welcome {{name}}");
                expect(catalogue.fr.newKey).toBe("Added during watch");
                expect(catalogue.fr).not.toHaveProperty("empty");
                expect([...keys].sort()).toEqual(["app.greeting", "app.title", "items", "locale", "newKey"]);
                const declarations = await readFile(path.join(fixture.directory, ".adnbn/locale.d.ts"), "utf8");
                expect(declarations).toContain('"newKey"');
                expect(declarations).not.toContain('"empty"');
                return true;
            },
            15000,
            "updated locale catalogue, languages and JSON"
        );

        await update(() => rm(path.join(fixture.directory, "src/locales/de.json")));
        await waitFor(
            async () => {
                expect((await inspect(directory)).languages).toEqual(["en", "fr"]);
                return true;
            },
            15000,
            "removal of a locale and its generated JSON"
        );

        const declarationFile = path.join(fixture.directory, ".adnbn/locale.d.ts");
        for (const invalid of ["invalid-plural.json", "invalid-json.txt"]) {
            const previousDeclaration = await readFile(declarationFile, "utf8");
            const previousJson = await readFile(path.join(directory, "_locales/en/messages.json"), "utf8");
            const previousBundle = await readFile(path.join(directory, "js/background.js"), "utf8");
            const offset = output.length;
            await updateLocale("de", invalid);
            await waitFor(
                async () => output.slice(offset).includes("compiled with") || undefined,
                15000,
                "invalid locale diagnostics"
            );
            expect(watcher.exitCode).toBeNull();
            expect(await readFile(declarationFile, "utf8")).toBe(previousDeclaration);
            expect(await readFile(path.join(directory, "_locales/en/messages.json"), "utf8")).toBe(previousJson);
            expect(await readFile(path.join(directory, "js/background.js"), "utf8")).toBe(previousBundle);

            await updateLocale("de", "de.json");
            await waitFor(
                async () => {
                    expect((await inspect(directory)).catalogue.de.app_title).toBe("Übersetzungskatalog");
                    return true;
                },
                15000,
                "recovery after fixing the invalid locale"
            );
        }
    } catch (error) {
        throw new Error(`${String(error)}\n${output}`, {cause: error});
    } finally {
        if (watcher) await stop(watcher);
        await fixture.dispose();
    }
});
