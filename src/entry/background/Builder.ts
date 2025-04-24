import Builder from "@entry/core/Builder";

import {isValidBackgroundMainHandler} from "./resolvers";

import {BackgroundBuilder, BackgroundDefinition} from "@typing/background";

export default class extends Builder implements BackgroundBuilder {
    constructor(private readonly definition: BackgroundDefinition) {
        super();
    }

    public async build(): Promise<void> {
        const {main, ...options} = this.definition;

        if (isValidBackgroundMainHandler(main)) {
            await main(options);
        }
    }

    public async destroy(): Promise<void> {
        // Nothing to do
    }
}