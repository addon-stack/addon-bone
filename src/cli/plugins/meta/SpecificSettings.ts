import {z} from "zod";

import AbstractMeta from "./AbstractMeta";

import {BrowserSpecific} from "@typing/browser";
import {ReadonlyConfig} from "@typing/config";

const VersionSpecificSchema = z
    .object({
        strictMinVersion: z.string().min(1).optional(),
        strictMaxVersion: z.string().min(1).optional(),
    })
    .strict();

const GeckoSpecificSchema = VersionSpecificSchema.extend({
    id: z.string().min(1).optional(),
    updateUrl: z.string().url().optional(),
}).strict();

const BrowserSpecificSchema = z
    .object({
        gecko: GeckoSpecificSchema.optional(),
        geckoAndroid: VersionSpecificSchema.optional(),
        safari: VersionSpecificSchema.optional(),
    })
    .strict();

export default class extends AbstractMeta<BrowserSpecific> {
    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public getValue(): ReadonlyConfig["specific"] {
        return this.config.specific;
    }

    protected isValid(value?: unknown): value is BrowserSpecific {
        return BrowserSpecificSchema.safeParse(value).success;
    }
}
