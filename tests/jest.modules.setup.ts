jest.mock("@adnbn/browser", () => ({
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
