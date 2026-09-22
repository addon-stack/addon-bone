import {Browser, CspSource, defineOffscreen, OffscreenReason} from "adnbn";

export default defineOffscreen({
    name: "audio",
    reasons: [OffscreenReason.AudioPlayback, OffscreenReason.Blobs],
    justification: "Plays notification sounds",
    as: "panel",
    title: "Extension panel",
    template: "./template.html",
    includeBrowser: [Browser.Chrome],
    csp: {sources: {connect: [CspSource.Self, "https://api.example.com"]}},
    links: "extra.css",
    init: () => ({play: (url: string): void => console.log(url)}),
});
