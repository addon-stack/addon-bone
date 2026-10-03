import {defineCommand} from "adnbn";

export default defineCommand({
    includeApp: ["firefox-media"],
    defaultKey: "MediaPlayPause",
    windowsKey: "MediaNextTrack",
    macKey: "MediaPrevTrack",
    linuxKey: "MediaStop",
    execute() {},
});
