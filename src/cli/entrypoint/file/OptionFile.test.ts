import path from "path";
jest.mock("./resolvers", () => require("./resolvers/tests/resolvers.mock"));
import OptionFile from "./OptionFile";

const fixtures = path.resolve(__dirname, "tests", "fixtures");

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
});
