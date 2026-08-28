class Foo {
    constructor(public bar: string) {

    }

    public getBar(): string {
        return this.bar;
    }

    public setBar(bar: string): void {
        this.bar = bar;
    }
}

export const init = () => new Foo('bar');