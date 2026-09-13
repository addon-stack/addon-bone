import {defineBackground, getIcons, getOffscreens, getPopups, getSandboxes, getSidebars} from "adnbn";

(globalThis as typeof globalThis & {readData: () => unknown}).readData = () => ({
    popup: Object.fromEntries(getPopups()),
    sidebar: Object.fromEntries(getSidebars()),
    offscreen: Object.fromEntries(getOffscreens()),
    sandbox: Object.fromEntries(getSandboxes()),
    icon: Object.fromEntries(getIcons()),
});

export default defineBackground({});
