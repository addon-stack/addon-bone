import path from "path";
import _ from "lodash";

import type {HtmlRspackPluginOptions} from "@rspack/core";
import type {HtmlTagsPluginOptions} from "@rspackjs/plugin-html-tags";

import {AbstractViewFinder} from "@cli/entrypoint";

import {EntrypointEntries} from "@typing/entrypoint";
import {ViewEntrypointOptions} from "@typing/view";
import {ReadonlyConfig} from "@typing/config";

export default class<O extends ViewEntrypointOptions> {
    public constructor(
        protected readonly config: ReadonlyConfig,
        protected readonly finder: AbstractViewFinder<O>
    ) {}

    public async entries(): Promise<EntrypointEntries> {
        const entries: EntrypointEntries = new Map();

        for (const [name, page] of await this.finder.views()) {
            entries.set(name, new Set([page.file]));
        }

        return entries;
    }

    public async html(): Promise<HtmlRspackPluginOptions[]> {
        const html: HtmlRspackPluginOptions[] = [];

        for (const [name, {file, filename, options}] of await this.finder.views()) {
            const {template, title} = options;

            html.push({
                filename,
                title: title || _.startCase(this.config.app),
                template: template ? path.resolve(path.dirname(file.file), template) : undefined,
                chunks: [name],
                inject: "body",
                minify: true,
            });
        }

        return html;
    }

    public async tags(): Promise<HtmlTagsPluginOptions[]> {
        const tags: HtmlTagsPluginOptions[] = [];

        const views = await this.finder.views();

        for (const {filename, options} of views.values()) {
            // prettier-ignore
            const {
                as,
                title,
                template,
                excludeApp,
                includeApp,
                excludeBrowser,
                includeBrowser,
                ...tagOptions
            } = options;

            if (!_.isEmpty(tagOptions)) {
                tags.push({
                    ...tagOptions,
                    files: [filename],
                });
            }
        }

        return tags;
    }
}
