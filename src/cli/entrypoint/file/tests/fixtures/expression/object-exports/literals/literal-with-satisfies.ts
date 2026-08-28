type Obj = {
    foo: string;
    getFoo(): string;
};

export default {
    foo: 'xyz',
    getFoo() {
        return this.foo;
    }
} satisfies Obj;