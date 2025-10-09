interface Bar {
    bar: string;
}

type BarWithFoo = Bar & {
    foo: string;
}

class Foo {
    public getBar(): Bar {
        return {bar: 'some'};
    }

    public getBarWithFoo(): BarWithFoo {
        return {bar: 'some', foo: 'and'}
    }
}

export default () => new Foo();