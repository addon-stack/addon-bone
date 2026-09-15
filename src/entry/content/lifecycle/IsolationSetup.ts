import type {
    ContentScriptBoundary,
    ContentScriptBoundaryCleanup,
    ContentScriptBoundaryHandler,
    ContentScriptContainerProps,
    ContentScriptTargetProps,
} from "@typing/content";

interface IsolationSetupOptions<Data, Isolation extends "shadow" | "iframe"> {
    props: () => ContentScriptContainerProps<Data>;
    container: () => Element | undefined;
    boundary?: ContentScriptBoundaryHandler<Data, Isolation>;
    target: (props: ContentScriptTargetProps<Data, Isolation>) => Element;
}

/** Applies user configuration; isolation nodes own DOM, cleanup timing, and recovery. */
export default class IsolationSetup<Data = unknown, Isolation extends "shadow" | "iframe" = "shadow" | "iframe"> {
    public constructor(private readonly options: IsolationSetupOptions<Data, Isolation>) {}

    public setup(
        boundary: Exclude<ContentScriptBoundary<Isolation>, undefined>
    ): ContentScriptBoundaryCleanup | undefined {
        const props = this.getProps("boundary");
        const cleanup = this.options.boundary?.({...props, boundary});

        if (cleanup !== undefined && typeof cleanup !== "function") {
            throw new Error("Content script boundary must return synchronously with a cleanup function or undefined");
        }

        if (cleanup) {
            return () => {
                try {
                    cleanup();
                } catch (error) {
                    console.error("Content script boundary cleanup failed", error);
                }
            };
        }
    }

    public createTarget(boundary: Exclude<ContentScriptBoundary<Isolation>, undefined>, document: Document): Element {
        return this.options.target({...this.getProps("target"), boundary, document});
    }

    private getProps(stage: "boundary" | "target"): ContentScriptContainerProps<Data> & {container: Element} {
        const container = this.options.container();

        if (!container) {
            throw new Error(`Content script ${stage} requires a mounted container`);
        }

        return {...this.options.props(), container};
    }
}
