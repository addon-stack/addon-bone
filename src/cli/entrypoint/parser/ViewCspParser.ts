import {z} from "zod";

import ViewParser from "./ViewParser";

import type {CspOptions} from "@typing/csp";
import type {ViewEntrypointOptions} from "@typing/view";

export type ViewCspEntrypointOptions = ViewEntrypointOptions & CspOptions;

export default abstract class<O extends ViewCspEntrypointOptions> extends ViewParser<O> {
    protected cspSourcesSchema = z.array(z.string()).optional();

    protected schema(): typeof this.CommonPropertiesSchema {
        return super.schema().extend({
            csp: z
                .object({
                    wasm: z.boolean().optional(),
                    sources: z
                        .object({
                            connect: this.cspSourcesSchema,
                            image: this.cspSourcesSchema,
                            style: this.cspSourcesSchema,
                            font: this.cspSourcesSchema,
                            media: this.cspSourcesSchema,
                            worker: this.cspSourcesSchema,
                            child: this.cspSourcesSchema,
                            frame: this.cspSourcesSchema,
                        })
                        .optional(),
                })
                .optional(),
        });
    }
}
