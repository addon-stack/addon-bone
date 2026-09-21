import {z} from "zod";

/**
 * Schema of `PermissionsOptions`.
 *
 * It is a mixin, not a part of any parser class: an entrypoint opts into the contract
 * when its parser imports and merges this schema, and entrypoints that do not never read these keys.
 */
export const PermissionsSchema = z.object({
    permissions: z.array(z.string()).optional(),
    optionalPermissions: z.array(z.string()).optional(),
    hostPermissions: z.array(z.string()).optional(),
    optionalHostPermissions: z.array(z.string()).optional(),
});
