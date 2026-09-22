import ViewCspParser from "./ViewCspParser";
import {PermissionsSchema} from "./schemas/permissions";

import {OverrideEntrypointOptions} from "@typing/override";

/**
 * Override pages rely on browser APIs, so the family opts into the permissions contract
 * on top of the view and CSP options.
 */
export default abstract class AbstractOverrideParser<O extends OverrideEntrypointOptions> extends ViewCspParser<O> {
    protected schema(): typeof this.CommonPropertiesSchema {
        return super.schema().merge(PermissionsSchema);
    }
}
