import z from "zod";

import ViewCspParser from "./ViewCspParser";

import {PageEntrypointOptions} from "@typing/page";

export default class extends ViewCspParser<PageEntrypointOptions> {
    protected definition(): string {
        return "definePage";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        return super.schema().extend({
            name: z.string().nonempty().optional(),
            matches: z.array(z.string()).optional(),
        });
    }
}
