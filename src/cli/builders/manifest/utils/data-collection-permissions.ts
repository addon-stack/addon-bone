import _ from "lodash";
import {DataCollectionPermission, DataCollectionPermissions} from "@typing/browser";

/**
 * Normalizes data collection permissions for the manifest.
 *
 * - Removes duplicate permissions.
 * - Filters out invalid permissions not present in DataCollectionPermission enum.
 * - Sets "none" as default if required permissions are empty.
 * - Removes "none" if real permissions are added to required.
 * - Removes "none" from optional permissions.
 * - Removes any permission from optional if it's already in required.
 * - Sorts both required and optional permissions alphabetically.
 *
 * @param permissions - The permissions object to normalize.
 */
export const normalizeDataCollectionPermissions = (
    permissions?: DataCollectionPermissions
): DataCollectionPermissions => {
    const validPermissions = Object.values(DataCollectionPermission) as string[];

    let required = _.uniq(permissions?.required || []).filter(
        p => (p as string) === "none" || validPermissions.includes(p as string)
    );

    let optional = _.uniq(permissions?.optional || []).filter(
        p => (p as string) !== "none" && validPermissions.includes(p as string)
    );

    if (required.length === 0) {
        required = ["none" as any];
    }

    if (required.length > 1 && required.includes("none" as any)) {
        required = _.without(required, "none" as any);
    }

    optional = _.difference(optional, required);

    return {
        required: required.toSorted() as DataCollectionPermissions["required"],
        optional: optional.length > 0 ? (optional.toSorted() as DataCollectionPermissions["optional"]) : undefined,
    };
};
