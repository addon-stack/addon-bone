// @ts-ignore - This is a test file
import {fakeWrapper} from "some-other-package";

class Baz {
    public x: string = 'x';

    public getX(): string {
        return this.x;
    }
}

// fakeWrapper is not imported from the designated PackageName
export default fakeWrapper({
    init() {
        return new Baz();
    },
    x: 'hello'
});
