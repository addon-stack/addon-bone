import {changeSidebar, defineBackground, getSidebars, type SidebarAlias} from "adnbn";
import {
    canGetSidebarTitle,
    canSetSidebarIcon,
    canSetSidebarTitle,
    createTab,
    getActionTitle,
    getI18nMessage,
    getSidebarPath,
    getSidebarTitle,
    getUrl,
    removeTab,
    setSidebarTitle,
} from "@addon-core/browser";

interface ViewReport {
    kind: "sidebar-view";
    alias: string;
    documentTitle: string;
    propTitle?: string;
}

const views = new Map<string, (report: ViewReport) => void>();

const inspectView = async (alias: SidebarAlias) => {
    const report = new Promise<ViewReport>(resolve => views.set(alias, resolve));
    const tab = await createTab({url: getUrl(getSidebars().get(alias)!.path!), active: false});

    try {
        return await report;
    } finally {
        views.delete(alias);
        await removeTab(tab.id!);
    }
};

const readTitle = (tabId?: number) => (canGetSidebarTitle() ? getSidebarTitle(tabId) : null);

const inspect = async (tabId: number) => {
    const initial = await readTitle();
    const initialPath = await getSidebarPath();
    const translated = getI18nMessage("sidebar_account");
    const switches = [];

    for (const target of [undefined, tabId]) {
        if (canSetSidebarTitle()) {
            await setSidebarTitle("Keep this label", target);
        }

        const states = [];

        for (const alias of ["preserve", "settings", "empty", "missing", "sidebar"] as const) {
            await changeSidebar(alias, target);
            states.push({
                alias,
                title: await readTitle(target),
                path: await getSidebarPath(target),
                globalTitle: target === undefined ? null : await readTitle(),
                globalPath: target === undefined ? null : await getSidebarPath(),
            });
        }

        switches.push({target: target === undefined ? "global" : "tab", states});
    }

    return {
        canSetTitle: canSetSidebarTitle(),
        canGetTitle: canGetSidebarTitle(),
        canSetIcon: canSetSidebarIcon(),
        initial,
        initialPath,
        translated,
        switches,
        globalAfterTab: await readTitle(),
        globalPathAfterTab: await getSidebarPath(),
        toolbarTitle: await getActionTitle(),
        entries: Object.fromEntries(getSidebars()),
        views: [await inspectView("sidebar"), await inspectView("settings"), await inspectView("empty")],
    };
};

export default defineBackground({
    main() {
        chrome.runtime.onMessage.addListener((message, sender, respond) => {
            if (message.kind === "sidebar-view") {
                views.get(message.alias)?.(message);
                respond({ok: true});

                return;
            }

            if (message.kind === "inspect-sidebar") {
                const run = async () => {
                    try {
                        respond(await inspect(sender.tab!.id!));
                    } catch (error) {
                        respond({error: String(error)});
                    }
                };

                void run();

                return true;
            }
        });
    },
});
