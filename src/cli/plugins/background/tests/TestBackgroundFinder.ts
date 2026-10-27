import path from "path";

import {BackgroundFinder} from "@cli/entrypoint";

import type {BackgroundEntrypointOptions} from "@typing/background";
import type {ReadonlyConfig} from "@typing/config";
import type {EntrypointFile, EntrypointOptionsFinder} from "@typing/entrypoint";

export default class TestBackgroundFinder extends BackgroundFinder {
    public constructor(private readonly entries: BackgroundEntrypointOptions[]) {
        super({rootDir: path.resolve(__dirname)} as ReadonlyConfig);
    }

    public plugin(): EntrypointOptionsFinder<BackgroundEntrypointOptions> {
        return this;
    }

    public async options(): Promise<Map<EntrypointFile, BackgroundEntrypointOptions>> {
        return new Map(
            this.entries.map((options, index) => {
                const file = path.resolve(__dirname, `${index}.background.ts`);

                return [{file, import: file}, options];
            })
        );
    }
}
