class Foo {
    constructor(public bar: string) {}
    public getBar(): string { return this.bar; }
}

export default {
    init: () => new Foo('baz')
};