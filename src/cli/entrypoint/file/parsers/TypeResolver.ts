import ts from "typescript";
import fs from "fs";
import SourceFile from "../SourceFile";
import NodeFinder from "./NodeFinder";

/**
 * Resolves TypeScript type nodes to string representations.
 */
export default class TypeResolver {
    /**
     * Constructor for the TypeResolver.
     *
     * @param sourceFile The source file to resolve types from
     * @param nodeFinder Optional NodeFinder instance to use for finding nodes
     */
    constructor(
        private readonly sourceFile: SourceFile,
        private readonly nodeFinder?: NodeFinder
    ) {}

    /**
     * Resolves a TypeScript type node to a string, inlining type aliases when possible.
     *
     * @param typeNode The type node to resolve
     * @returns The resolved type as a string
     */
    public resolveTypeNode(typeNode: ts.TypeNode): string {
        // Handle union types (like Tab | undefined)
        if (ts.isUnionTypeNode(typeNode)) {
            return this.resolveUnionType(typeNode);
        }

        // Handle array types (like Tab[])
        if (ts.isArrayTypeNode(typeNode)) {
            return this.resolveArrayType(typeNode);
        }

        // inline type aliases
        if (ts.isTypeReferenceNode(typeNode)) {
            return this.resolveTypeReference(typeNode);
        }

        // fallback: use textual representation
        return this.normalizeSourceTypeText(typeNode.getText());
    }

    /**
     * Resolves a union type node to a string.
     *
     * @param typeNode The union type node to resolve
     * @returns The resolved union type as a string
     */
    public resolveUnionType(typeNode: ts.UnionTypeNode): string {
        const types = typeNode.types.map(t => this.resolveTypeNode(t));
        return types.join(" | ");
    }

    /**
     * Resolves an array type node to a string.
     *
     * @param typeNode The array type node to resolve
     * @returns The resolved array type as a string
     */
    public resolveArrayType(typeNode: ts.ArrayTypeNode): string {
        const elementType = this.resolveTypeNode(typeNode.elementType);
        return `${elementType}[]`;
    }

    /**
     * Resolves a type reference node to a string, inlining type aliases when possible.
     *
     * @param typeNode The type reference node to resolve
     * @returns The resolved type reference as a string
     */
    public resolveTypeReference(typeNode: ts.TypeReferenceNode): string {
        const name = typeNode.typeName.getText();

        // Try to inline the type alias
        const inlined = this.inlineAliasType(name);
        if (inlined) {
            return inlined;
        }

        // Check if the type is imported
        const importPath = this.sourceFile.getImports().get(name);
        if (importPath) {
            try {
                // Check if the file exists before creating a parser
                if (!fs.existsSync(importPath)) {
                    console.warn(`File not found: ${importPath} when resolving type reference ${name}`);
                    return typeNode.getText();
                }

                const parser = (this.sourceFile.constructor as typeof SourceFile).make(importPath);
                const typeResolver = new TypeResolver(parser);
                const nodeFinder = new NodeFinder(parser);

                // Check for interface declaration
                const interfaceDecl = nodeFinder.findInterfaceDeclaration(name);
                if (interfaceDecl) {
                    const props = typeResolver.extractInterfaceProperties(interfaceDecl);
                    return props.length ? `{${props.join("; ")};}` : `{}`;
                }

                // Check for type alias declaration
                const aliasDecl = nodeFinder.findTypeAliasDeclaration(name);
                if (aliasDecl) {
                    // Handle intersection types specially
                    if (ts.isIntersectionTypeNode(aliasDecl.type)) {
                        return typeResolver.processIntersectionType(aliasDecl.type);
                    }
                    return typeResolver.resolveTypeNode(aliasDecl.type);
                }
            } catch (error) {
                console.warn(`Error resolving type reference ${name} from ${importPath}:`, error);
            }
        }

        // If there are type arguments, resolve them
        if (typeNode.typeArguments && typeNode.typeArguments.length > 0) {
            const aliasName = typeNode.typeName.getText();
            // Resolve each type argument
            const resolvedArgs = typeNode.typeArguments.map(arg => this.resolveTypeNode(arg));
            // Construct the type with resolved arguments
            return `${aliasName}<${resolvedArgs.join(", ")}>`;
        }

        // preserve generics and other references
        return typeNode.getText();
    }

    /**
     * Attempts to inline a type alias.
     *
     * @param name The name of the type alias
     * @returns The inlined type alias or undefined if it cannot be inlined
     */
    public inlineAliasType(name: string): string | undefined {
        // Check if the type is imported from an external library
        const importPath = this.sourceFile.getImports().get(name);

        // Special case for chrome.* namespaces
        if (importPath && (importPath.startsWith("chrome.") || importPath.startsWith("browser."))) {
            return importPath;
        }

        if (importPath && !importPath.startsWith(".") && !importPath.startsWith("/") && !fs.existsSync(importPath)) {
            // This is an external library import, format it as import('libraryName').TypeName
            return `import('${importPath}').${name}`;
        }

        // Check for import equals declaration (import X = Y.Z)
        const nodeFinder = this.nodeFinder || new NodeFinder(this.sourceFile);
        const importEquals = nodeFinder.findImportEqualsDeclaration(name);
        if (importEquals && importEquals.moduleReference) {
            // For qualified names like chrome.tabs.Tab, return the qualified name
            if (ts.isQualifiedName(importEquals.moduleReference)) {
                return importEquals.moduleReference.getText();
            }
            // For external module references like 'somelib', handle as external library
            else if (
                ts.isExternalModuleReference(importEquals.moduleReference) &&
                importEquals.moduleReference.expression &&
                ts.isStringLiteral(importEquals.moduleReference.expression)
            ) {
                const libPath = importEquals.moduleReference.expression.text;
                return `import('${libPath}').${name}`;
            }
            // For other module references, return the text representation
            else {
                return importEquals.moduleReference.getText();
            }
        }

        // Find the type alias declaration
        const aliasDecl = this.findTypeAliasDeclaration(name);
        if (aliasDecl) {
            const typeNode = aliasDecl.type;

            // handle intersection type alias by flattening members
            if (ts.isIntersectionTypeNode(typeNode)) {
                return this.processIntersectionType(typeNode);
            }

            // For type reference nodes (like aliases to other types), preserve the original type
            if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
                // Get the full text of the type node, which includes any namespace qualifiers
                return typeNode.getText();
            }

            return this.resolveTypeNode(typeNode);
        }

        // local interface
        const localInterface = nodeFinder.findInterfaceDeclaration(name);
        if (localInterface) {
            const props = this.extractInterfaceProperties(localInterface);
            return props.length ? `{${props.join("; ")};}` : `{}`;
        }

        // Handle imported types
        if (importPath) {
            try {
                // Check if the file exists before creating a parser
                if (!fs.existsSync(importPath)) {
                    console.warn(`File not found: ${importPath} when resolving type alias ${name}`);
                    return undefined;
                }

                const parser = (this.sourceFile.constructor as typeof SourceFile).make(importPath);
                const typeResolver = new TypeResolver(parser);

                // imported type alias
                const aliasDecl = nodeFinder.findTypeAliasDeclaration(name);
                if (aliasDecl) {
                    // inline imported type alias (including intersections)
                    return typeResolver.inlineAliasType(name);
                }

                // imported interface
                const interfaceDecl = nodeFinder.findInterfaceDeclaration(name);
                if (interfaceDecl) {
                    const props = this.extractInterfaceProperties(interfaceDecl);
                    return props.length ? `{${props.join("; ")};}` : `{}`;
                }
            } catch (error) {
                console.warn(`Error resolving type alias ${name} from ${importPath}:`, error);
                return undefined;
            }
        }

        return undefined;
    }

    /**
     * Processes an intersection type node by flattening its members
     */
    private processIntersectionType(typeNode: ts.IntersectionTypeNode): string {
        const parts: string[] = [];
        const seen = new Set<string>();

        for (const t of typeNode.types) {
            // inline object literal types
            if (ts.isTypeLiteralNode(t)) {
                for (const m of t.members) {
                    let keyName: string;
                    let entry: string;
                    if (ts.isPropertySignature(m) && m.type) {
                        keyName = this.getName(m.name!);
                        const typeText = this.resolveTypeNode(m.type);
                        // Remove spaces in object types to match expected format
                        const formattedTypeText = typeText.replace(/\{\s+/g, "{").replace(/\s+\}/g, "}");
                        entry = `${keyName}: ${formattedTypeText}`;
                    } else if (ts.isMethodSignature(m) && m.name) {
                        keyName = this.getName(m.name);
                        const typeParams = m.typeParameters ? m.typeParameters.map(tp => tp.getText()) : [];
                        const tpText = typeParams.length ? `<${typeParams.join(",")}>` : "";
                        const paramsText = m.parameters
                            .map(p => {
                                const pname = ts.isIdentifier(p.name) ? p.name.text : p.name.getText();
                                const ptype = p.type ? this.resolveTypeNode(p.type) : "any";
                                // Remove spaces in object types to match expected format
                                const formattedPType = ptype.replace(/\{\s+/g, "{").replace(/\s+\}/g, "}");
                                return `${pname}: ${formattedPType}`;
                            })
                            .join(",");
                        const returnType = m.type ? this.resolveTypeNode(m.type) : "any";
                        // Remove spaces in object types to match expected format
                        const formattedReturnType = returnType.replace(/\{\s+/g, "{").replace(/\s+\}/g, "}");
                        entry = `${keyName}${tpText}(${paramsText}): ${formattedReturnType}`;
                    } else if (ts.isIndexSignatureDeclaration(m) && m.type) {
                        // Handle index signatures like [domain: string]: number;
                        const paramName = m.parameters[0].name.getText();
                        const paramType = m.parameters[0].type ? this.resolveTypeNode(m.parameters[0].type) : "any";
                        const returnType = this.resolveTypeNode(m.type);
                        // Use a special key for index signatures to avoid conflicts
                        keyName = `[${paramName}:${paramType}]`;
                        entry = `[${paramName}: ${paramType}]: ${returnType}`;
                    } else {
                        continue;
                    }
                    if (!seen.has(keyName)) {
                        seen.add(keyName);
                        parts.push(entry);
                    }
                }
            }
            // inline referenced aliases or interfaces
            else if (ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName)) {
                const refName = t.typeName.text;
                const sub = this.inlineAliasType(refName);
                if (sub) {
                    this.extractSegmentsFromType(sub, seen, parts);
                }
            }
        }

        return `{${parts.join("; ")};}`;
    }

    /**
     * Extracts segments from a type string, handling nested braces
     */
    private extractSegmentsFromType(typeStr: string, seen: Set<string>, parts: string[]): void {
        const inner = typeStr.slice(1, -1).trim();
        if (!inner) return;

        // split on top-level semicolons (ignore semicolons within braces)
        const segments: string[] = [];
        let depth = 0;
        let buf = "";

        for (const ch of inner) {
            if (ch === "{") {
                depth++;
                buf += ch;
            } else if (ch === "}") {
                depth--;
                buf += ch;
            } else if (ch === ";" && depth === 0) {
                const seg = buf.trim();
                if (seg) segments.push(seg);
                buf = "";
            } else {
                buf += ch;
            }
        }

        const last = buf.trim();
        if (last) segments.push(last);

        for (const s of segments) {
            const keyName = s.split(/[:(]/)[0];
            if (!seen.has(keyName)) {
                seen.add(keyName);
                parts.push(s);
            }
        }
    }

    /**
     * Extracts a textual property name.
     */
    private getName(name: ts.PropertyName | ts.BindingName | ts.Node): string {
        if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
            return name.text;
        }

        return name.getText();
    }

    /**
     * Normalizes raw TypeScript source text before it enters generated declarations.
     */
    private normalizeSourceTypeText(text: string): string {
        return text.replace(/\s+/g, " ").trim();
    }

    /**
     * Extracts properties from an interface declaration
     */
    public extractInterfaceProperties(interfaceDecl: ts.InterfaceDeclaration, parser: TypeResolver = this): string[] {
        const props: string[] = [];

        // include inherited members from extended interfaces
        if (interfaceDecl.heritageClauses) {
            for (const clause of interfaceDecl.heritageClauses) {
                if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                    for (const typeNode of clause.types) {
                        const expr = typeNode.expression;
                        if (ts.isIdentifier(expr)) {
                            const parent = parser.inlineAliasType(expr.text);
                            if (parent) {
                                const inner = parent.slice(1, -1).trim();
                                if (inner) {
                                    props.push(
                                        ...inner
                                            .split(/;\s*/)
                                            .map(s => s.trim())
                                            .filter(Boolean)
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add interface members
        for (const member of interfaceDecl.members) {
            if (ts.isPropertySignature(member) && member.type) {
                const key = parser.getName(member.name!);
                const optional = member.questionToken ? "?" : "";
                const typeText = parser.resolveTypeNode(member.type);
                props.push(`${key}${optional}: ${typeText}`);
            } else if (ts.isMethodSignature(member) && member.name) {
                const key = parser.getName(member.name);
                const typeParams = member.typeParameters ? member.typeParameters.map(tp => tp.getText()) : [];
                const tpText = typeParams.length ? `<${typeParams.join(",")}>` : "";

                const params = member.parameters
                    .map(p => {
                        const pname = ts.isIdentifier(p.name) ? p.name.text : p.name.getText();
                        const ptype = p.type ? parser.resolveTypeNode(p.type) : "any";
                        return `${pname}: ${ptype}`;
                    })
                    .join(", ");

                const returnType = member.type ? parser.resolveTypeNode(member.type) : "any";

                props.push(`${key}${tpText}(${params}): ${returnType}`);
            } else if (ts.isIndexSignatureDeclaration(member) && member.type) {
                // Handle index signatures like [domain: string]: number;
                const paramName = member.parameters[0].name.getText();
                const paramType = member.parameters[0].type ? parser.resolveTypeNode(member.parameters[0].type) : "any";
                const returnType = parser.resolveTypeNode(member.type);
                props.push(`[${paramName}: ${paramType}]: ${returnType}`);
            }
        }

        return props;
    }

    /**
     * Searches the AST of this file for a type alias declaration by name.
     *
     * @param name The name of the type alias to find
     * @returns The type alias declaration or undefined if not found
     */
    private findTypeAliasDeclaration(name: string): ts.TypeAliasDeclaration | undefined {
        return this.findNodeByName<ts.TypeAliasDeclaration>(
            (node, searchName): node is ts.TypeAliasDeclaration =>
                ts.isTypeAliasDeclaration(node) && node.name.text === searchName,
            name
        );
    }

    /**
     * Generic method to find a node of a specific type by name in the AST.
     *
     * @param predicate The predicate to match the node
     * @param name The name to search for
     * @returns The found node or undefined if not found
     */
    private findNodeByName<T extends ts.Node>(
        predicate: (node: ts.Node, name: string) => node is T,
        name: string
    ): T | undefined {
        const sf = this.sourceFile.getSourceFile();
        let found: T | undefined;

        const visit = (node: ts.Node) => {
            if (predicate(node, name)) {
                found = node;
            } else {
                ts.forEachChild(node, visit);
            }
        };

        ts.forEachChild(sf, visit);
        return found;
    }
}
