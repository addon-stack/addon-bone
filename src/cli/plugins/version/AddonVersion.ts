import fs from "fs";
import semver from "semver";

import {getEnv} from "@main/env";
import {fromRootPath} from "@cli/workspace";

import AbstractVersion from "./AbstractVersion";

import type {ReadonlyConfig} from "@typing/config";

export default class extends AbstractVersion {
    constructor(config: ReadonlyConfig) {
        super(config);
    }

    public getVersion(): string | undefined {
        const version = this.extractVersionValue(this.config.version);

        if (!version) {
            return;
        }

        if (semver.valid(version)) {
            return version;
        }

        const envVersion = getEnv(version);

        if (semver.valid(envVersion)) {
            return envVersion;
        }

        const packagePath = fromRootPath(this.config, "package.json");

        try {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf-8"));

            return packageJson.version;
        } catch (e) {
            console.error(`Unable to read version from "${packagePath}"`, e);
        }
    }
}
