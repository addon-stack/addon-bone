interface EmptyInterface {}
type EmptyType = {};

class EmptyClass {

    public foo: EmptyInterface = {};
    public bar: EmptyType = {};
}


export default () => new EmptyClass();