interface ArgsInput {
    foo: string;
    bar: number;
}

interface ArgsOutput {
    baz?: string;
    qux?: number;
}

class ComplexArgs {
    public set(name: string, a: ArgsInput): ArgsOutput {
        return {baz: a.foo, qux: a.bar};
    }
}

export default () => new ComplexArgs();