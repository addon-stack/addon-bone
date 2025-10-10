import {defineService} from "adnbn";

class Math {
    public add(a: number, b: number): number { return a + b; }
    public subtract(a: number, b: number): number { return a - b; }
    public multiply(a: number, b: number): number { return a * b; }
}

// wrapped in multiple parentheses
export default (((defineService({
    persistent: true,
    name: 'Math',
    init() { return new Math(); }
}))));
