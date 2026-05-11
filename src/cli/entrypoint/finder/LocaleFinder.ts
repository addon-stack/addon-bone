import _ from "lodash";
import path from "path";
import fs from "fs";
import yaml from "js-yaml";

import AbstractAssetFinder from "./AbstractAssetFinder";
import AssetPluginFinder from "./AssetPluginFinder";

import localeFactory, {LocaleStructureValidator} from "@cli/builders/locale";
import {isFileExtension} from "@cli/utils/path";

import {ReadonlyConfig} from "@typing/config";
import {
    Language,
    LanguageCodes,
    LocaleBuilders,
    LocaleData,
    LocaleFileExtensions,
    LocaleKeys,
    LocaleStructure,
} from "@typing/locale";

export type {LocaleBuilders} from "@typing/locale";

export default class extends AbstractAssetFinder {
    protected _plugin?: AssetPluginFinder;
    protected _builders?: LocaleBuilders;
    protected _validator?: LocaleStructureValidator;
    protected _validated = false;

    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    public isValidName(name: string): boolean {
        if (name.includes(".")) {
            name = name.split(".").slice(0, -1).join(".");
        }

        return super.isValidName(name);
    }

    public isValidExtension(extension: string): boolean {
        return LocaleFileExtensions.has(extension);
    }

    public getDirectory(): string {
        return this.config.localeDir || "locales";
    }

    public getNames(): ReadonlySet<string> {
        return LanguageCodes;
    }

    public canMerge(): boolean {
        return this.config.mergeLocales;
    }

    protected getPlugin(): AssetPluginFinder {
        return new AssetPluginFinder(this.config, "locale", this);
    }

    public plugin(): AssetPluginFinder {
        return (this._plugin ??= this.getPlugin());
    }

    protected async getBuilders(): Promise<LocaleBuilders> {
        return _.chain(Array.from(await this.plugin().files()))
            .groupBy(file => this.getLanguageFromFilename(file.file))
            .reduce((map, files, lang) => {
                const locale = localeFactory(lang as Language, this.config);

                for (const {file} of files) {
                    const content = fs.readFileSync(file, "utf8");

                    if (isFileExtension(file, ["yaml", "yml"])) {
                        locale.merge(yaml.load(content) as LocaleData);
                    } else if (isFileExtension(file, "json")) {
                        locale.merge(JSON.parse(content));
                    }
                }

                map.set(locale.lang(), locale);

                return map;
            }, new Map() as LocaleBuilders)
            .value();
    }

    protected getValidator(): LocaleStructureValidator {
        return (this._validator ??= new LocaleStructureValidator(this.config.lang));
    }

    protected getLanguageFromFilename(filename: string): Language {
        let {name} = path.parse(filename);

        if (name.includes(".")) {
            name = name.split(".").slice(0, -1).join(".");
        }

        if (LanguageCodes.has(name)) {
            return name as Language;
        }

        throw new Error(`Invalid locale filename: ${filename}`);
    }

    public async builders(): Promise<LocaleBuilders> {
        if (this._builders) {
            return this._builders;
        }

        return (this._builders = await this.getBuilders());
    }

    public async validate(): Promise<this> {
        if (!this._validated) {
            this.getValidator().validate(await this.builders());
            this._validated = true;
        }

        return this;
    }

    public async keys(): Promise<LocaleKeys> {
        const builders = await this.builders();
        const builder = this.getValidator().getDefaultBuilder(builders);

        return builder?.keys() ?? new Set();
    }

    public async structure(): Promise<LocaleStructure> {
        const builders = await this.builders();
        const builder = this.getValidator().getDefaultBuilder(builders);

        return builder?.structure() ?? {};
    }

    public async languages(): Promise<Set<Language>> {
        const builders = await this.builders();

        return new Set(builders.keys());
    }

    async empty(): Promise<boolean> {
        return this.plugin().empty();
    }

    public clear(): this {
        this.plugin().clear();

        this._builders = undefined;
        this._validator = undefined;
        this._validated = false;

        return super.clear();
    }
}
