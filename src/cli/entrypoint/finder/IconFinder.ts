import path from "path";
import _ from "lodash";

import AbstractAssetFinder from "./AbstractAssetFinder";
import AssetPluginFinder from "./AssetPluginFinder";

import {EntrypointFile} from "@typing/entrypoint";
import {ReadonlyConfig} from "@typing/config";
import {DefaultIconGroupName, IconFileExtensions, IconSizes} from "@typing/icon";

export interface IconName {
    group: string;
    size: number;
}

export interface IconItem {
    file: EntrypointFile;
    name: IconName;
}

export type IconItems = Map<number, IconItem>;

export type IconGroups = Map<string, IconItems>;

export default class extends AbstractAssetFinder {
    protected _plugin?: AssetPluginFinder;
    protected _icons?: IconGroups;

    public constructor(config: ReadonlyConfig) {
        super(config);
    }

    protected getPlugin(): AssetPluginFinder {
        return new AssetPluginFinder(this.config, "icon", this);
    }

    public plugin(): AssetPluginFinder {
        return (this._plugin ??= this.getPlugin());
    }

    public getNames(): ReadonlySet<string> {
        return new Set([...IconSizes].map(String));
    }

    public isValidName(name: string): boolean {
        return this.parseName(name) !== undefined;
    }

    public isValidExtension(extension: string): boolean {
        return IconFileExtensions.has(extension);
    }

    protected parseName(name: string): IconName | undefined {
        name = name.toLowerCase().trim();

        if (name.includes(".")) {
            const index = name.lastIndexOf(".");

            if (index >= 0) {
                name = name.substring(0, index);
            }
        }

        const matchSize = name.match(/(\d+)$/);

        const size = matchSize ? parseInt(matchSize[1], 10) : undefined;

        if (!size || !IconSizes.has(size)) {
            return undefined;
        }

        const groupMatch = name.match(/^([a-z]+)(?:[-_]|\d)/);

        const group = groupMatch ? groupMatch[1] : DefaultIconGroupName;

        return {group, size};
    }

    protected getName(file: EntrypointFile): IconName {
        const {name: filename} = path.parse(file.file);

        const name = this.parseName(filename);

        if (!name) {
            throw new Error(`Invalid icon name: ${file.file}`);
        }

        return name;
    }

    public getDirectory(): string {
        return this.config.iconSrcDir;
    }

    public canMerge(): boolean {
        return this.config.mergeIcons;
    }

    protected async getIcons(): Promise<IconGroups> {
        const files = await this.plugin().files();

        const groups = _.chain([...files])
            .map(file => ({file, name: this.getName(file)}))
            .groupBy(({name}) => name.group)
            .mapValues(items => {
                return new Map(items.map(item => [item.name.size, item]));
            })
            .value();

        return new Map(Object.entries(groups));
    }

    public async icons(): Promise<IconGroups> {
        return (this._icons ??= await this.getIcons());
    }

    public clear(): this {
        this.plugin().clear();

        this._icons = undefined;

        return super.clear();
    }
}
