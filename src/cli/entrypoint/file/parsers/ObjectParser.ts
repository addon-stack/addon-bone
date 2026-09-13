import ts from "typescript";
import _ from "lodash";

import SourceFile from "../SourceFile";
import AbstractParser from "./AbstractParser";
import SignatureBuilder from "./SignatureBuilder";
import JSDocParser from "./JSDocParser";

import {shouldIncludeMember} from "./helpers/memberFilters";

import {MemberSignature} from "./types";

/**
 * Parses object literal expressions.
 */
export default class ObjectParser extends AbstractParser {
    /**
     * Constructor for the ObjectParser.
     *
     * @param sourceFile The source file to parse
     * @param signatureBuilder The signature builder to use for building signatures
     */
    private readonly jsDocParser: JSDocParser;

    constructor(
        sourceFile: SourceFile,
        private readonly signatureBuilder: SignatureBuilder
    ) {
        super(sourceFile);

        this.jsDocParser = new JSDocParser();
    }

    /**
     * Parses an object literal: each property becomes a member signature.
     *
     * @param obj The object literal expression to parse
     * @returns A record of member signatures
     */
    public parse(obj: ts.ObjectLiteralExpression): Record<string, MemberSignature> {
        const result: Record<string, MemberSignature> = {};

        for (const prop of obj.properties) {
            // key name helper
            const key = this.getName(prop.name ?? prop);

            // Skip members that start with underscore
            if (!shouldIncludeMember(key)) {
                continue;
            }

            if (ts.isPropertyAssignment(prop)) {
                const init = prop.initializer;

                if (ts.isFunctionExpression(init) || ts.isArrowFunction(init)) {
                    result[key] = this.signatureBuilder.getMethodSignature(init);
                } else {
                    // Check for JSDoc @type annotation
                    const jsDocType = this.jsDocParser.getJSDocType(prop);
                    const tsType = this.inferTypeFromExpression(init);

                    result[key] = {
                        kind: "property",
                        type: jsDocType || tsType,
                    };
                }
            } else if (ts.isMethodDeclaration(prop)) {
                result[key] = this.signatureBuilder.getMethodSignature(prop);
            } else if (ts.isShorthandPropertyAssignment(prop)) {
                const name = prop.name.text;
                const variable = this.sourceFile.getVariables().get(name);
                const val = variable ? variable.value : undefined;

                let type = "any";

                if (!_.isUndefined(val)) {
                    if (_.isString(val)) {
                        type = "string";
                    } else if (_.isNumber(val)) {
                        type = "number";
                    } else if (_.isBoolean(val)) {
                        type = "boolean";
                    } else if (_.isArray(val)) {
                        type = "array";
                    } else if (_.isPlainObject(val)) {
                        type = "object";
                    }
                }

                result[key] = {kind: "property", type};
            }
        }

        return result;
    }

    /**
     * Infers a type string from an expression.
     *
     * @param expr The expression to infer a type from
     * @returns The inferred type as a string
     */
    public inferTypeFromExpression(expr: ts.Expression): string {
        // Shape inference does not require every member to be a statically known value.
        if (ts.isObjectLiteralExpression(expr)) return "object";
        if (ts.isArrayLiteralExpression(expr)) return "array";
        const result = this.sourceFile.parseNode(expr);
        if (!result.resolved) return "any";
        const val = result.value;

        switch (typeof val) {
            case "string":
                return "string";
            case "number":
                return "number";
            case "boolean":
                return "boolean";
            case "object":
                if (val === null) return "null";
                if (_.isArray(val)) return "array";
                return "object";
            default:
                return "any";
        }
    }
}
