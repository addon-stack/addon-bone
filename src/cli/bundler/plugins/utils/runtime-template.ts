const PlaceholderPattern = /__ADNBN_[A-Z0-9_]+__/g;

export const renderRuntimeTemplate = (template: string, values: Readonly<Record<string, string>>): string => {
    for (const placeholder of Object.keys(values)) {
        if (!template.includes(placeholder)) {
            throw new Error(`Runtime template placeholder "${placeholder}" is unavailable`);
        }
    }

    // Substitute once: inserted data is literal, not another template or a replacement pattern.
    return template
        .replace(PlaceholderPattern, placeholder => {
            if (!Object.hasOwn(values, placeholder)) {
                throw new Error(`Runtime template placeholder "${placeholder}" was not replaced`);
            }
            return values[placeholder];
        })
        .trim();
};
