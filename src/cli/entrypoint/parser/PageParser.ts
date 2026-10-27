import z from "zod";

import ViewCspParser from "./ViewCspParser";
import {PermissionsSchema} from "./schemas/permissions";

import {PageEntrypointOptions} from "@typing/page";

export default class PageParser extends ViewCspParser<PageEntrypointOptions> {
    protected definition(): string {
        return "definePage";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        return super
            .schema()
            .merge(PermissionsSchema)
            .extend({
                name: z.string().nonempty().optional(),
                matches: z.array(z.string()).optional(),
            });
    }
}
