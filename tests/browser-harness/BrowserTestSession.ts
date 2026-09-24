import {
    createBrowserHarness,
    installBrowserGlobals,
    type BrowserContext,
    type BrowserHarness,
    type BrowserHarnessOptions,
    type BrowserProfile,
} from "@addon-core/browser/testing";
import {
    createNodeScriptRuntime,
    type NodeScriptRuntime,
    type NodeScriptRuntimeOptions,
} from "@addon-core/browser/testing/node";

import {resetFrameworkState} from "./framework-state";

type BrowserTestCleanup = () => void | Promise<void>;
type BrowserTestRuntimeOptions = Omit<NodeScriptRuntimeOptions, "documents">;
type BrowserTestProfile = Exclude<BrowserProfile, "custom">;

export interface BrowserTestSessionOptions extends BrowserHarnessOptions {
    profile?: BrowserTestProfile;
    app?: string;
}

/** One test owns its globals, contexts, guest runtimes and consumer resources. */
export default class BrowserTestSession {
    public readonly harness: BrowserHarness;
    public readonly context: BrowserContext;

    private readonly restoreGlobals: () => void;
    private readonly restoreEnvironment: () => void;
    private profile: BrowserTestProfile;
    private readonly cleanups: BrowserTestCleanup[] = [];
    private disposal?: Promise<void>;

    public constructor({profile = "chrome", app = "test", ...options}: BrowserTestSessionOptions = {}) {
        this.profile = profile;
        const environment = ["BROWSER", "APP", "MANIFEST_VERSION"].map(key => [key, process.env[key]] as const);

        this.restoreEnvironment = () => {
            for (const [key, value] of environment) {
                if (value === undefined) {
                    delete process.env[key];
                } else {
                    process.env[key] = value;
                }
            }
        };

        this.harness = createBrowserHarness(options);
        this.context = this.harness.contexts.create({kind: "extensionPage"});
        this.restoreGlobals = installBrowserGlobals(this.harness, {
            environment: "preserve",
            profile,
            messageContext: this.context,
        });
        process.env.BROWSER = profile;
        process.env.APP = app;
        process.env.MANIFEST_VERSION = String(this.harness.runtime.manifest.manifest_version);
    }

    public addCleanup(cleanup: BrowserTestCleanup): void {
        if (this.disposal) {
            throw new Error("Browser test session is disposed.");
        }

        this.cleanups.push(cleanup);
    }

    /** Nested context installations must be restored in reverse order. */
    public useContext(context: BrowserContext, profile: BrowserTestProfile = this.profile): () => void {
        if (this.disposal) {
            throw new Error("Browser test session is disposed.");
        }

        const previousProfile = this.profile;
        const previousBrowser = process.env.BROWSER;
        const restore = installBrowserGlobals(this.harness, {
            environment: "preserve",
            profile,
            messageContext: context,
        });

        this.profile = profile;
        process.env.BROWSER = profile;

        let restored = false;
        const cleanup = () => {
            if (!restored) {
                restore();
                this.profile = previousProfile;

                if (previousBrowser === undefined) {
                    delete process.env.BROWSER;
                } else {
                    process.env.BROWSER = previousBrowser;
                }

                restored = true;
            }
        };

        this.addCleanup(cleanup);

        return cleanup;
    }

    public createScriptRuntime(options: BrowserTestRuntimeOptions = {}): NodeScriptRuntime {
        if (this.disposal) {
            throw new Error("Browser test session is disposed.");
        }

        const runtime = createNodeScriptRuntime({...options, documents: this.harness.contexts.documents});

        this.harness.scripting.setExecutor(runtime.executor);
        this.addCleanup(() => runtime.dispose());

        return runtime;
    }

    public dispose(): Promise<void> {
        return (this.disposal ??= Promise.resolve().then(() => this.cleanup()));
    }

    private async cleanup(): Promise<void> {
        const errors: unknown[] = [];

        for (const cleanup of [
            ...this.cleanups.reverse(),
            resetFrameworkState,
            () => this.harness.reset(),
            this.restoreGlobals,
            this.restoreEnvironment,
        ]) {
            try {
                await cleanup();
            } catch (error) {
                errors.push(error);
            }
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, "Browser test cleanup failed.");
        }
    }
}
