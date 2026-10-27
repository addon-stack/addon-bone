import {z} from "zod";

import ViewCspParser from "./ViewCspParser";
import {PermissionsSchema} from "./schemas/permissions";

import {PopupEntrypointOptions} from "@typing/popup";

export default class PopupParser extends ViewCspParser<PopupEntrypointOptions> {
    protected definition(): string {
        return "definePopup";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        return super.schema().merge(PermissionsSchema).extend({
            icon: z.string().nonempty().optional(),
            apply: z.boolean().optional(),
            tooltip: z.string().optional(),
        });
    }
}
