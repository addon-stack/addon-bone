import type {RuleSetCondition} from "@rspack/core";

export interface StylePluginOptions {
    /** Issuer layers where ?isolation selects a separate CSS destination. Omit to use ordinary CSS rules. */
    isolationIssuerLayer?: RuleSetCondition;
}
