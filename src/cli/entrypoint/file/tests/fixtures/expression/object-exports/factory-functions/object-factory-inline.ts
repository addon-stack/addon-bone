export default () => {
    return {
        foo: '',
        getFoo(): string {
            return this.foo;
        },
        setFoo(foo: string): void {
            this.foo = foo;
        },
    };
}