import RelayDriver from "./RelayDriver";

import RelayFinder from "@cli/entrypoint/finder/RelayFinder";

import type {ReadonlyConfig} from "@typing/config";
import type {EntrypointOptionsFinder} from "@typing/entrypoint";
import {EntrypointType} from "@typing/entrypoint";
import {ContentScriptDeclarative} from "@typing/content";
import {RelayAllFrames, type RelayEntrypointOptions, RelayMethod} from "@typing/relay";

class RelayFinderFixture extends RelayFinder {
    public constructor(private readonly optionFinder: EntrypointOptionsFinder<RelayEntrypointOptions>) {
        super({rootDir: process.cwd()} as ReadonlyConfig);
    }

    public plugin(): EntrypointOptionsFinder<RelayEntrypointOptions> {
        return this.optionFinder;
    }
}

describe("RelayDriver", () => {
    test.each([
        [true, true],
        [RelayAllFrames.Any, true],
        [RelayAllFrames.All, true],
        [false, false],
    ] as const)("adapts Relay allFrames %s to the content-script boolean", async (allFrames, expected) => {
        const file = {file: "collector.ts", import: "collector.ts"};
        const finder = new RelayFinderFixture({
            type: () => EntrypointType.Relay,
            options: async () =>
                new Map([
                    [
                        file,
                        {
                            name: "collector",
                            allFrames,
                        },
                    ],
                ]),
        } as EntrypointOptionsFinder<RelayEntrypointOptions>);

        const items = await new RelayDriver(finder).items();

        expect([...items.values()]).toEqual([
            {
                file,
                options: {
                    allFrames: expected,
                },
            },
        ]);
    });

    test("does not add content-script allFrames when Relay leaves it undefined", async () => {
        const file = {file: "collector.ts", import: "collector.ts"};
        const finder = new RelayFinderFixture({
            type: () => EntrypointType.Relay,
            options: async () => new Map([[file, {name: "collector"}]]),
        } as EntrypointOptionsFinder<RelayEntrypointOptions>);

        const items = await new RelayDriver(finder).items();

        expect([...items.values()]).toEqual([{file, options: {}}]);
    });

    test.each([
        [RelayMethod.Messaging, RelayAllFrames.All, ["webNavigation"], []],
        [undefined, RelayAllFrames.All, ["webNavigation"], []],
        [RelayMethod.Messaging, RelayAllFrames.Any, [], []],
        [RelayMethod.Messaging, true, [], []],
        [RelayMethod.Scripting, RelayAllFrames.All, [], []],
    ] as const)(
        "collects permissions for method %s and allFrames %s",
        async (method, allFrames, expected, expectedOptional) => {
            const driver = createDriver([
                {
                    name: "collector",
                    method,
                    allFrames,
                },
            ]);

            await expect(driver.permissions()).resolves.toEqual(new Set(expected));
            await expect(driver.optionalPermissions()).resolves.toEqual(new Set(expectedOptional));
        }
    );

    test.each([
        [ContentScriptDeclarative.Required, ["scripting"], []],
        [true, ["scripting"], []],
        [ContentScriptDeclarative.Optional, [], ["scripting"]],
        [false, [], []],
    ] as const)(
        "classifies scripting permission for declarative %s",
        async (declarative, expected, expectedOptional) => {
            const driver = createDriver([
                {
                    name: "collector",
                    method: RelayMethod.Scripting,
                    declarative,
                },
            ]);

            await expect(driver.permissions()).resolves.toEqual(new Set(expected));
            await expect(driver.optionalPermissions()).resolves.toEqual(new Set(expectedOptional));
        }
    );

    test("keeps scripting optional when an unrelated messaging Relay is required", async () => {
        const driver = createDriver([
            {
                name: "messenger",
                method: RelayMethod.Messaging,
                declarative: ContentScriptDeclarative.Required,
            },
            {
                name: "injector",
                method: RelayMethod.Scripting,
                declarative: ContentScriptDeclarative.Optional,
            },
        ]);

        await expect(driver.permissions()).resolves.toEqual(new Set());
        await expect(driver.optionalPermissions()).resolves.toEqual(new Set(["scripting"]));
    });

    test("required scripting permission takes precedence over optional", async () => {
        const driver = createDriver([
            {
                name: "optional",
                method: RelayMethod.Scripting,
                declarative: ContentScriptDeclarative.Optional,
            },
            {
                name: "required",
                method: RelayMethod.Scripting,
                declarative: ContentScriptDeclarative.Required,
            },
        ]);

        await expect(driver.permissions()).resolves.toEqual(new Set(["scripting"]));
        await expect(driver.optionalPermissions()).resolves.toEqual(new Set());
    });
});

const createDriver = (options: RelayEntrypointOptions[]): RelayDriver => {
    const finder = new RelayFinderFixture({
        type: () => EntrypointType.Relay,
        options: async () =>
            new Map(options.map((relay, index) => [{file: `relay-${index}.ts`, import: `relay-${index}.ts`}, relay])),
    } as EntrypointOptionsFinder<RelayEntrypointOptions>);

    return new RelayDriver(finder);
};
