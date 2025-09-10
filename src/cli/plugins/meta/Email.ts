import {z} from "zod";

import AbstractMeta from "./AbstractMeta";

import type {ReadonlyConfig} from "@typing/config";

const emailSchema = z.string().email();

export default class extends AbstractMeta {
    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public getValue(): ReadonlyConfig["email"] {
        return this.config.email;
    }

    protected isValid(value?: string): boolean {
        return emailSchema.safeParse(value).success;
    }
}
