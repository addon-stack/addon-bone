import {z} from "zod";

import ViewCspParser from "./ViewCspParser";

import {PopupEntrypointOptions} from "@typing/popup";

export default class extends ViewCspParser<PopupEntrypointOptions> {
    protected definition(): string {
        return "definePopup";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        return super.schema().extend({
            icon: z.string().nonempty().optional(),
            apply: z.boolean().optional(),
        });
    }
}
