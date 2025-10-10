const FooKey = 'value';

interface Foo {
    [FooKey]?: string;
}

export default () => {
    return {
        getFoo(): string | undefined {
            return this[FooKey]!;
        },
        setFoo(foo: string): void {
            this[FooKey] = foo;
        },
    } as Foo;
}