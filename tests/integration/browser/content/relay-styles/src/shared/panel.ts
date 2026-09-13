import "./host.css?asis";
import styles from "./panel.module.css?isolation";

export const createPanel = (kind: string) => {
    const panel = document.createElement("section");
    panel.dataset.relayPanel = kind;
    panel.className = styles.panel;
    panel.textContent = kind;
    return panel;
};

export const createApi = (getPanel: () => HTMLElement | undefined) => ({
    ready: () => !!getPanel()?.isConnected,
    async load() {
        const panel = getPanel();
        if (!panel) throw new Error("Panel is not mounted");
        const lazy = await import("./lazy");
        lazy.apply(panel);
        const view = panel.ownerDocument.defaultView!;
        const root = panel.getRootNode();
        return {
            color: view.getComputedStyle(panel).color,
            background: view.getComputedStyle(panel).backgroundColor,
            host: getComputedStyle(document.querySelector("#host-probe")!).borderTopWidth,
            isolated: panel.getRootNode() !== document,
            ...(root instanceof ShadowRoot ? {mode: root.mode, closed: root.host.shadowRoot === null} : {}),
        };
    },
});
