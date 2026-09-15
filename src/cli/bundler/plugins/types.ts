/** Identifies the property a plugin installs on each selected bundler runtime. */
export interface RuntimePropertyOptions {
    readonly property: string;
}

/** Names a module export that reads one property of the calling bundler runtime. */
export interface RuntimeModuleReaderOptions extends RuntimePropertyOptions {
    readonly export: string;
}
