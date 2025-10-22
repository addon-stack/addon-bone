import ts from "typescript";
import fs from "fs";
import path from "path";

import {ImportResolver} from "./resolvers";

import injectors from "./injectors";

import {EnumMap, ImportMap, Variable, VariableMap} from "./types";

export default class EntryFile {
    private sourceFile?: ts.SourceFile;

    private variables?: VariableMap;

    private imports?: ImportMap;

    private enums?: EnumMap;

    protected importResolver?: ImportResolver;

    static make<T extends EntryFile>(this: new (file: string) => T, file: string): T {
        return new this(file);
    }

    constructor(protected readonly file: string) {}

    public getSourceFile(): ts.SourceFile {
        if (this.sourceFile) {
            return this.sourceFile;
        }

        const sourceCode = fs.readFileSync(this.file, "utf8");

        return (this.sourceFile = ts.createSourceFile(this.file, sourceCode, ts.ScriptTarget.ESNext, true));
    }

    public getImports(): ImportMap {
        if (this.imports) {
            return this.imports;
        }

        this.imports = new Map();

        const parse = (node: ts.Node) => {
            if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
                const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
                if (node.importClause) {
                    // default import: import X from '...'
                    if (node.importClause.name) {
                        this.imports?.set(node.importClause.name.text, this.getInputResolver().get(importPath));
                    }
                    // named imports: import { A, B } from '...'
                    if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
                        node.importClause.namedBindings.elements.forEach(el => {
                            this.imports?.set(el.name.text, this.getInputResolver().get(importPath));
                        });
                    }
                }
            }
            // import equals: import X = Y.Z
            else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
                if (node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
                    const importPath = node.moduleReference.expression.text;
                    this.imports?.set(node.name.text, this.getInputResolver().get(importPath));
                }
            }
            // import equals with qualified name: import X = Y.Z
            else if (ts.isImportEqualsDeclaration(node)) {
                // For qualified names like chrome.tabs.Tab, we don't need to resolve a path
                // Just store the full qualified name as the "import path"
                const qualifiedName = node.moduleReference.getText();
                this.imports?.set(node.name.text, qualifiedName);
            }

            ts.forEachChild(node, parse);
        };

        parse(this.getSourceFile());

        return this.imports;
    }

    public getEnums(): EnumMap {
        if (this.enums) {
            return this.enums;
        }

        this.enums = new Map();

        const parse = (node: ts.Node) => {
            if (ts.isEnumDeclaration(node)) {
                const enumName = node.name.text;
                const enumProperties: Map<string, string | number> = new Map();

                node.members.forEach(member => {
                    const key = member.name.getText();
                    const value = member.initializer ? member.initializer.getText().replace(/['"]/g, "") : key;

                    enumProperties.set(key, value);
                });

                this.enums?.set(enumName, enumProperties);
            }

            ts.forEachChild(node, parse);
        };

        parse(this.getSourceFile());

        return this.enums;
    }

    public getVariables(): VariableMap {
        if (this.variables) {
            return this.variables;
        }

        this.variables = new Map();

        const parse = (node: ts.Node) => {
            if (ts.isVariableStatement(node)) {
                const isExported = node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);

                node.declarationList.declarations.forEach(declaration => {
                    if (ts.isIdentifier(declaration.name) && declaration.initializer) {
                        const name = declaration.name.text;
                        const value = this.parseNode(declaration.initializer);

                        this.variables?.set(name, {
                            name,
                            value,
                            exported: isExported || false,
                        });
                    }
                });
            }

            if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
                node.exportClause.elements.forEach(el => {
                    const name = el.name.text;

                    if (this.variables?.has(name)) {
                        const variable = this.variables?.get(name) as Variable;

                        this.variables?.set(name, {
                            name,
                            value: variable.value,
                            exported: true,
                        });
                    }
                });
            }

            if (ts.isExportAssignment(node)) {
                const expr = node.expression;
                if (ts.isIdentifier(expr) && this.variables?.has(expr.text)) {
                    const variable = this.variables?.get(expr.text) as Variable;
                    const name = "default";

                    this.variables?.set(name, {
                        name,
                        value: variable.value,
                        exported: true,
                    });
                }
            }

            ts.forEachChild(node, parse);
        };

        parse(this.getSourceFile());

        return this.variables;
    }

    protected resolveValue(from: string, target: string, name: string): any {
        return injectors([])(from, target, name);
    }

    protected findPropertyAccessValue(property: ts.Node): any {
        if (ts.isPropertyAccessExpression(property)) {
            const objectName = property.expression.getText();
            const propertyName = property.name.getText();

            const varItem = this.getVariables().get(objectName);

            if (varItem) {
                return varItem.value;
            }

            const enumItem = this.getEnums().get(objectName);

            if (enumItem) {
                return enumItem.get(propertyName);
            }

            const importItem = this.getImports().get(objectName);

            if (importItem) {
                const resolverItem = this.resolveValue(importItem, objectName, propertyName);

                if (resolverItem) {
                    return resolverItem;
                }

                return EntryFile.make(importItem).findPropertyAccessValue(property);
            }

            return `${objectName}.${propertyName}`;
        }

        return undefined;
    }

    public parseNode(node?: ts.Node): any {
        if (!node) {
            return undefined;
        }

        switch (node.kind) {
            case ts.SyntaxKind.StringLiteral:
                return (node as ts.StringLiteral).text;
            case ts.SyntaxKind.TrueKeyword:
                return true;
            case ts.SyntaxKind.FalseKeyword:
                return false;
            case ts.SyntaxKind.NullKeyword:
                return null;
            case ts.SyntaxKind.NumericLiteral:
                return parseFloat((node as ts.NumericLiteral).text);
            case ts.SyntaxKind.Identifier: {
                const id = node as ts.Identifier;
                const name = id.text;
                // local variable
                const local = this.variables?.get(name);
                if (local && local.value !== undefined) {
                    return local.value;
                }
                // imported constant: try to resolve its value from source file
                const importPath = this.getImports().get(name);
                if (importPath) {
                    // load imported file and check its variables
                    const parser = EntryFile.make(importPath);
                    const imported = parser.getVariables().get(name);
                    if (imported && imported.value !== undefined) {
                        return imported.value;
                    }
                }
                return name;
            }
            case ts.SyntaxKind.ArrayLiteralExpression:
                return (node as ts.ArrayLiteralExpression).elements.map(element => this.parseNode(element));
            case ts.SyntaxKind.ObjectLiteralExpression:
                return (node as ts.ObjectLiteralExpression).properties
                    .filter(
                        (property): property is ts.PropertyAssignment | ts.ShorthandPropertyAssignment =>
                            ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)
                    )
                    .reduce(
                        (acc, property) => {
                            if (ts.isComputedPropertyName(property.name)) {
                                return acc;
                            }

                            const key = (property.name as ts.Identifier | ts.StringLiteral).text;

                            // Determine the initializer node: for shorthand, use the identifier itself
                            const initNode = ts.isShorthandPropertyAssignment(property)
                                ? (property.name as ts.Identifier)
                                : (property.initializer as ts.Expression | undefined);

                            let value = this.parseNode(initNode);

                            // If value is still just an identifier name, resolve from collected variables
                            if (typeof value === "string" && this.variables?.has(value)) {
                                value = this.variables?.get(value)?.value;
                            }

                            acc[key] = value;

                            return acc;
                        },
                        {} as Record<string, any>
                    );
            case ts.SyntaxKind.PropertyAccessExpression: {
                return this.findPropertyAccessValue(node);
            }
            default:
                return undefined;
        }
    }

    protected getInputResolver(): ImportResolver {
        if (this.importResolver) {
            return this.importResolver;
        }

        return this.setImportResolver(new ImportResolver());
    }

    public setImportResolver(resolver: ImportResolver): ImportResolver {
        return (this.importResolver = resolver.setBaseDir(path.dirname(this.file)));
    }
}
