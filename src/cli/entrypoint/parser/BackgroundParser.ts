import {z} from "zod";

import AbstractParser from "./AbstractParser";
import {PermissionsSchema} from "./schemas/permissions";

import {BackgroundEntrypointOptions} from "@typing/background";

export default class<T extends BackgroundEntrypointOptions = BackgroundEntrypointOptions> extends AbstractParser<T> {
    protected definition(): string | string[] {
        return "defineBackground";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        return this.CommonPropertiesSchema.merge(PermissionsSchema).extend({
            persistent: z.boolean().optional(),
        });
    }
}
