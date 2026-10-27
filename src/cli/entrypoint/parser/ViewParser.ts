import {z} from "zod";

import AbstractParser from "./AbstractParser";
import {HtmlEntrypointOptionsSchema} from "./schemas/html";

import {ViewEntrypointOptions} from "@typing/view";

export default abstract class ViewParser<O extends ViewEntrypointOptions> extends AbstractParser<O> {
    protected schema(): typeof this.CommonPropertiesSchema {
        return this.CommonPropertiesSchema.merge(HtmlEntrypointOptionsSchema).extend({
            as: z.string().nonempty().optional(),
            title: z.string().nonempty().optional(),
            template: z.string().nonempty().optional(),
        });
    }
}
