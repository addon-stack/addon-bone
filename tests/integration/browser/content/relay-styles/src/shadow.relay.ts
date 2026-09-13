import {ContentScriptShadowMode, defineRelay, type ContentScriptIsolationOptions} from "adnbn";
import {createPanel, createApi} from "./shared/panel";
let panel: HTMLElement | undefined;
let isolation: ContentScriptIsolationOptions | undefined;
const api = createApi(() => panel);
export default defineRelay({
    name: "shadowPanel",
    matches: ["http://127.0.0.1/*"],
    isolation: {type: "shadow", mode: ContentScriptShadowMode.Closed},
    init: () => ({
        ready: () => api.ready() && isolation !== undefined,
        load: async () => ({...(await api.load()), isolation}),
    }),
    main(_relay, _context, options) {
        isolation = options.isolation;
    },
    render: () => (panel = createPanel("shadow")),
});
