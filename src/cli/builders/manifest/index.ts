import type ManifestBase from "./ManifestBase";
import ManifestV2 from "./ManifestV2";
import ManifestV3 from "./ManifestV3";

import type {Manifest} from "@typing/manifest";
import {ReadonlyConfig} from "@typing/config";

export {default as ManifestBase} from "./ManifestBase";

export default (config: ReadonlyConfig): ManifestBase<Manifest> => {
    const {manifestVersion, browser} = config;

    if (manifestVersion === 2) {
        return new ManifestV2(browser);
    }

    return new ManifestV3(browser);
};
