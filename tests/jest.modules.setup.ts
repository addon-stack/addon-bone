jest.mock("@addon-core/browser", () => ({
    __esModule: true,

    throwRuntimeError: jest.fn(),
    getManifestVersion: jest.fn(),
    isAvailableScripting: jest.fn(),

    browser: jest.fn(() => chrome),
    isManifestVersion3: jest.fn(() => true),

    hasOffscreen: jest.fn(),
    closeOffscreen: jest.fn(),
    createOffscreen: jest.fn(),

    containsPermissions: jest.fn(() => true),
    requestPermissions: jest.fn(() => true),

    executeScript: chrome.scripting.executeScript,

    sendMessage: (msg: any) => {
        return new Promise(resolve => {
            chrome.runtime.sendMessage(msg, (response: any) => {
                resolve(response);
            });
        });
    },

    sendTabMessage: (tabId: number, msg: any, options: any) => {
        return new Promise(resolve => {
            chrome.tabs.sendMessage(tabId, msg, options, (response: any) => {
                resolve(response);
            });
        });
    },

    onMessage: (callback: any) => {
        chrome.runtime.onMessage.addListener(callback);
        return () => chrome.runtime.onMessage.removeListener(callback);
    },
}));

jest.mock("nanoid", () => ({
    nanoid: jest.fn(() => "mocked-id"),
}));

jest.mock("nanoid/non-secure", () => ({
    nanoid: jest.fn(() => "mocked-id"),
}));

jest.mock(
    "@addon-core/storage",
    () => {
        type Unsubscribe = () => void;
        type WatchMap = Record<string, (value: any) => void>;

        const createMockStorage = () => {
            const store = new Map<string, any>();
            let watchers: WatchMap = {};

            const get = jest.fn(async (key: string) => store.get(key));
            const set = jest.fn(async (key: string, value: any) => {
                store.set(key, value);
                const cb = watchers[key];
                if (cb) cb(value);
            });
            const watch = jest.fn((map: WatchMap): Unsubscribe => {
                watchers = map;
                return () => {
                    watchers = {};
                };
            });

            return {get, set, watch};
        };

        return {
            __esModule: true,
            Storage: {
                Local: () => createMockStorage(),
                Sync: () => createMockStorage(),
                Session: () => createMockStorage(),
            },
        };
    },
    {virtual: true}
);
