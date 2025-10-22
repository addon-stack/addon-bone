import path from "path";
jest.mock("./resolvers", () => jest.requireActual("./resolvers/tests/resolvers.mock"));
import ExpressionFile from "./ExpressionFile";

const fixtures = path.resolve(__dirname, "tests", "fixtures", "expression");

describe("ExpressionFile", () => {
    describe("Class Exports", () => {
        describe("Basic Class Factories", () => {
            test("class factory function returning class instance", () => {
                const filename = path.join(fixtures, "class-exports", "basic", "class-factory-function.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ bar: string; getBar(): string; setBar(bar: string): void; }");
            });

            test("class factory returning inline class instance", () => {
                const filename = path.join(fixtures, "class-exports", "basic", "class-factory-inline.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ bar: string; getBar(): string; setBar(bar: string): this; }");
            });

            test("class factory with inline anonymous class", () => {
                const filename = path.join(fixtures, "class-exports", "basic", "class-factory-inline.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ bar: string; getBar(): string; setBar(bar: string): this; }");
            });

            test("class factory exported as const", () => {
                const filename = path.join(fixtures, "class-exports", "basic", "class-factory-const.ts");

                const type = ExpressionFile.make(filename).setProperty("init").getType();

                expect(type).toBe("{ bar: string; getBar(): string; setBar(bar: string): void; }");
            });

            test("class with underscore members should exclude them", () => {
                const filename = path.join(fixtures, "class-exports", "basic", "class-with-underscore-members.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ publicProp: string; visibleParam: string; publicMethod(): void; }");
            });
        });

        describe("Extended Class Factories", () => {
            test("factory returning extended class instance", () => {
                const filename = path.join(fixtures, "class-exports", "extended", "extended-class-factory.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ name: string; version: number; getUsersMap(): Record<string, {name: string}>; getServiceInfo(): {name: string, version: number}; fetchData<T>(endpoint: string): Promise<T>; isInitialized(): boolean; getUserRoute(): string; fetchUserData<T>(endpoint: string): Promise<T>; }"
                );
            });

            test("factory returning default-exported extended class", () => {
                const filename = path.join(fixtures, "class-exports", "extended", "default-extended-class-factory.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ name: string; age: number; getInfo(): string; updateAge(newAge: number): void; id(): number; getUserName(): string; }"
                );
            });
        });
    });

    describe("Type Patterns", () => {
        describe("Chrome API Types", () => {
            test("class with Chrome API type references", () => {
                const filename = path.join(fixtures, "type-patterns", "chrome-types", "class-with-chrome-api.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ create(properties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>; get(): Promise<chrome.tabs.Tab[]>; tab(): chrome.tabs.Tab | undefined; remove(tabId: number): Promise<void>; update(tab: chrome.tabs.Tab, properties: chrome.tabs.CreateProperties): Promise<void>; captureInfo(): chrome.tabCapture.CaptureInfo; }"
                );
            });
        });

        describe("Complex Type Patterns", () => {
            test("class with empty interface and type properties", () => {
                const filename = path.join(fixtures, "type-patterns", "complex-types", "object-with-empty-type.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ foo: {}; bar: {}; }");
            });

            test("class with index signature type", () => {
                const filename = path.join(fixtures, "type-patterns", "complex-types", "class-with-index-signature.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ get(): {[domain: string]: number;}; }");
            });

            test("class with separate type definitions", () => {
                const filename = path.join(fixtures, "type-patterns", "complex-types", "class-with-separate-types.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ getBar(): {bar: string;}; getBarWithFoo(): {bar: string; foo: string;}; }");
            });

            test("class with complex argument and return types", () => {
                const filename = path.join(fixtures, "type-patterns", "complex-types", "class-with-complex-args.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ set(name: string, a: {foo: string; bar: number;}): {baz?: string; qux?: number;}; }"
                );
            });

            test("class using imported types from local modules", () => {
                const filename = path.join(fixtures, "type-patterns", "complex-types", "class-with-imported-types.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ getUserInfo(): {id: number; name: string;}; getUserDetails(): {id: number; name: string; address?: string; age?: number; data?: {reg: number; log: number;};}; getUserAndDetails(): {id: number; name: string; address?: string; age?: number; data?: {reg: number; log: number;};}; }"
                );
            });
        });

        describe("External Library Types", () => {
            test("class with external library type imports", () => {
                const filename = path.join(fixtures, "type-patterns", "external-types", "class-with-external-types.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ extra: import('somelib').ExtraType; getExtra(): import('somelib').ExtraType; setExtra(extra: import('somelib').ExtraType): void; }"
                );
            });

            test("class with external library types using type import", () => {
                const filename = path.join(
                    fixtures,
                    "type-patterns",
                    "external-types",
                    "class-with-external-types-alt.ts"
                );

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ extra: import('somelib').ExtraType; getExtra(): import('somelib').ExtraType; setExtra(extra: import('somelib').ExtraType): void; }"
                );
            });

            test("class with external library types using import type and init export", () => {
                const filename = path.join(
                    fixtures,
                    "type-patterns",
                    "external-types",
                    "class-with-external-types-init.ts"
                );

                const type = ExpressionFile.make(filename).setProperty("init").getType();

                expect(type).toBe(
                    "{ extra: import('somelib').ExtraType; getExtra(): import('somelib').ExtraType; setExtra(extra?: import('somelib').ExtraType): void; }"
                );
            });

            test("class with optional external library types", () => {
                const filename = path.join(
                    fixtures,
                    "type-patterns",
                    "external-types",
                    "class-with-external-types-optional.ts"
                );

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ extraProperty: import('somelib').ExtraType | undefined; someExtraProperty?: import('somelib').ExtraType; getExtraProperty(): import('somelib').ExtraType | undefined; setExtraProperty(extra: import('somelib').ExtraType | undefined): void; }"
                );
            });
        });
    });

    describe("Object Exports", () => {
        describe("Factory Functions", () => {
            test("object factory returning inline object", () => {
                const filename = path.join(fixtures, "object-exports", "factory-functions", "object-factory-inline.ts");

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ foo: string; getFoo(): string; setFoo(foo: string): void; }");
            });

            test("object factory returning inline object as interface", () => {
                const filename = path.join(
                    fixtures,
                    "object-exports",
                    "factory-functions",
                    "object-factory-interface.ts"
                );

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ getFoo(): string | undefined; setFoo(foo: string): void; }");
            });

            test("object factory returning variable-defined object", () => {
                const filename = path.join(
                    fixtures,
                    "object-exports",
                    "factory-functions",
                    "object-factory-variable.ts"
                );

                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ getName(): string; getAge(): any; getAddress(): any; getPhone(): any; getEmail(): any; }"
                );
            });
        });

        describe("Literal Objects", () => {
            test("literal object with const assertion", () => {
                const filename = path.join(fixtures, "object-exports", "literals", "literal-with-assertion.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ foo: string; getFoo(): string; }");
            });

            test("literal object with satisfies type expression", () => {
                const filename = path.join(fixtures, "object-exports", "literals", "literal-with-satisfies.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ foo: string; getFoo(): any; }");
            });

            test("object with underscore properties should exclude them", () => {
                const filename = path.join(fixtures, "object-exports", "literals", "object-with-underscore-props.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ publicProp: string; publicMethod(): string; }");
            });
        });

        describe("Property Extraction", () => {
            const filename = path.join(fixtures, "object-exports", "literals", "literal-with-properties.ts");

            test("extract string property from literal", () => {
                const type = ExpressionFile.make(filename).setProperty("str").getType();

                expect(type).toBe("string");
            });

            test("extract number property from literal", () => {
                const type = ExpressionFile.make(filename).setProperty("num").getType();

                expect(type).toBe("number");
            });

            test("extract method property from literal", () => {
                const type = ExpressionFile.make(filename).setProperty("greet").getType();

                expect(type).toBe("(s: string) => string");
            });

            test("nonexistent property returns undefined", () => {
                const type = ExpressionFile.make(filename).setProperty("other").getType();

                expect(type).toBeUndefined();
            });
        });

        describe("Init Method Objects", () => {
            test("object with init method returning class instance", () => {
                const filename = path.join(
                    fixtures,
                    "object-exports",
                    "with-init-methods",
                    "literal-with-init-class.ts"
                );
                const type = ExpressionFile.make(filename).setProperty("init").getType();

                expect(type).toBe("{ bar: string; getBar(): string; }");
            });

            test("object with init method returning nested object", () => {
                const filename = path.join(
                    fixtures,
                    "object-exports",
                    "with-init-methods",
                    "literal-with-init-object.ts"
                );
                const type = ExpressionFile.make(filename).setProperty("init").getType();

                expect(type).toBe("{ some(): string; num: number; }");
            });

            test("object with define function and init method returning nested object", () => {
                const filename = path.join(
                    fixtures,
                    "object-exports",
                    "with-init-methods",
                    "literal-with-define-init-object.ts"
                );
                const type = ExpressionFile.make(filename).setDefinition("defineService").setProperty("init").getType();

                expect(type).toBe("{ ping(): Promise<void>; }");
            });
        });
    });

    describe("Wrappers", () => {
        describe("Service Definitions", () => {
            test("service definition with function instance", () => {
                const filename = path.join(fixtures, "wrappers", "service-definitions", "service-definition-basic.ts");

                const type = ExpressionFile.make(filename).setDefinition("defineService").getType();

                expect(type).toBe("{ persistent: boolean; name: string; init(): any; }");
            });

            test("service definition with parentheses wrapping", () => {
                const filename = path.join(
                    fixtures,
                    "wrappers",
                    "service-definitions",
                    "service-definition-with-parens.ts"
                );

                const type = ExpressionFile.make(filename).setDefinition("defineService").getType();

                expect(type).toBe("{ persistent: boolean; name: string; init(): any; }");
            });

            test("service definition with no arguments returns undefined", () => {
                const filename = path.join(
                    fixtures,
                    "wrappers",
                    "service-definitions",
                    "service-definition-no-args.ts"
                );

                const type = ExpressionFile.make(filename).setDefinition("defineService").getType();

                expect(type).toBeUndefined();
            });

            test("service definition with alias import", () => {
                const filename = path.join(
                    fixtures,
                    "wrappers",
                    "service-definitions",
                    "service-definition-with-alias.ts"
                );

                const type = ExpressionFile.make(filename).setDefinition("svc").getType();

                expect(type).toBe("{ persistent: boolean; name: string; init(): any; }");
            });
        });

        describe("Function Wrappers", () => {
            test("external wrapper function should be ignored", () => {
                const filename = path.join(fixtures, "wrappers", "function-wrappers", "external-wrapper-function.ts");

                const type = ExpressionFile.make(filename).setProperty("init").setDefinition("fakeWrapper").getType();

                expect(type).toBeUndefined();
            });
        });
    });

    describe("JSDoc Type Support", () => {
        describe("Class JSDoc Types", () => {
            test("class with JSDoc property type annotations", () => {
                const filename = path.join(fixtures, "jsdoc-types", "class", "class-with-jsdoc-properties.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ id: number; roles: string[]; name: { firstName: string; lastName: string; }; }");
            });

            test("class with JSDoc method parameter and return type annotations", () => {
                const filename = path.join(fixtures, "jsdoc-types", "class", "class-with-jsdoc-methods.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ fetchData(endpoint: string, options: {method: string; cache: boolean;}): Promise<Array<Object>>; isConnected(): boolean; }"
                );
            });
        });

        describe("Object JSDoc Types", () => {
            test("object factory with JSDoc property and method annotations", () => {
                const filename = path.join(fixtures, "jsdoc-types", "object", "object-factory-with-jsdoc.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ timeout: number; allowedDomains: string[]; isValidDomain(domain: string): boolean; }"
                );
            });

            test("object with JSDoc method parameter and return type annotations", () => {
                const filename = path.join(fixtures, "jsdoc-types", "object", "object-with-jsdoc-methods-factory.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe("{ add(a: string, b: string): string; counts: Map<string, number>; }");
            });
        });

        describe("Service JSDoc Types", () => {
            test("service with JSDoc property and method annotations", () => {
                const filename = path.join(fixtures, "jsdoc-types", "function", "service-with-jsdoc.ts");
                const type = ExpressionFile.make(filename).setDefinition("defineService").setProperty("init").getType();

                expect(type).toBe(
                    "{ get(key: string, defaultValue: any): string; set(key: string, value: string): void; }"
                );
            });
        });

        describe("Inheritance JSDoc Types", () => {
            test("extended class with JSDoc annotations overriding base class", () => {
                const filename = path.join(fixtures, "jsdoc-types", "inheritance", "extended-class-with-jsdoc.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ name: string; getResource(userId: string): Promise<{name: string; email: string;}>; cache: Map<string, Object>; }"
                );
            });
        });

        describe("Complex JSDoc Types", () => {
            test("class with complex JSDoc type annotations", () => {
                const filename = path.join(fixtures, "jsdoc-types", "complex", "complex-jsdoc-types-factory.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ mixedArray: (string|number)[]; counts: Object<string, number>; process<T>(data: T, transformer: function(T): any): Promise<T>; search(options: {query: string; limit?: number; caseSensitive?: boolean;}): string[]; }"
                );
            });
        });

        describe("Import JSDoc Types", () => {
            test("class with JSDoc import type annotations", () => {
                const filename = path.join(fixtures, "jsdoc-types", "imports", "class-with-import-types.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ config: import(\"external-lib\").ConfigType; initialize(options: import('external-lib').InitOptions): Promise<import('external-lib').ServiceInstance>; processData<T>(data: import('external-lib').DataInput<T>, options: import('external-lib').ProcessorOptions): Promise<import('external-lib').ProcessedResult<T>>; }"
                );
            });

            test("object with JSDoc import type annotations", () => {
                const filename = path.join(fixtures, "jsdoc-types", "imports", "object-with-import-types.ts");
                const type = ExpressionFile.make(filename).getType();

                expect(type).toBe(
                    "{ settings: import('external-lib').Settings; configure(config: import('external-lib').ConfigParams): import('external-lib').ConfigResult; validate<T>(input: import('external-lib').ValidationInput<T>): import('external-lib').ValidationResult<T>; }"
                );
            });
        });
    });
});
