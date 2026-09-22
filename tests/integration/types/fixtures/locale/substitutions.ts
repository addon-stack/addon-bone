import type {LocaleNonPluralKeys, LocalePluralKeys, LocaleSubstitutionArgs} from "adnbn/locale";

interface Structure {
    "app.name": {plural: false; substitutions: []};
    "app.greeting": {plural: false; substitutions: ["name"]};
    "app.cars": {plural: true; substitutions: ["count"]};
}

declare function trans<K extends LocaleNonPluralKeys<Structure>>(
    key: K,
    ...args: LocaleSubstitutionArgs<Structure, K>
): string;

declare function choice<K extends LocalePluralKeys<Structure>>(
    key: K,
    count: number,
    ...args: LocaleSubstitutionArgs<Structure, K>
): string;

trans("app.name");
trans("app.greeting", {name: "Alice"});
choice("app.cars", 2, {count: 2});

// @ts-expect-error keys without placeholders do not accept substitutions
trans("app.name", {name: "Alice"});

// @ts-expect-error keys with placeholders require a substitutions argument
trans("app.greeting");

// @ts-expect-error all declared placeholders must be supplied
trans("app.greeting", {});

// @ts-expect-error unknown substitution names are rejected
trans("app.greeting", {name: "Alice", extra: "bad"});

// @ts-expect-error plural messages cannot be used as ordinary messages
trans("app.cars", {count: 2});

// @ts-expect-error ordinary messages cannot be used as plural messages
choice("app.greeting", 1, {name: "Alice"});
