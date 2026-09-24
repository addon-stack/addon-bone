import {createTab, getTab, removeTab, queryTabs, onTabUpdated} from "adnbn/browser";
import {defineBackground, getRelay, RelayAllFrames} from "adnbn";

const errorDetails = (error: unknown) => {
    if (error instanceof Error) {
        return {name: error.name, message: error.message};
    }

    throw error;
};

export default defineBackground({
    main() {
        const started = new Set<number>();
        const run = (tabId: number, url?: string) => {
            if (!url?.startsWith("http://127.0.0.1:") || !url.endsWith("/top.html") || started.has(tabId)) {
                return;
            }

            started.add(tabId);

            void (async () => {
                const relay = getRelay("probe", tabId);

                await relay.ready();

                const empty = await relay.empty();
                const nullable = await relay.nullable();
                const thrown = await relay.fail().catch(errorDetails);
                const rejected = await relay.reject().catch(errorDetails);
                const emptyUrl = url.replace("/top.html", "/empty.html");
                const blank = await createTab({url: emptyUrl, active: true});

                try {
                    const deadline = Date.now() + 10000;

                    while (true) {
                        const current = await getTab(blank.id!);

                        if (current.status === "complete" && current.url === emptyUrl) {
                            break;
                        }

                        if (Date.now() >= deadline) {
                            throw new Error("Empty Relay target did not finish navigation");
                        }

                        await new Promise(resolve => setTimeout(resolve, 20));
                    }

                    const any = await getRelay("probe", {tabId: blank.id!, allFrames: RelayAllFrames.Any}).ready();
                    const missing = await getRelay("probe", blank.id!).ready().catch(errorDetails);

                    await relay.report({
                        empty: empty === undefined,
                        nullable: nullable === null,
                        thrown,
                        rejected,
                        any: any.map(outcome =>
                            outcome.status === "rejected"
                                ? {
                                      status: outcome.status,
                                      kind: outcome.error.kind,
                                      name: outcome.error.name,
                                      message: outcome.error.message,
                                  }
                                : {status: outcome.status}
                        ),
                        missing,
                    });
                } finally {
                    await removeTab(blank.id!);
                }
            })().catch(async error => {
                await getRelay("probe", tabId)
                    .report({error: String(error)})
                    .catch(() => {});
                console.error("Relay scripting probe failed", error);
            });
        };

        onTabUpdated((tabId, change, tab) => {
            if (change.status === "complete") {
                run(tabId, tab.url);
            }
        });
        void queryTabs({}).then(tabs => {
            for (const tab of tabs) {
                if (tab.id !== undefined) {
                    run(tab.id, tab.url);
                }
            }
        });
    },
});
