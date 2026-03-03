import {ConfigBuilder} from "./ConfigBuilder";

describe("TypeScript ConfigBuilder", () => {
    let cfg: ReturnType<typeof ConfigBuilder.from>;

    beforeEach(() => {
        cfg = ConfigBuilder.from();
    });

    it("sets and gets nested value", () => {
        cfg.set("compilerOptions.target", "esnext");

        expect(cfg.get("compilerOptions.target")).toBe("esnext");
    });

    it("creates missing nested objects on set", () => {
        cfg.set("compilerOptions.strict", true);

        expect(cfg.get("compilerOptions")).toEqual({
            strict: true,
        });
    });

    it("supports creating multiple nested properties across different paths", () => {
        cfg.set("compilerOptions.types", ["jest"]);
        cfg.set("compilerOptions.lib", ["es2020"]);

        expect(cfg.get("compilerOptions")).toEqual({
            types: ["jest"],
            lib: ["es2020"],
        });
    });

    it("returns undefined for a non-existing path", () => {
        expect(cfg.get("compilerOptions.module")).toBeUndefined();
    });

    it("has() returns true for an existing path", () => {
        cfg.set("compilerOptions.strict", true);

        expect(cfg.has("compilerOptions.strict")).toBe(true);
    });

    it("has() returns false for a non-existing path", () => {
        expect(cfg.has("compilerOptions.module")).toBe(false);
    });

    it("deletes a nested property", () => {
        cfg.set("compilerOptions.module", "commonjs");
        cfg.delete("compilerOptions.module");

        expect(cfg.get("compilerOptions.module")).toBeUndefined();
    });

    it("delete does nothing for non-existing path", () => {
        expect(() => cfg.delete("compilerOptions.module")).not.toThrow();
    });

    it("set/delete/merge/raw return the builder instance for chaining", () => {
        const a = cfg.set("compilerOptions.target", "esnext");
        const b = cfg.delete("compilerOptions.baseUrl");
        const c = cfg.merge({include: ["src/**/*.ts"]});
        const d = cfg.raw({compilerOptions: {strict: true}});
        expect(a).toBe(cfg);
        expect(b).toBe(cfg);
        expect(c).toBe(cfg);
        expect(d).toBe(cfg);
    });

    it("deep-merges objects without removing existing keys", () => {
        cfg.set("compilerOptions.target", "esnext");

        cfg.merge({
            compilerOptions: {
                strict: true,
            },
        });

        expect(cfg.get()).toEqual({
            compilerOptions: {
                target: "esnext",
                strict: true,
            },
        });
    });

    it("overwrites arrays on merge", () => {
        cfg.merge({
            include: ["src/**/*.ts"],
        });

        cfg.merge({
            include: ["tests/**/*.ts"],
        });

        expect(cfg.get("include")).toEqual(["tests/**/*.ts"]);
    });

    it("raw() behaves like merge()", () => {
        cfg.raw({
            compilerOptions: {
                module: "commonjs",
            },
        });

        expect(cfg.get("compilerOptions.module")).toBe("commonjs");
    });

    it("from(initial) clones the initial object (no shared references)", () => {
        const initial = {compilerOptions: {target: "es5"}} as any;
        const local = ConfigBuilder.from(initial);

        (initial as any).compilerOptions.target = "es3";
        expect(local.get("compilerOptions.target")).toBe("es5");

        local.set("compilerOptions.module", "commonjs");
        expect((initial as any).compilerOptions.module).toBeUndefined();
    });

    it("get() returns a deep-cloned read-only snapshot", () => {
        cfg.set("compilerOptions.target", "esnext");

        const snapshot = cfg.get();

        expect(snapshot).toEqual({
            compilerOptions: {
                target: "esnext",
            },
        });
    });

    it("mutating the snapshot does not affect internal state", () => {
        cfg.set("compilerOptions.target", "esnext");

        const snapshot = cfg.get();

        try {
            (snapshot as any).compilerOptions.target = "es5";
        } catch {}

        expect(cfg.get("compilerOptions.target")).toBe("esnext");
    });

    it("toJSON returns a JSON string of the current config", () => {
        cfg.set("compilerOptions.target", "esnext");

        const json = cfg.toJSON();

        expect(typeof json).toBe("string");
        expect(json).toBe(
            JSON.stringify({
                compilerOptions: {target: "esnext"},
            })
        );
    });

    it("set overwrites a primitive value with an object when needed", () => {
        cfg.set("compilerOptions", {} as any);
        cfg.set("compilerOptions.strict", true);

        expect(cfg.get("compilerOptions.strict")).toBe(true);
    });

    it("delete removes only the targeted leaf, preserving siblings", () => {
        cfg.set("compilerOptions.target", "esnext");
        cfg.set("compilerOptions.strict", true);

        cfg.delete("compilerOptions.target");

        expect(cfg.get()).toEqual({
            compilerOptions: {
                strict: true,
            },
        });
    });

    it("merge does not remove existing keys (idempotent addition)", () => {
        cfg.set("compilerOptions.target", "esnext");

        cfg.merge({
            compilerOptions: {
                strict: true,
            },
        });

        expect(cfg.get("compilerOptions.target")).toBe("esnext");
    });
});
