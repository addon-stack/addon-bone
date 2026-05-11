import ts from "typescript";
import {MemberSignature, MethodSignature, ParameterSignature} from "./types";
import TypeResolver from "./TypeResolver";
import JSDocParser from "./JSDocParser";

/**
 * Builds method and property signatures from TypeScript nodes.
 */
export default class SignatureBuilder {
    /**
     * Constructor for the SignatureBuilder.
     *
     * @param typeResolver The type resolver to use for resolving types
     */
    private readonly jsDocParser: JSDocParser;

    constructor(private readonly typeResolver: TypeResolver) {
        this.jsDocParser = new JSDocParser();
    }

    /**
     * Builds a method signature from a function-like node.
     *
     * @param method The function-like node to build a signature from
     * @returns The method signature
     */
    public getMethodSignature(
        method: ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.FunctionExpression | ts.ArrowFunction
    ): MethodSignature {
        // Get JSDoc parameter types if available
        const jsDocParamTypes =
            "parameters" in method
                ? this.jsDocParser.getJSDocParameterTypes(method as ts.SignatureDeclaration)
                : new Map<string, string>();

        // parameters
        const params: ParameterSignature[] = ("parameters" in method ? method.parameters : [])
            .filter(p => p.name.getText() !== "this")
            .map(p => {
                const name = ts.isIdentifier(p.name) ? p.name.text : p.name.getText();

                // Use JSDoc type if available, otherwise use TypeScript type
                const tsType = p.type ? this.typeResolver.resolveTypeNode(p.type) : "any";
                const jsDocType = jsDocParamTypes.get(name);
                const type = jsDocType || tsType;

                // Remove spaces in object types to match expected format
                const formattedType = type.replace(/{\s+/g, "{").replace(/\s+}/g, "}");
                const optional = p.questionToken !== undefined || p.initializer !== undefined;
                return {name, type: formattedType, optional};
            });

        // Get JSDoc type parameters if available, otherwise use TypeScript type parameters
        let typeParams: string[] = [];

        if ("parameters" in method) {
            const jsDocTypeParams = this.jsDocParser.getJSDocTypeParameters(method as ts.SignatureDeclaration);
            if (jsDocTypeParams.length > 0) {
                typeParams = jsDocTypeParams;
            } else if (method.typeParameters) {
                typeParams = method.typeParameters.map(tp => tp.getText());
            }
        } else {
            // For non-SignatureDeclaration types, check if typeParameters exists
            const methodWithTypeParams = method as {typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>};
            if (methodWithTypeParams.typeParameters) {
                typeParams = methodWithTypeParams.typeParameters.map(tp => tp.getText());
            }
        }

        // Get JSDoc return type if available
        const jsDocReturnType =
            "parameters" in method ? this.jsDocParser.getJSDocReturnType(method as ts.SignatureDeclaration) : undefined;

        // return type (inline aliases when possible)
        const returnNode = (method as ts.MethodDeclaration).type;
        const tsReturnType = returnNode ? this.typeResolver.resolveTypeNode(returnNode) : "any";

        // Use JSDoc return type if available, otherwise use TypeScript return type
        const returnType = jsDocReturnType || tsReturnType;

        // Remove spaces in object types to match expected format
        const formattedReturnType = returnType.replace(/{\s+/g, "{").replace(/\s+}/g, "}");

        return {
            kind: "method",
            typeParameters: typeParams,
            parameters: params,
            returnType: formattedReturnType,
        };
    }

    /**
     * Builds a function type string from a method signature.
     *
     * @param sig The method signature to build a function type from
     * @returns The function type as a string
     */
    public buildFunctionType(sig: MethodSignature): string {
        const params = sig.parameters.map(p => `${p.name}${p.optional ? "?" : ""}: ${p.type}`).join(", ");
        return `(${params}) => ${sig.returnType}`;
    }

    /**
     * Formats a record of member signatures into a string representation.
     *
     * @param members The record of member signatures to format
     * @returns The formatted members as a string
     */
    public formatMembers(members: Record<string, MemberSignature>): string {
        const parts: string[] = [];

        for (const [name, member] of Object.entries(members)) {
            if (member.kind === "method") {
                const typeParams = member.typeParameters.length ? `<${member.typeParameters.join(", ")}>` : "";

                // Clean up parameter types to remove any JSDoc comments
                const params = member.parameters
                    .map(p => {
                        // If the parameter type contains JSDoc comments, extract just the type
                        let paramType = p.type;
                        if (paramType.includes("@param")) {
                            // This is a parameter with JSDoc comments, extract just the type
                            const match = paramType.match(/{([^}]+)}/);
                            if (match) {
                                paramType = match[1];
                            }
                        }

                        return `${p.name}${p.optional ? "?" : ""}: ${paramType}`;
                    })
                    .join(", ");

                parts.push(`${name}${typeParams}(${params}): ${member.returnType};`);
            } else {
                parts.push(`${name}${member.optional ? "?" : ""}: ${member.type};`);
            }
        }

        return `{ ${parts.join(" ")} }`;
    }
}
