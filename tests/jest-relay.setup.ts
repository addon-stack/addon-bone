const resolveScriptingResult = async (
    injection: Parameters<typeof chrome.scripting.executeScript>[0]
): Promise<chrome.scripting.InjectionResult<unknown>[]> => {
    const {func, target} = injection;

    if (!func) {
        return [];
    }

    const args = "args" in injection ? injection.args : [];
    const frameIds = target.allFrames ? [0, 2] : target.frameIds || [0];
    const documentIds = target.documentIds || [];
    const targets = documentIds.length
        ? documentIds.map(documentId => ({
              documentId,
              frameId: Number.parseInt(documentId.match(/\d+$/)?.[0] ?? "0", 10),
          }))
        : frameIds.map(frameId => ({frameId, documentId: `document-${frameId}`}));

    return Promise.all(
        targets.map(async target => ({
            ...target,
            result: await func(...args),
        }))
    );
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
