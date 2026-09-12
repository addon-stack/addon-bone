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
    const file = readModule(compiler, "virtual/value");
    await close(compiler);
    await expect(fs.access(file)).rejects.toMatchObject({code: "ENOENT"});
});

test("updates before compilation, skips unchanged sources and reports recoverable callback errors", async () => {
    let value = 3;
    let fail = false;
    const compiler = createCompiler(
        new GenerateModulePlugin(modules).watch(async () => {
            if (fail) throw new Error("Cannot generate module");
            return {"virtual/value": `export default ${value};`, "virtual/tools": modules["virtual/tools"]};
        })
    );
    expect(await run(compiler)).toBe(6);
    const file = readModule(compiler, "virtual/value");
    const tools = readModule(compiler, "virtual/tools");
    const timestamp = new Date("2000-01-01T00:00:00Z");
    await fs.utimes(file, timestamp, timestamp);
    await fs.utimes(tools, timestamp, timestamp);
    await compiler.hooks.watchRun.promise(compiler);
    expect((await fs.stat(file)).mtimeMs).toBe(timestamp.getTime());

    value = 7;
    await compiler.hooks.watchRun.promise(compiler);
    expect((await fs.stat(tools)).mtimeMs).toBe(timestamp.getTime());
    expect(await run(compiler)).toBe(14);

    fail = true;
    await compiler.hooks.watchRun.promise(compiler);
    await expect(run(compiler)).rejects.toThrow("Cannot generate module");
    expect(await fs.readFile(file, "utf8")).toBe("export default 7;");
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

test("isolates compilers with identical initial sources, updates and cleanup", async () => {
    const first = createCompiler(
        new GenerateModulePlugin(modules).watch(async () => ({"virtual/value": "export default 5;"})),
        "first"
    );
    const second = createCompiler(new GenerateModulePlugin(modules), "second");
    expect(readModule(first, "virtual/value")).not.toBe(readModule(second, "virtual/value"));
    await first.hooks.watchRun.promise(first);
    expect(await run(first)).toBe(10);
    expect(await run(second)).toBe(6);
    await close(first);
    expect(await run(second)).toBe(6);
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
