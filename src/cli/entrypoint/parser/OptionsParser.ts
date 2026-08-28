import {z} from "zod";

import ViewCspParser from "./ViewCspParser";

import {OptionsEntrypointOptions} from "@typing/options";

export default class extends ViewCspParser<OptionsEntrypointOptions> {
    protected definition(): string {
        return "defineOptions";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        return super.schema().extend({
            openInTab: z.boolean().optional(),
        });
    }
}
