import {getEntrypointAssetsMap, getEntrypointAssets} from "adnbn";
import {getUrl} from "adnbn/browser";

import styles from "./styles.module.css";

export type ProbeWorld = "ISOLATED" | "MAIN";

const FullGetterError = "getEntrypointAssetsMap() is available only in the background entrypoint";

export const createProbe = (world: ProbeWorld): HTMLElement => {
    const root = document.createElement("section");
    root.classList.add(styles.root);
    root.dataset.testid = `content-${world.toLowerCase()}`;
    root.dataset.world = world;
    root.dataset.frame = window === window.top ? "top" : "child";
    root.dataset.async = "pending";
    root.dataset.runs = "1";
    try {
        getUrl("/");
        root.dataset.publicPath = "extension";
    } catch (cause) {
        root.dataset.publicPath = `unavailable: ${cause instanceof Error ? cause.message : String(cause)}`;
    }

    try {
        const current = getEntrypointAssets();

        root.dataset.currentGetter = "ok";
        root.dataset.initialJs = String(current.initial.js.length);
        root.dataset.initialCss = String(current.initial.css.length);
        root.dataset.asyncJs = String(current.async.js.length);
        root.dataset.asyncCss = String(current.async.css.length);
    } catch (cause) {
        root.dataset.currentGetter = cause instanceof Error ? cause.message : String(cause);
    }

    try {
        getEntrypointAssetsMap();
        root.dataset.fullGetter = "unexpected";
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        root.dataset.fullGetter = message === FullGetterError ? "blocked" : message;
    }

    void import("./async")
        .then(module => {
            module.applyAsyncProbe(root);
            root.dataset.async = module.AsyncProbeValue;
        })
        .catch(cause => {
            root.dataset.async = `failed: ${cause instanceof Error ? cause.message : String(cause)}`;
            root.dataset.extensionResources = JSON.stringify(
                performance
                    .getEntriesByType("resource")
                    .map(entry => entry.name)
                    .filter(name => /^(chrome|moz)-extension:\/\//.test(name))
            );
        });

    return root;
};
