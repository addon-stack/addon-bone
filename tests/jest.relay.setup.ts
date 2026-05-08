import {RelayGlobalKey} from "../src/types/relay";

const resolveScriptingResult = async ({
    args,
}: chrome.scripting.ScriptInjection): Promise<chrome.scripting.InjectionResult[]> => {
    const [name, path, callArgs] = args || [];
    const relay = (globalThis as any)[RelayGlobalKey].get(name);
    const target = path?.split(".").reduce((acc: any, key: string) => acc?.[key], relay);
    const result = typeof target === "function" ? await target(...callArgs) : target;

    return [{result}];
};

chrome.scripting = {
    ...chrome.scripting,
    executeScript: jest.fn().mockImplementation((injection, callback) => {
        const result = resolveScriptingResult(injection);

        if (callback) {
            result.then(callback);
        }

        return result;
    }),
};

jest.mock("../src/relay/utils", () => ({
    isRelayContext: jest.fn(),
}));
