import {defineContentScript} from "adnbn";

import panelFont from "./panel.woff2";

export default defineContentScript({
    shadow: {
        fonts: [
            {
                family: "AdnbnPanelInter",
                source: panelFont,
                weight: "400",
            },
        ],
    },
});
