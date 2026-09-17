import type {ContentScriptWatchStrategy} from "@typing/content";

/** Batch DOM mutations in a fixed window. Calling the returned strategy starts observing. */
// prettier-ignore
export const createMutationObserverStrategy =
    (options?: MutationObserverInit): ContentScriptWatchStrategy =>
        (update, context) => {
            let timer: ReturnType<typeof setTimeout> | undefined;

            const observer = new MutationObserver(records => {
                if (timer !== undefined || !records.some(record => !context.owns(record.target))) {
                    return;
                }

                timer = setTimeout(() => {
                    timer = undefined;
                    void update();
                }, 200);
            });

            observer.observe(document.body ?? document.documentElement ?? document, {
                childList: true,
                subtree: true,
                ...options,
            });

            return () => {
                clearTimeout(timer);
                timer = undefined;
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
            let pending: Promise<void> | undefined;

            const clear = () => {
                unwatch && unwatch();
                unwatch = undefined;
                pending = undefined;
            };

            if (context.nodes.size === 0) {
                unwatch = resolver(() => {
                    const completion = Promise.resolve(update());

                    if (completion === pending) {
                        return completion;
                    }

                    pending = completion;

                    return completion.then(() => {
                        if (context.nodes.size > 0) {
                            clear();
                        }
                    }).finally(() => {
                        if (pending === completion) {
                            pending = undefined;
                        }
                    });
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

                    try {
                        context.mount();
                    } catch (error) {
                        console.error("Content script mount on location change failed", error);
                    }
                }
            }, 300);

            const unwatch = strategy(update, context);

            return () => {
                clearInterval(interval);
                unwatch();
            };
        };
