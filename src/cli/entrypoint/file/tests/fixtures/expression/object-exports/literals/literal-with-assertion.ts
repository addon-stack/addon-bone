export default {
    foo: 'abc',
    getFoo(): string {
        return this.foo;
    }
} as const;