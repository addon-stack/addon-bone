import {getUrl} from "@addon-core/browser";

import ShadowFontRegistry from "./ShadowFontRegistry";

jest.mock("@addon-core/browser", () => ({
    getUrl: jest.fn((file: string) => `chrome-extension://fixture/${file}`),
}));

class FontFaceFixture {
    public static instances: FontFaceFixture[] = [];

    public static loadError?: Error;

    public readonly load = jest.fn(() =>
        FontFaceFixture.loadError ? Promise.reject(FontFaceFixture.loadError) : Promise.resolve(this)
    );

    public constructor(
        public readonly family: string,
        public readonly source: string,
        public readonly descriptors?: FontFaceDescriptors
    ) {
        FontFaceFixture.instances.push(this);
    }
}

describe("ShadowFontRegistry", () => {
    const add = jest.fn();

    beforeEach(() => {
        FontFaceFixture.instances = [];
        FontFaceFixture.loadError = undefined;
        add.mockReset();
        jest.clearAllMocks();
        Object.defineProperty(globalThis, "FontFace", {configurable: true, value: FontFaceFixture});
        Object.defineProperty(document, "fonts", {configurable: true, value: {add}});
    });

    test("registers each local definition once for the lifetime of the entry runtime", () => {
        const registry = new ShadowFontRegistry([
            {family: "AdnbnPanelInter", source: "assets/panel.woff2", weight: "400"},
            {family: "AdnbnPanelInter", source: "assets/panel.woff2", weight: "400"},
        ]);

        registry.register();
        registry.register();

        expect(FontFaceFixture.instances).toHaveLength(1);
        expect(FontFaceFixture.instances[0]).toMatchObject({
            family: "AdnbnPanelInter",
            source: 'url("chrome-extension://fixture/assets/panel.woff2")',
            descriptors: {weight: "400"},
        });
        expect(add).toHaveBeenCalledWith(FontFaceFixture.instances[0]);
        expect(FontFaceFixture.instances[0].load).toHaveBeenCalledTimes(1);
        expect(getUrl).toHaveBeenCalledWith("assets/panel.woff2");
    });

    test("reports a rejected font load without throwing into UI rendering", async () => {
        const error = new Error("font unavailable");
        const report = jest.spyOn(console, "error").mockImplementation(() => {});
        FontFaceFixture.loadError = error;
        const registry = new ShadowFontRegistry([{family: "BrokenFont", source: "assets/broken.woff2"}]);

        registry.register();
        await Promise.resolve();

        new ShadowFontRegistry([{family: "RemoteFont", source: "https://fonts.example/font.woff2"}]).register();

        expect(report).toHaveBeenCalledWith(
            'Loading shadow font "BrokenFont" from "assets/broken.woff2" failed',
            error
        );
        expect(report).toHaveBeenCalledWith(
            'Loading shadow font "RemoteFont" from "https://fonts.example/font.woff2" failed',
            expect.any(Error)
        );
        report.mockRestore();
    });
});
