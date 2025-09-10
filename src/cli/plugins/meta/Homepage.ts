import {z} from "zod";

import AbstractMeta from "./AbstractMeta";

import type {ReadonlyConfig} from "@typing/config";

const urlSchema = z.string().url();

export default class extends AbstractMeta {
    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public getValue(): ReadonlyConfig["homepage"] {
        return this.config.homepage;
    }

    protected isValid(value?: string): boolean {
        return urlSchema.safeParse(value).success;
    }
}
