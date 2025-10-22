import path from "path";
import OptionFile from "../OptionFile";

jest.mock("../resolvers", () => jest.requireActual("../resolvers/tests/resolvers.mock"));

const fixtures = path.resolve(__dirname, "fixtures");

describe("background", () => {
    test("background with definition function", () => {
        const filename = path.join(fixtures, "background", "definition-only.ts");

        const options = OptionFile.make(filename)
            .setProperties(["persistent", "includeBrowser"])
            .setDefinition("defineBackground")
            .getOptions();

        expect(options).toEqual({
            persistent: true,
            includeBrowser: ["firefox"],
        });
    });

    test("background with default function and export properties", () => {
        const filename = path.join(fixtures, "background", "default-function.ts");

        const options = OptionFile.make(filename)
            .setProperties(["persistent", "excludeBrowser", "excludeApps"])
            .setDefinition("defineBackground")
            .getOptions();

        expect(options).toEqual({
            persistent: true,
            excludeBrowser: ["edge"],
            excludeApps: ["my_test_app"],
        });
    });

    test("background with combined definition and export properties", () => {
        const filename = path.join(fixtures, "background", "definition-with-named-exports.ts");

        const options = OptionFile.make(filename)
            .setProperties(["persistent", "excludeBrowser", "includeBrowser"])
            .setDefinition("defineBackground")
            .getOptions();

        expect(options).toEqual({
            persistent: true,
            excludeBrowser: ["edge"],
            includeBrowser: ["firefox"],
        });
    });

    test("background with default object and export properties", () => {
        const filename = path.join(fixtures, "background", "default-object.ts");

        const options = OptionFile.make(filename)
            .setProperties(["persistent", "excludeBrowser", "includeBrowser"])
            .setDefinition("defineBackground")
            .getOptions();

        expect(options).toEqual({
            persistent: true,
            excludeBrowser: ["opera"],
            includeBrowser: ["chrome"],
        });
    });

    test("background with default type name", () => {
        const filename = path.join(fixtures, "background", "default-object-assertion.ts");

        const options = OptionFile.make(filename)
            .setProperties(["persistent", "excludeBrowser", "includeBrowser"])
            .setDefinition("defineBackground")
            .getOptions();

        expect(options).toEqual({
            persistent: true,
            excludeBrowser: ["safari"],
            includeBrowser: ["chromium"],
        });
    });

    test("background with default satisfies", () => {
        const filename = path.join(fixtures, "background", "default-object-satisfies.ts");

        const options = OptionFile.make(filename)
            .setProperties(["persistent", "excludeBrowser", "includeBrowser"])
            .setDefinition("defineBackground")
            .getOptions();

        expect(options).toEqual({
            persistent: true,
            includeBrowser: ["chromium"],
        });
    });

    test("background with definition shorthand", () => {
        const filename = path.join(fixtures, "background", "definition-shorthand.ts");

        const options = OptionFile.make(filename)
            .setProperties(["permissions", "persistent", "excludeBrowser", "includeBrowser", "excludeApp"])
            .setDefinition("defineBackground")
            .getOptions();

        expect(options).toEqual({
            permissions: ["storage", "tabs"],
            persistent: true,
            excludeBrowser: ["edge"],
            includeBrowser: ["firefox"],
            excludeApp: ["my_test_app"],
        });
    });
});
