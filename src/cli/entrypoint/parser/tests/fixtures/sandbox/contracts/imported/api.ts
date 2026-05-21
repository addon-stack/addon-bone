export class TemplateSandbox {
    public render(template: string, values: Record<string, string>): string {
        return Object.entries(values).reduce((result, [key, value]) => result.replace(key, value), template);
    }

    public count(html: string): number {
        return html.length;
    }
}
