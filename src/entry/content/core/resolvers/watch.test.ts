import {contentScriptMutationObserverResolver} from "./watch";

describe("contentScriptMutationObserverResolver", () => {
    test("observes the document element before body exists", () => {
        const body = document.body;
        const observe = jest.spyOn(MutationObserver.prototype, "observe");

        body.remove();

        try {
            const unwatch = contentScriptMutationObserverResolver()(jest.fn(), {} as never);

            expect(observe).toHaveBeenCalledWith(
                document.documentElement,
                expect.objectContaining({childList: true, subtree: true})
            );

            unwatch();
        } finally {
            document.documentElement.append(body);
            observe.mockRestore();
        }
    });
});
