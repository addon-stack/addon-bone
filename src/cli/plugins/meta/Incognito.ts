import AbstractMeta from "./AbstractMeta";

import {ReadonlyConfig} from "@typing/config";
import {ManifestIncognito, ManifestIncognitoValue} from "@typing/manifest";

export default class extends AbstractMeta<ManifestIncognitoValue> {
    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public getValue(): ReadonlyConfig["incognito"] {
        return this.config.incognito;
    }

    protected isValid(value?: unknown): value is ManifestIncognito {
        return Object.values(ManifestIncognito).includes(value as ManifestIncognito);
    }
}
