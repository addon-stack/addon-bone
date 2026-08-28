// @ts-ignore
import {ExtraType} from "somelib";

class ExternalService {
    public extra: ExtraType;

    constructor() {
        this.extra = {} as ExtraType;
    }

    public getExtra(): ExtraType {
        return this.extra;
    }

    public setExtra(extra: ExtraType): void {
        this.extra = extra;
    }
}

export default () => {
    return new ExternalService();
};