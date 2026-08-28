export default () => {
    return new class {
        public bar: string = '';

        public getBar(): string {
            return this.bar;
        }

        public setBar(bar: string): this {
            this.bar = bar;

            return this;
        }
    }
};