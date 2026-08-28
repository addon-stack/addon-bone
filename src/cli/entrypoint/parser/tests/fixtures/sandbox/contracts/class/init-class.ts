import {defineSandbox} from "adnbn";

class ParserSandbox {
    public constructor(public prefix: string) {}

    public parse(html: string): number {
        return html.length;
    }

    public normalize(html: string): string {
        return this.prefix + html.trim();
    }

    private secret(): string {
        return "hidden";
    }
}

export default defineSandbox({
    name: "classContract",
    init() {
        return new ParserSandbox("safe:");
    },
});
