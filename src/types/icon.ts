export const DefaultIconGroupName = "default";

export const IconFileExtensions: ReadonlySet<string> = new Set(["png"]);

export const IconSizes: ReadonlySet<number> = new Set([16, 32, 48, 64, 128, 256, 512]);

/**
 * Empty because icon group names depend on the consuming application's icon files.
 * Generated `.adnbn/icon.d.ts` declarations augment `adnbn`, adding discovered names as keys with value `true`.
 */
export interface IconNameRegistry {}

export type IconName = keyof IconNameRegistry extends never ? string : Extract<keyof IconNameRegistry, string>;

export type IconsMap = Map<IconName, Record<number, string>>;
