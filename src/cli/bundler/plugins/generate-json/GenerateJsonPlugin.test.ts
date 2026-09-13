import path from "path";
import {rspack, Compiler, type Stats} from "@rspack/core";
import {createFsFromVolume, Volume} from "memfs";
import GenerateJsonPlugin from "./GenerateJsonPlugin";

describe("GenerateJsonPlugin watch updates", () => {
    const output = path.resolve(__dirname, "dist");
    let compiler: Compiler;

    const run = () =>
        new Promise<Stats>((resolve, reject) => {
            compiler.run((error, stats) => (error ? reject(error) : resolve(stats!)));
        });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => compiler.close(error => (error ? reject(error) : resolve())));
    });

    test("reports validation failures without emitting stale data and allows a later valid update", async () => {
        const error = new Error('Locale "fr" is missing plural key "cart.items" required by default locale "en"');
        const update = jest.fn(async () => ({"messages.json": {title: "Updated"}}));
        update.mockRejectedValueOnce(error);
        compiler = rspack({
            mode: "none",
            entry: {},
            output: {path: output},
            optimization: {emitOnErrors: false},
            plugins: [new GenerateJsonPlugin({}).watch(update)],
        });
        const filesystem = createFsFromVolume(new Volume());
        compiler.outputFileSystem = filesystem as Compiler["outputFileSystem"];

        await compiler.hooks.watchRun.promise(compiler);
        const failed = await run();
        expect(failed.hasErrors()).toBe(true);
        expect(failed.toString({all: false, errors: true})).toContain(error.message);
        expect(filesystem.existsSync(path.join(output, "messages.json"))).toBe(false);

        await compiler.hooks.watchRun.promise(compiler);
        expect((await run()).hasErrors()).toBe(false);
        expect(JSON.parse(filesystem.readFileSync(path.join(output, "messages.json"), "utf8") as string)).toEqual({
            title: "Updated",
        });
        expect(update).toHaveBeenCalledTimes(2);
    });

    test("removes obsolete JSON and empty directories only after a successful update", async () => {
        let data: Record<string, {message: string}> = {
            "_locales/en/messages.json": {message: "Hello"},
            "_locales/fr/messages.json": {message: "Bonjour"},
        };
        let fail = false;
        compiler = rspack({
            mode: "none",
            entry: {},
            output: {path: output, clean: false},
            optimization: {emitOnErrors: false},
            plugins: [
                new GenerateJsonPlugin(data).watch(async () => {
                    if (fail) throw new Error("Invalid input");
                    return data;
                }),
            ],
        });
        const filesystem = createFsFromVolume(new Volume());
        compiler.outputFileSystem = filesystem as Compiler["outputFileSystem"];
        expect((await run()).hasErrors()).toBe(false);
        filesystem.writeFileSync(path.join(output, "unrelated.txt"), "Keep this file");

        data = {"_locales/en/messages.json": {message: "Updated"}};
        fail = true;
        await compiler.hooks.watchRun.promise(compiler);
        expect((await run()).hasErrors()).toBe(true);
        expect(filesystem.existsSync(path.join(output, "_locales/fr/messages.json"))).toBe(true);

        fail = false;
        await compiler.hooks.watchRun.promise(compiler);
        expect((await run()).hasErrors()).toBe(false);
        expect(filesystem.existsSync(path.join(output, "_locales/fr"))).toBe(false);
        expect(filesystem.readFileSync(path.join(output, "unrelated.txt"), "utf8")).toBe("Keep this file");
        expect(
            JSON.parse(filesystem.readFileSync(path.join(output, "_locales/en/messages.json"), "utf8") as string)
        ).toEqual({message: "Updated"});
    });

    test("allows watch builds without an update callback", async () => {
        compiler = rspack({mode: "none", entry: {}, plugins: [new GenerateJsonPlugin({})]});

        await expect(compiler.hooks.watchRun.promise(compiler)).resolves.toBeUndefined();
    });
});
