import {z} from "zod";
import path from "path";

import {ExpressionFile, ImportResolver, OptionFile, TsResolver} from "../file";

import {Mode} from "@typing/app";
import {Browser} from "@typing/browser";
import {ReadonlyConfig} from "@typing/config";
import {EntrypointFile, EntrypointOptions, EntrypointParser} from "@typing/entrypoint";

export default abstract class AbstractParser<O extends EntrypointOptions> implements EntrypointParser<O> {
    protected readonly ir: ImportResolver;

    protected readonly CommonPropertiesSchema = z.object({
        includeApp: z.array(z.string()).optional(),
        excludeApp: z.array(z.string()).optional(),
        includeBrowser: z.array(z.nativeEnum(Browser)).optional(),
        excludeBrowser: z.array(z.nativeEnum(Browser)).optional(),
        mode: z.nativeEnum(Mode).optional(),
        debug: z.boolean().optional(),
        manifestVersion: z.union([z.literal(2), z.literal(3)]).optional(),
    });

    protected abstract schema(): typeof this.CommonPropertiesSchema;

    protected abstract definition(): string | string[];

    constructor(protected readonly config: ReadonlyConfig) {
        this.ir = new ImportResolver(TsResolver.make(path.resolve(this.config.rootDir, "tsconfig.json")));
    }

    protected optionFile(file: EntrypointFile): OptionFile<Record<string, any>> {
        const instance = OptionFile.make(file.file);

        instance.setImportResolver(this.ir);

        return instance.setProperties(Object.keys(this.schema().shape)).setDefinition(this.definition());
    }

    protected getOptions(file: EntrypointFile): Record<string, any> {
        const instance = this.optionFile(file);

        return instance.getOptions();
    }

    protected agreement(): string | undefined {
        return undefined;
    }

    public options(file: EntrypointFile): O {
        const {success, error, data} = this.schema().safeParse(this.getOptions(file));

        if (!success) {
            const e = error?.errors[0];

            if (e) {
                throw new Error(`Invalid options ${e.path.join(", ")} in "${file.file}": ${e.message}`);
            } else {
                throw new Error(`Invalid options in "${file.file}"`);
            }
        }

        return (data || {}) as O;
    }

    public contract(file: EntrypointFile): string | undefined {
        const agreement = this.agreement();

        if (!agreement) {
            return;
        }

        const instance = ExpressionFile.make(file.file);

        instance.setImportResolver(this.ir);

        return instance.setDefinition(this.definition()).setProperty(agreement).getType();
    }
}
