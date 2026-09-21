import {z} from "zod";

import ViewCspParser from "./ViewCspParser";
import {PermissionsSchema} from "./schemas/permissions";

import {OptionsEntrypointOptions} from "@typing/options";

export default class extends ViewCspParser<OptionsEntrypointOptions> {
    protected definition(): string {
        return "defineOptions";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        return super.schema().merge(PermissionsSchema).extend({
            openInTab: z.boolean().optional(),
        });
    }
}
