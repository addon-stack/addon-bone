import debounce from "debounce";

import type {ContentScriptWatchStrategy} from "@typing/content";

/** Create a debounced DOM-mutation strategy. Calling the returned strategy starts observing. */
// prettier-ignore
export const createMutationObserverStrategy =
    (options?: MutationObserverInit): ContentScriptWatchStrategy =>
        update => {
            if (!options) {
                options = {};
            }

            const handle = debounce(update, 200);

            const observer = new MutationObserver(handle);

            observer.observe(document.body ?? document.documentElement ?? document, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
                ...options,
            });

            return () => {
                handle.clear();
                observer.disconnect();
            };
        };

/** Observe DOM mutations while waiting for the first content nodes. */
// prettier-ignore
export const createAwaitFirstStrategy =
    (options?: MutationObserverInit): ContentScriptWatchStrategy =>
        (update, context) => {
            const resolver = createMutationObserverStrategy({
                attributes: false,
                characterData: false,
                ...options,
            });

            let unwatch: { (): void } | undefined;

            const clear = () => {
                unwatch && unwatch();
                unwatch = undefined;
            };

            if (context.nodes.size === 0) {
                unwatch = resolver(() => {
                    update();

                    if (context.nodes.size > 0) {
                        clear();
                    }
                }, context);
            }

            return () => {
                clear();
            };
        };

// prettier-ignore
export const withLocationTracking =
    (strategy: ContentScriptWatchStrategy): ContentScriptWatchStrategy =>
        (update, context) => {
            let currentUrl = location.href;

            const interval = setInterval(() => {
                if (currentUrl !== location.href) {
                    currentUrl = location.href;

                    context.mount();
                }
            }, 300);

            const unwatch = strategy(update, context);

            return () => {
                clearInterval(interval);
                unwatch();
            };
        };
