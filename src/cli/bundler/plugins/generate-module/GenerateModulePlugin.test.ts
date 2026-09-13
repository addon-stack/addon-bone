/** @jest-environment node */

import fs from "fs/promises";
import os from "os";
import path from "path";
import vm from "vm";
import {rspack, type Compiler, type NormalModule, type Stats} from "@rspack/core";
import {GenerateModulePlugin} from "./index";

const fixtures = path.join(__dirname, "tests/fixtures");
const modules = {
    "virtual/value": "export default 3;",
    "virtual/tools": "export function double(value) { return value * 2; }",
    "virtual/unused": 'throw new Error("Unused modules must not execute");',
};

let directory: string;
const compilers = new Set<Compiler>();

beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "adnbn-generate-module-"));
});

const close = async (compiler: Compiler) => {
    await new Promise<void>((resolve, reject) => compiler.close(error => (error ? reject(error) : resolve())));
    compilers.delete(compiler);
};

afterEach(async () => {
    for (const compiler of compilers) await close(compiler);
    await fs.rm(directory, {recursive: true, force: true});
});

const createCompiler = (plugin: GenerateModulePlugin, name = "bundle") => {
    const compiler = rspack({
        mode: "none",
        context: fixtures,
        target: "node",
        cache: false,
        entry: "./entry.js",
        output: {path: path.join(directory, name), filename: "index.js"},
        plugins: [plugin],
    });
    compilers.add(compiler);
    return compiler;
};

const readModule = (compiler: Compiler, name: string) => compiler.options.resolve.alias![name] as string;

const run = async (compiler: Compiler): Promise<number> => {
    await new Promise<void>((resolve, reject) => {
        compiler.run((error, stats) => {
            if (error) reject(error);
            else if (stats!.hasErrors()) reject(new Error(stats!.toString({all: false, errors: true})));
            else resolve();
        });
    });
    const source = await fs.readFile(path.join(compiler.options.output.path!, "index.js"), "utf8");
    const sandbox = {result: undefined as number | undefined};
    vm.runInNewContext(source, sandbox);
    return sandbox.result!;
};

test("bundles imports and arbitrary JavaScript exports without executing unused modules", async () => {
    const compiler = createCompiler(new GenerateModulePlugin(modules));
    expect(await run(compiler)).toBe(6);
});

test("updates generated sources and recovers from callback errors", async () => {
    let value = 3;
    let fail = false;
    const compiler = createCompiler(
        new GenerateModulePlugin(modules).watch(async () => {
            if (fail) throw new Error("Cannot generate module");
            return {"virtual/value": `export default ${value};`, "virtual/tools": modules["virtual/tools"]};
        })
    );
    expect(await run(compiler)).toBe(6);

    value = 7;
    await compiler.hooks.watchRun.promise(compiler);
    expect(await run(compiler)).toBe(14);

    fail = true;
    await compiler.hooks.watchRun.promise(compiler);
    await expect(run(compiler)).rejects.toThrow("Cannot generate module");
    fail = false;
    value = 9;
    await compiler.hooks.watchRun.promise(compiler);
    expect(await run(compiler)).toBe(18);
});

test("recomputes file and directory dependencies after each refresh, including invalid updates", async () => {
    const first = path.join(directory, "first.json");
    const second = path.join(directory, "second.json");
    const missing = path.join(directory, "new-directory");
    let files = [first];
    let fail = false;
    const compiler = createCompiler(
        new GenerateModulePlugin(modules).watch(
            async () => {
                if (fail) throw new Error("Invalid source");
                return modules;
            },
            async () => ({files, directories: [directory, missing]})
        )
    );
    const dependencies = () => {
        const compilation = compiler._lastCompilation!;
        expect(compilation.contextDependencies.has(directory)).toBe(true);
        expect(compilation.missingDependencies.has(missing)).toBe(true);
        return compilation.fileDependencies;
    };

    await compiler.hooks.watchRun.promise(compiler);
    await run(compiler);
    expect(dependencies().has(first)).toBe(true);

    files = [second];
    fail = true;
    await compiler.hooks.watchRun.promise(compiler);
    await expect(run(compiler)).rejects.toThrow("Invalid source");
    expect(dependencies().has(first)).toBe(false);
    expect(dependencies().has(second)).toBe(true);
});

test("keeps compiler updates and shutdown isolated", async () => {
    const first = createCompiler(
        new GenerateModulePlugin(modules).watch(async () => ({"virtual/value": "export default 5;"})),
        "first"
    );
    const second = createCompiler(new GenerateModulePlugin(modules), "second");
    expect(readModule(first, "virtual/value")).toBe(readModule(second, "virtual/value"));
    await first.hooks.watchRun.promise(first);
    expect(await run(first)).toBe(10);
    expect(await run(second)).toBe(6);
    await close(first);
    expect(await run(second)).toBe(6);
});

test("updates generated sources in the same cached watch compilation as their dependency", async () => {
    const dependency = path.join(directory, "value.json");
    await fs.writeFile(dependency, "4");
    const plugin = new GenerateModulePlugin(modules).watch(
        async () => ({"virtual/value": `export default ${await fs.readFile(dependency, "utf8")};`}),
        async () => ({files: [dependency]})
    );
    const compiler = rspack({
        mode: "development",
        context: fixtures,
        target: "node",
        devtool: false,
        entry: "./entry.js",
        output: {path: path.join(directory, "watch"), filename: "index.js"},
        plugins: [plugin],
    });
    compilers.add(compiler);
    const observations: number[] = [];
    let resolve: () => void;
    let reject: (error: unknown) => void;
    const complete = new Promise<void>((done, fail) => {
        resolve = done;
        reject = fail;
    });
    const timer = setTimeout(
        () => reject(new Error(`Generated module watch did not finish: ${JSON.stringify(observations)}`)),
        10_000
    );
    const watcher = compiler.watch({poll: 50, aggregateTimeout: 20}, (error, stats) => {
        try {
            if (error || !stats || stats.hasErrors())
                throw error ?? new Error(stats?.toString({all: false, errors: true}));
            const sandbox = {result: 0};
            vm.runInNewContext(stats.compilation.getAsset("index.js")!.source.source().toString(), sandbox);
            observations.push(sandbox.result);
            expect(sandbox.result).toBe([8, 14, 18][observations.length - 1]);
            if (observations.length === 3) resolve();
            else void fs.writeFile(dependency, observations.length === 1 ? "7" : "9").catch(reject);
        } catch (error) {
            reject(error);
        }
    });
    try {
        await complete;
        expect(observations).toEqual([8, 14, 18]);
    } finally {
        clearTimeout(timer);
        await new Promise<void>(done => watcher.close(done));
    }
});

test.each([
    {sharing: "none", layers: [null, "isolated", "main"]},
    {sharing: "all", layers: ["shared-data"]},
    {sharing: "filtered", layers: ["shared-data", "main"]},
])("shares generated modules across the selected issuer layers: $sharing", async ({sharing, layers}) => {
    const plugin = new GenerateModulePlugin(modules);
    if (sharing === "all") plugin.layer("shared-data");
    if (sharing === "filtered") plugin.layer("shared-data", {not: ["main"]});
    const compiler = rspack({
        mode: "none",
        context: fixtures,
        target: "node",
        entry: {
            view: "./entry.js",
            isolated: {import: "./entry.js", layer: "isolated"},
            main: {import: "./entry.js", layer: "main"},
        },
        output: {path: directory, filename: "[name].js"},
        plugins: [plugin],
        optimization: {splitChunks: false},
    });
    compilers.add(compiler);
    const stats = await new Promise<Stats>((resolve, reject) => {
        compiler.run((error, result) => (error ? reject(error) : resolve(result!)));
    });
    expect(stats.hasErrors()).toBe(false);
    const built = [...stats.compilation.modules] as NormalModule[];
    for (const request of ["virtual/value", "virtual/tools"]) {
        const instances = built.filter(module => module.rawRequest === request);
        expect(instances).toHaveLength(layers.length);
        expect(new Set(instances.map(module => module.layer ?? null))).toEqual(new Set(layers));
    }
    expect(built.filter(module => module.rawRequest === "./entry.js")).toHaveLength(3);
    for (const entry of ["view", "isolated", "main"]) {
        const sandbox = {result: undefined as number | undefined};
        vm.runInNewContext(await fs.readFile(path.join(directory, `${entry}.js`), "utf8"), sandbox);
        expect(sandbox.result).toBe(6);
    }
});
