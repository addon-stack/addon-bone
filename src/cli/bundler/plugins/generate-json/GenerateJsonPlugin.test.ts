import {rspack, Compiler} from "@rspack/core";
import GenerateJsonPlugin from "./GenerateJsonPlugin";

describe("GenerateJsonPlugin watch updates", () => {
    let compiler: Compiler;

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => compiler.close(error => (error ? reject(error) : resolve())));
    });

    test("propagates validation failures to the compiler and allows a later valid update", async () => {
        const error = new Error('Locale "fr" is missing plural key "cart.items" required by default locale "en"');
        const update = jest.fn(async () => ({"messages.json": {title: "Updated"}}));
        update.mockRejectedValueOnce(error);
        compiler = rspack({
            mode: "none",
            entry: {},
            plugins: [new GenerateJsonPlugin({}).watch(update)],
        });

        await expect(compiler.hooks.watchRun.promise(compiler)).rejects.toThrow(error);
        await expect(compiler.hooks.watchRun.promise(compiler)).resolves.toBeUndefined();
        expect(update).toHaveBeenCalledTimes(2);
    });

    test("allows watch builds without an update callback", async () => {
        compiler = rspack({mode: "none", entry: {}, plugins: [new GenerateJsonPlugin({})]});

        await expect(compiler.hooks.watchRun.promise(compiler)).resolves.toBeUndefined();
    });
});
