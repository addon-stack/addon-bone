import ts from "typescript";

import SourceFile from "./SourceFile";
import {
    ClassParser,
    FunctionParser,
    JSDocParser,
    NodeFinder,
    ObjectParser,
    SignatureBuilder,
    TypeResolver,
} from "./parsers";
import {MemberSignature} from "./parsers/types";

import {PackageName} from "@typing/app";

/**
 * Parses a TypeScript expression (object literal, function, or class)
 * and builds a full interface of its public members (methods and properties).
 */
export default class ExpressionFile extends SourceFile {
    protected property?: string;
    /**
     * Names of wrapper functions whose first argument should be unwrapped for parsing.
     */
    protected definition = new Set<string>();

    private readonly typeResolver: TypeResolver;
    private readonly nodeFinder: NodeFinder;
    private readonly signatureBuilder: SignatureBuilder;
    private readonly functionParser: FunctionParser;
    private readonly objectParser: ObjectParser;
    private readonly classParser: ClassParser;
    private readonly jsDocParser: JSDocParser;

    constructor(filePath: string) {
        super(filePath);

        this.typeResolver = new TypeResolver(this);
        this.nodeFinder = new NodeFinder(this);
        this.signatureBuilder = new SignatureBuilder(this.typeResolver);
        this.objectParser = new ObjectParser(this, this.signatureBuilder);
        this.classParser = new ClassParser(this, this.typeResolver, this.signatureBuilder, this.nodeFinder);
        this.functionParser = new FunctionParser(this, this.nodeFinder, this.objectParser, this.classParser);
        this.jsDocParser = new JSDocParser();
    }

    public getType(): string | undefined {
        // If a specific variable or property is requested, extract its type
        if (this.property) {
            // 1) Named variable scenario: e.g. export const init = () => ...
            const varDecl = this.nodeFinder.findVariableDeclaration(this.property);

            if (varDecl && varDecl.initializer) {
                return this.getTypeFromInitializer(varDecl.initializer);
            }

            // 2) Property on default export object: unwrap and look up key
            let exportExpr: ts.Expression | undefined;
            const sf = this.getSourceFile();

            const findExport = (node: ts.Node) => {
                if (ts.isExportAssignment(node)) {
                    exportExpr = node.expression;
                }
                ts.forEachChild(node, findExport);
            };

            findExport(sf);

            if (!exportExpr) return undefined;

            // Special case for service definitions with JSDoc annotations
            if (this.definition.size > 0 && ts.isCallExpression(exportExpr) && ts.isIdentifier(exportExpr.expression)) {
                const fnName = exportExpr.expression.text;

                if (this.definition.has(fnName)) {
                    // Check if the wrapper function is imported from the designated package name
                    let importPath: string | undefined;
                    try {
                        importPath = this.getImports().get(fnName);
                    } catch {
                        // unable to resolve import source -> ignore wrapper
                        return undefined;
                    }

                    if (importPath !== PackageName) {
                        // Function is not imported from the designated package name -> ignore wrapper
                        console.warn(`Function ${fnName} is not imported from '${PackageName}' in file ${this.file}`);
                        return undefined;
                    }

                    if (exportExpr.arguments.length > 0) {
                        const firstArg = exportExpr.arguments[0];

                        if (ts.isObjectLiteralExpression(firstArg)) {
                            for (const prop of firstArg.properties) {
                                const key = this.objectParser.getName(prop.name ?? prop);

                                if (key !== this.property) continue;

                                if (ts.isPropertyAssignment(prop)) {
                                    const initType = this.getTypeFromInitializer(prop.initializer);
                                    if (initType) return initType;
                                } else if (ts.isMethodDeclaration(prop)) {
                                    // Get the return type of the method
                                    const returnType = this.getTypeFromMethodReturn(prop);
                                    if (returnType) return returnType;
                                } else if (ts.isShorthandPropertyAssignment(prop)) {
                                    return this.resolveTypeFromShorthand(prop.name.text);
                                }
                            }
                        }
                    }
                }
            }

            const expr = this.unwrapExpression(exportExpr);

            if (ts.isObjectLiteralExpression(expr)) {
                for (const prop of expr.properties) {
                    const key = this.objectParser.getName(prop.name ?? prop);

                    if (key !== this.property) continue;

                    if (ts.isPropertyAssignment(prop)) {
                        return this.getTypeFromInitializer(prop.initializer);
                    } else if (ts.isMethodDeclaration(prop) || ts.isGetAccessorDeclaration(prop)) {
                        const sig = this.signatureBuilder.getMethodSignature(prop as ts.MethodDeclaration);

                        return this.signatureBuilder.buildFunctionType(sig);
                    } else if (ts.isShorthandPropertyAssignment(prop)) {
                        return this.resolveTypeFromShorthand(prop.name.text);
                    }
                }
                return undefined;
            }

            // Fallback: treat default export expression as initializer
            return this.getTypeFromInitializer(expr);
        }

        // Default: parse full default export into interface-like string
        let members: Record<string, MemberSignature> | undefined;
        const sf = this.getSourceFile();

        const collect = (node: ts.Node) => {
            if (ts.isExportAssignment(node)) {
                const expr0 = node.expression;
                const expr = this.unwrapExpression(expr0);
                const parsed = this.parse(expr);
                if (parsed) members = parsed;
            }
            ts.forEachChild(node, collect);
        };

        collect(sf);
        if (!members) return undefined;
        return this.signatureBuilder.formatMembers(members);
    }

    public setProperty(property: string): this {
        this.property = property;

        return this;
    }

    /**
     * Entry point: accepts an expression and returns a map of member signatures,
     * or undefined if the expression cannot be parsed.
     */
    protected parse(expr: ts.Expression): Record<string, MemberSignature> | undefined {
        if (ts.isFunctionExpression(expr) || ts.isArrowFunction(expr)) {
            return this.functionParser.parse(expr);
        } else if (ts.isObjectLiteralExpression(expr)) {
            return this.objectParser.parse(expr);
        } else if (ts.isClassExpression(expr)) {
            return this.classParser.parse(expr);
        }

        return undefined;
    }

    /**
     * Specify wrapper functions whose first argument should be unwrapped for parsing.
     */
    public setDefinition(definition: string | string[]): this {
        const defs = typeof definition === "string" ? [definition] : definition;

        defs.forEach(def => this.definition.add(def));

        return this;
    }

    /**
     * Recursively unwraps type assertions, satisfies, parentheses, and allowed wrapper calls.
     */
    private unwrapExpression(expr: ts.Expression): ts.Expression {
        // First use the AbstractExpressionParser's unwrapExpression for basic unwrapping
        expr = this.functionParser.unwrapExpression(expr);

        // Explicitly handle type assertions
        if (ts.isAsExpression(expr)) {
            return this.unwrapExpression(expr.expression);
        }

        // Then handle the additional unwrapping for known definition wrappers
        if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
            const fnName = expr.expression.text;

            if (this.definition.has(fnName)) {
                let importPath: string | undefined;

                try {
                    importPath = this.getImports().get(fnName);
                } catch {
                    // unable to resolve import source -> ignore wrapper
                    return expr;
                }

                if (importPath !== PackageName) {
                    console.warn(`Function ${fnName} is not imported from '${PackageName}' in file ${this.file}`);
                } else if (expr.arguments.length > 0) {
                    const first = expr.arguments[0];
                    return this.unwrapExpression(first as ts.Expression);
                }
            }
        }

        return expr;
    }

    /**
     * Given an initializer or expression, extracts its type: function signature or interface.
     */
    private getTypeFromInitializer(
        node: ts.Expression | ts.MethodDeclaration | ts.GetAccessorDeclaration
    ): string | undefined {
        // Unwrap type assertions
        if (ts.isAsExpression(node)) {
            return this.getTypeFromInitializer(node.expression);
        }

        // Function or arrow function: try to parse returned object or instance
        if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
            // attempt to parse returned expression into members
            const members = this.functionParser.parse(node as ts.FunctionExpression | ts.ArrowFunction);

            if (members) {
                return this.signatureBuilder.formatMembers(members);
            }

            // fallback to function signature
            const sig = this.signatureBuilder.getMethodSignature(node as ts.FunctionExpression | ts.ArrowFunction);

            return this.signatureBuilder.buildFunctionType(sig);
        }

        // Class or method-like: signature of accessor/method
        if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) {
            const sig = this.signatureBuilder.getMethodSignature(node as ts.MethodDeclaration);
            return this.signatureBuilder.buildFunctionType(sig);
        }

        // Object literal, class expression/declaration, or new expression: return interface of members
        let members: Record<string, MemberSignature> | undefined;

        if (ts.isObjectLiteralExpression(node) || ts.isClassExpression(node) || ts.isClassDeclaration(node)) {
            members = this.parse(node as ts.Expression);
        } else if (ts.isNewExpression(node)) {
            const ctor = node.expression;

            if (ts.isIdentifier(ctor)) {
                members = this.classParser.parseFileClass(ctor.text);
            } else if (ts.isClassExpression(ctor)) {
                members = this.classParser.parse(ctor);
            }
        }

        if (members) {
            return this.signatureBuilder.formatMembers(members);
        }

        if (ts.isLiteralExpression(node) || ts.isArrayLiteralExpression(node) || ts.isObjectLiteralExpression(node)) {
            return this.objectParser.inferTypeFromExpression(node as ts.Expression);
        }

        return undefined;
    }

    private resolveTypeFromShorthand(name: string): string | undefined {
        const varDecl = this.nodeFinder.findVariableDeclaration(name);
        if (varDecl && varDecl.initializer) {
            const t = this.getTypeFromInitializer(varDecl.initializer);
            if (t) return t;
        }
        const variable = this.getVariables().get(name);
        if (variable) {
            const val = variable.value;
            switch (typeof val) {
                case "string":
                    return "string";
                case "number":
                    return "number";
                case "boolean":
                    return "boolean";
                case "object":
                    if (val === null) return "null";
                    if (Array.isArray(val)) return "array";
                    return "object";
                default:
                    return "any";
            }
        }
        return "any";
    }

    /**
     * Extracts the type of the return value of a method, taking into account JSDoc annotations.
     *
     * @param method The method declaration to extract the return type from
     * @returns The extracted return type as a string, or undefined if it cannot be extracted
     */
    private getTypeFromMethodReturn(method: ts.MethodDeclaration): string | undefined {
        // Try to find a return statement in the method body
        if (method.body) {
            // First, check if there's a JSDoc return type annotation
            const jsDocReturnType = this.jsDocParser.getJSDocReturnType(method);
            if (jsDocReturnType) {
                // If the return type is a new expression, try to parse it
                if (jsDocReturnType.includes("new ")) {
                    const className = jsDocReturnType.replace("new ", "").trim();
                    const members = this.classParser.parseFileClass(className);
                    if (members) {
                        return this.signatureBuilder.formatMembers(members);
                    }
                }

                // If the return type is a class name, try to parse it
                const members = this.classParser.parseFileClass(jsDocReturnType);
                if (members) {
                    return this.signatureBuilder.formatMembers(members);
                }

                return jsDocReturnType;
            }

            // If there's no JSDoc return type, try to find a return statement
            let returnExpr: ts.Expression | undefined;

            const findReturn = (node: ts.Node): void => {
                if (ts.isReturnStatement(node) && node.expression) {
                    returnExpr = node.expression;
                    return;
                }
                ts.forEachChild(node, findReturn);
            };

            findReturn(method.body);

            if (returnExpr) {
                return this.getTypeFromInitializer(returnExpr);
            }
        }

        // If we couldn't find a return statement, use the method's return type
        if (method.type) {
            return this.typeResolver.resolveTypeNode(method.type);
        }

        return undefined;
    }
}
