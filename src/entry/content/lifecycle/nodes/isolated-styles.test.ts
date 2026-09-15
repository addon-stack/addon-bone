import {getUrl} from "@addon-core/browser";
import {readContentStyles} from "#adnbn/runtime";

import type {ContentScriptStylesRuntime} from "@typing/content";

import {getContentScriptStylesRuntime} from "./isolated-styles";

jest.mock("#adnbn/runtime", () => ({readContentStyles: jest.fn()}));
jest.mock("@addon-core/browser", () => ({getUrl: jest.fn()}));

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
        delete: jest.fn(),
        load: jest.fn(),
    };

    jest.mocked(readContentStyles).mockReturnValue(runtime);

    expect(getContentScriptStylesRuntime()).toBe(runtime);
    expect(runtime.initialize).toHaveBeenCalledWith(getUrl);
    expect(runtime.add).not.toHaveBeenCalled();
});
