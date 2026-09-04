const PlaceholderPattern = /__ADNBN_[A-Z0-9_]+__/g;

export const renderRuntimeTemplate = (template: string, values: Readonly<Record<string, string>>): string => {
    let runtime = template;

    for (const [placeholder, value] of Object.entries(values)) {
        if (!runtime.includes(placeholder)) {
            throw new Error(`Runtime template placeholder "${placeholder}" is unavailable`);
        }

        runtime = runtime.replaceAll(placeholder, value);
    }

    const unresolved = runtime.match(PlaceholderPattern);

    if (unresolved) {
        throw new Error(`Runtime template placeholder "${unresolved[0]}" was not replaced`);
    }

    return runtime.trim();
};
