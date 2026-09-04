import {getUrl} from "@addon-core/browser";

import type {ContentScriptShadowFontOptions} from "@typing/content";

const RemoteSource = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export default class ShadowFontRegistry {
    private registered = false;

    public constructor(private readonly fonts: readonly ContentScriptShadowFontOptions[] = []) {}

    public register(): void {
        if (this.registered) {
            return;
        }

        this.registered = true;
        const definitions = new Set<string>();

        for (const {family, source, ...descriptors} of this.fonts) {
            const descriptorEntries = Object.entries(descriptors).sort(([left], [right]) => left.localeCompare(right));
            const key = JSON.stringify([family, source, descriptorEntries]);

            if (definitions.has(key)) {
                continue;
            }

            definitions.add(key);

            try {
                if (!source || RemoteSource.test(source)) {
                    throw new Error("font source must be a local imported asset");
                }

                const url = getUrl(source);
                const font = new FontFace(family, `url(${JSON.stringify(url)})`, descriptors);

                document.fonts.add(font);
                font.load().catch(error => this.report(family, source, error));
            } catch (error) {
                this.report(family, source, error);
            }
        }
    }

    private report(family: string, source: string, error: unknown): void {
        console.error(`Loading shadow font "${family}" from "${source}" failed`, error);
    }
}
