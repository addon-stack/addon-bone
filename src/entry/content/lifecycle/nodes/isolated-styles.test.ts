import {jest} from "@jest/globals";

jest.unstable_mockModule("#adnbn/runtime", () => ({readContentStyles: jest.fn()}));

const {getUrl} = await import("@addon-core/browser");
const {readContentStyles} = await import("#adnbn/runtime");
const {getContentScriptStylesRuntime} = await import("./isolated-styles");

import type {ContentScriptStylesRuntime} from "@typing/content";

beforeEach(() => {
    jest.resetAllMocks();
});

test("reports an unavailable styles runtime", () => {
    expect(() => getContentScriptStylesRuntime()).toThrow(
        "Isolated styles runtime is unavailable in this content entrypoint"
    );
});

test("initializes and returns the styles runtime supplied by the facade", () => {
    const runtime: ContentScriptStylesRuntime = {
        initialize: jest.fn(),
        add: jest.fn(),
        ready: jest.fn(async () => undefined),
        delete: jest.fn(),
        load: jest.fn<(url: string) => Promise<void>>(),
    };

    jest.mocked(readContentStyles).mockReturnValue(runtime);

    expect(getContentScriptStylesRuntime()).toBe(runtime);
    expect(runtime.initialize).toHaveBeenCalledWith(getUrl);
    expect(getUrl("style.css")).toBe(`chrome-extension://${chrome.runtime.id}/style.css`);
    expect(runtime.add).not.toHaveBeenCalled();
});
