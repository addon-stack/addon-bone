type MessageSender = chrome.runtime.MessageSender;

type MessageListener = (...args: any[]) => boolean | void;

const listeners = new Set<MessageListener>();

chrome.runtime.onMessage.addListener = jest.fn((callback: MessageListener) => listeners.add(callback));
chrome.runtime.onMessage.removeListener = jest.fn((callback: MessageListener) => listeners.delete(callback));
chrome.runtime.onMessage.hasListeners = jest.fn(() => listeners.size > 0);

const dispatch = (message: unknown, sender: MessageSender, callback?: (response: any) => void): void => {
    let called = false;
    let asynchronous = false;

    for (const listener of listeners) {
        const result = listener(message, sender, (response: any) => {
            if (called) return;

            called = true;
            callback?.(response);
        });

        asynchronous ||= result === true;
    }

    if (!asynchronous && !called) {
        callback?.(undefined);
    }
};

chrome.runtime.sendMessage = jest.fn().mockImplementation((message, callback) => {
    dispatch(message, {} as MessageSender, callback);
});

chrome.tabs.sendMessage = jest.fn().mockImplementation((tabId, message, options, callback) => {
    dispatch(message, {} as MessageSender, callback);
});
