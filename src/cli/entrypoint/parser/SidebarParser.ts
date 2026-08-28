import {z} from "zod";

import ViewCspParser from "./ViewCspParser";

import {SidebarEntrypointOptions} from "@typing/sidebar";

export default class extends ViewCspParser<SidebarEntrypointOptions> {
    protected definition(): string {
        return "defineSidebar";
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        return super.schema().extend({
            icon: z.string().nonempty().optional(),
            apply: z.boolean().optional(),
        });
    }
}
