import path from "path";

import {EntrypointFile, EntrypointNameGenerator, EntrypointType} from "@typing/entrypoint";

export default class implements EntrypointNameGenerator {
    protected names = new Set<string>();

    protected reservedNames = new Set<string>();

    constructor(protected readonly entrypoint: EntrypointType) {}

    public reserve(name: string): this {
        this.reservedNames.add(name);

        if (this.names.has(name)) {
            throw new Error(`Entrypoint name "${name}" is already in use.`);
        }

        this.names.add(name);

        return this;
    }

    public name(name: string): string {
        let entryName = name;
        let counter = 1;

        if (entryName !== this.entrypoint) {
            entryName = `${entryName}.${this.entrypoint}`;
        }

        while (this.has(entryName)) {
            entryName = name === this.entrypoint ? `${counter}.${name}` : `${name}${counter}.${this.entrypoint}`;

            counter++;
        }

        this.names.add(entryName);

        return entryName;
    }

    public file(file: EntrypointFile): string {
        return this.name(this.derive(file));
    }

    /** Derive a name from a file without claiming it; `file()` claims the derived name. */
    public derive(file: EntrypointFile): string {
        const key = "." + this.entrypoint;

        let {name, dir} = path.parse(file.file);

        if (name === "index") {
            name = path.basename(dir);
        }

        if (name.includes(key)) {
            name = name.split(key)[0];
        }

        return name;
    }

    public reset(): this {
        if (this.reservedNames.size === 0) {
            this.names.clear();

            return this;
        }

        this.names = new Set(this.reservedNames);

        return this;
    }

    public likely(name?: string): boolean {
        if (!name) {
            return false;
        }

        return name === this.entrypoint || name.endsWith(`.${this.entrypoint}`);
    }

    public has(name: string): boolean {
        return this.names.has(name);
    }
}
