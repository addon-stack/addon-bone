// @ts-ignore
import type {ExtraType} from "somelib";

class ExternalServiceType {
    public extra: ExtraType;

    constructor() {
        this.extra = {} as ExtraType;
    }

    public getExtra(): ExtraType {
        return this.extra;
    }

    public setExtra(extra: ExtraType = {}): void {
        this.extra = extra;
    }
}

export const init = () => new ExternalServiceType();