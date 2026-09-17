import {defineContentScript, defineContentScriptAppend} from "adnbn";
import {
    createMutationObserverStrategy,
    createAwaitFirstStrategy,
    ContentScriptEvent,
    type ContentScriptWatchStrategy,
    type ContentScriptContext,
    type ContentScriptEventCallback,
    type ContentScriptNode,
} from "adnbn/content";

const watch: ContentScriptWatchStrategy = createMutationObserverStrategy({
    attributes: true,
    attributeFilter: ["class"],
});

const callback: ContentScriptEventCallback = (event, node) => {
    const contentNode: ContentScriptNode = node;
    const rootEvent: import("adnbn").ContentScriptEvent = event;

    if (rootEvent === ContentScriptEvent.Mount) {
        contentNode.container?.setAttribute("data-mounted", "true");
    }
};

defineContentScript({
    watch,
    render: () => "Content",
    main: (context: ContentScriptContext) => {
        const unsubscribe: () => void = context.watch(callback);
        unsubscribe();
        context.unwatch();
    },
});

defineContentScriptAppend({watch: createAwaitFirstStrategy({attributes: true}), render: () => "Content"});

const custom: ContentScriptWatchStrategy = (update, context) => {
    const observer = new MutationObserver(records => {
        if (records.some(record => !context.owns(record.target))) {
            void update();
        }
    });
    observer.observe(document.body, {childList: true});
    const unsubscribe = context.watch(callback);

    return () => {
        observer.disconnect();
        unsubscribe();
    };
};

defineContentScript({watch: custom});

// @ts-expect-error: Mutation observation uses the platform's typed options.
createMutationObserverStrategy({attributeFilter: [1]});

// @ts-expect-error: Every custom context must implement the public membership query.
const missingOwnership: ContentScriptContext = {
    nodes: new Set(),
    mount() {},
    unmount() {},
    watch: () => () => {},
    unwatch() {},
};

const customContext: ContentScriptContext = {
    ...missingOwnership,
    owns: (_target: Node): boolean => false,
};
const owned: boolean = customContext.owns(document.createTextNode("UI"));
