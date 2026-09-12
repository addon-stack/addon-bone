interface LocalePlaceholder {
    name: string;
    start: number;
    end: number;
}

/** Empty names and malformed placeholders remain literal message text. */
export const parsePlaceholders = (message: string): LocalePlaceholder[] => {
    const placeholders: LocalePlaceholder[] = [];

    for (const match of message.matchAll(/{{([^{}]+)}}/g)) {
        const name = match[1].trim();

        if (name) {
            placeholders.push({name, start: match.index, end: match.index + match[0].length});
        }
    }

    return placeholders;
};

/** Keeps supplied values intact so each adapter can render them in its own format. */
export const applySubstitutions = <T>(
    message: string,
    substitutions: Record<string, T> | undefined,
    onMissing: (name: string) => void
): (string | T)[] => {
    if (!substitutions) return [message];

    const parts: (string | T)[] = [];
    let offset = 0;

    for (const placeholder of parsePlaceholders(message)) {
        parts.push(message.slice(offset, placeholder.start));

        if (Object.prototype.hasOwnProperty.call(substitutions, placeholder.name)) {
            parts.push(substitutions[placeholder.name]);
        } else {
            onMissing(placeholder.name);
            parts.push(placeholder.name);
        }

        offset = placeholder.end;
    }

    parts.push(message.slice(offset));

    return parts;
};
