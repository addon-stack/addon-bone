import ts from "typescript";
import fs from "fs";
import path from "path";

import {ImportResolver} from "./resolvers";
import injectors from "./injectors";
import type {
    ImportMap,
    VariableMap,
    SourceValue,
    SourceReadResult,
    SourceBinding,
    SourceReadContext,
    SourceResolvedBinding,
} from "./types";

export default class SourceFile {
    private sourceFile?: ts.SourceFile;
    private variables?: VariableMap;
    private imports?: ImportMap;
    private sources = new Map<string, SourceFile>();
    protected importResolver?: ImportResolver;

    static make<T extends SourceFile>(this: new (file: string) => T, file: string): T {
        return new this(file);
    }

    constructor(protected readonly file: string) {}

    public getSourceFile(): ts.SourceFile {
        if (!this.sourceFile) {
            const sourceCode = fs.readFileSync(this.file, "utf8");
            this.sourceFile = ts.createSourceFile(this.file, sourceCode, ts.ScriptTarget.ESNext, true);
        }
        return this.sourceFile;
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
                    if (node.importClause.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) {
                        this.imports?.set(
                            node.importClause.namedBindings.name.text,
                            this.getInputResolver().get(importPath)
                        );
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

    /** Collect declarations without evaluating runtime functions or unrelated initializers. */
    protected getBindings(exportedOnly = false): Map<string, SourceBinding> {
        const bindings = new Map<string, SourceBinding>();
        const bind = (name: string, node: ts.Node) => bindings.set(name, {source: this, node});
        for (const statement of this.getSourceFile().statements) {
            const exported =
                ts.canHaveModifiers(statement) &&
                ts.getModifiers(statement)?.some(item => item.kind === ts.SyntaxKind.ExportKeyword);
            if (ts.isVariableStatement(statement) && (!exportedOnly || exported)) {
                for (const declaration of statement.declarationList.declarations) {
                    if (ts.isIdentifier(declaration.name)) bind(declaration.name.text, declaration);
                    else {
                        const collect = (node: ts.Node) => {
                            if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) bind(node.name.text, node);
                            else ts.forEachChild(node, collect);
                        };
                        collect(declaration.name);
                    }
                }
            } else if (
                (ts.isEnumDeclaration(statement) ||
                    ts.isFunctionDeclaration(statement) ||
                    ts.isClassDeclaration(statement)) &&
                (!exportedOnly || exported) &&
                statement.name
            ) {
                const isDefault = ts.getModifiers(statement)?.some(item => item.kind === ts.SyntaxKind.DefaultKeyword);
                bind(exportedOnly && isDefault ? "default" : statement.name.text, statement);
            }
            if (exportedOnly && ts.isExportAssignment(statement) && !statement.isExportEquals) {
                bind("default", statement.expression);
            }
            if (
                exportedOnly &&
                ts.isExportDeclaration(statement) &&
                !statement.isTypeOnly &&
                statement.exportClause &&
                ts.isNamedExports(statement.exportClause)
            ) {
                for (const item of statement.exportClause.elements) {
                    if (!item.isTypeOnly)
                        bind(item.name.text, statement.moduleSpecifier ? item : (item.propertyName ?? item.name));
                }
            }
        }
        return bindings;
    }

    public getVariables(): VariableMap {
        if (this.variables) return this.variables;
        const locals = this.getBindings();
        const exported = this.getBindings(true);
        this.variables = new Map();
        for (const [name, binding] of new Map([...locals, ...exported])) {
            const result = this.parseNode(binding.node, name);
            // Signature inference can use known values without requiring executable code to be static.
            this.variables.set(name, {
                name,
                value: result.resolved ? result.value : undefined,
                exported: exported.has(name),
            });
        }
        return this.variables;
    }

    protected resolveValue(from: string, target: string, name: string): any {
        return injectors([])(from, target, name);
    }

    private getImportBinding(name: string): {from: string; name: string} | undefined {
        for (const statement of this.getSourceFile().statements) {
            if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
            const clause = statement.importClause;
            const from = statement.moduleSpecifier.text;
            if (clause?.name?.text === name) return {from, name: "default"};
            if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
                const item = clause.namedBindings.elements.find(item => item.name.text === name);
                if (item) return {from, name: (item.propertyName ?? item.name).text};
            }
            if (
                clause?.namedBindings &&
                ts.isNamespaceImport(clause.namedBindings) &&
                clause.namedBindings.name.text === name
            )
                return {from, name: "*"};
        }
    }

    private getImportedSource(from: string): SourceFile | undefined {
        const filename = this.getInputResolver().get(from);
        if (!filename || !path.isAbsolute(filename) || !/\.[cm]?[jt]sx?$/.test(filename) || !fs.existsSync(filename))
            return;
        let source = this.sources.get(filename);
        if (!source) {
            source = new SourceFile(filename);
            source.setImportResolver(this.getInputResolver());
            source.sources = this.sources;
            this.sources.set(filename, source);
        }
        return source;
    }

    private failure(context: SourceReadContext, reason: string): SourceReadResult<never> {
        return {resolved: false, file: this.file, path: context.path, reason};
    }

    /** Follow static bindings, retaining their source module and detecting reference cycles. */
    private resolveNode(
        node: ts.Node | undefined,
        context: SourceReadContext
    ): SourceReadResult<SourceResolvedBinding> {
        if (!node) return this.failure(context, "missing initializer");
        const key = `${this.file}:${node.pos}:${node.end}`;
        if (context.seen.has(key)) return this.failure(context, "circular reference");
        context = {...context, seen: new Set([...context.seen, key])};
        if (
            ts.isAsExpression(node) ||
            ts.isTypeAssertionExpression(node) ||
            ts.isSatisfiesExpression(node) ||
            ts.isParenthesizedExpression(node) ||
            ts.isNonNullExpression(node)
        ) {
            return this.resolveNode(node.expression, context);
        }
        if (ts.isVariableDeclaration(node)) {
            if (!ts.isVariableDeclarationList(node.parent) || !(node.parent.flags & ts.NodeFlags.Const))
                return this.failure(context, "use a const declaration for build options");
            return this.resolveNode(node.initializer, context);
        }
        if (ts.isExportSpecifier(node) && ts.isExportDeclaration(node.parent.parent)) {
            const from = node.parent.parent.moduleSpecifier;
            const name = (node.propertyName ?? node.name).text;
            const binding =
                from && ts.isStringLiteral(from)
                    ? this.getImportedSource(from.text)?.getBindings(true).get(name)
                    : undefined;
            if (binding) return binding.source.resolveNode(binding.node, context);
            return this.failure(context, `cannot resolve re-exported value ${name}`);
        }
        if (ts.isIdentifier(node)) {
            const local = this.getBindings().get(node.text);
            if (local) return local.source.resolveNode(local.node, context);
            const imported = this.getImportBinding(node.text);
            if (imported) {
                const source = this.getImportedSource(imported.from);
                const binding = source?.getBindings(true).get(imported.name);
                if (binding) return binding.source.resolveNode(binding.node, context);
                return this.failure(context, `cannot resolve imported value ${node.text}`);
            }
            if (node.text !== "undefined") return this.failure(context, `unresolved identifier ${node.text}`);
        }
        return {resolved: true, value: {source: this, node, context}};
    }

    public parseNode(node?: ts.Node, property = ""): SourceReadResult {
        return this.readValue(node, {path: property, seen: new Set()});
    }

    /** Read an object's shape first so callers can select build fields before evaluating values. */
    protected getProperties(node: ts.Node, property = ""): SourceReadResult<Map<string, SourceBinding>> {
        return this.readProperties(node, {path: property, seen: new Set()});
    }

    private readProperties(node: ts.Node, context: SourceReadContext): SourceReadResult<Map<string, SourceBinding>> {
        const result = this.resolveNode(node, context);
        if (!result.resolved) return result;
        const binding = result.value;
        if (!ts.isObjectLiteralExpression(binding.node))
            return binding.source.failure(binding.context, "expected a static object");
        return binding.source.objectProperties(binding.node, binding.context);
    }

    private objectProperties(
        node: ts.ObjectLiteralExpression,
        context: SourceReadContext
    ): SourceReadResult<Map<string, SourceBinding>> {
        const properties = new Map<string, SourceBinding>();
        for (const property of node.properties) {
            if (ts.isSpreadAssignment(property)) {
                const spread = this.readProperties(property.expression, context);
                if (!spread.resolved) return spread;
                for (const [key, binding] of spread.value) properties.set(key, binding);
                continue;
            }
            let key: string;
            if (ts.isComputedPropertyName(property.name)) {
                const result = this.readValue(property.name.expression, context);
                if (!result.resolved) return result;
                if (typeof result.value !== "string" && typeof result.value !== "number")
                    return this.failure(context, "object keys must be strings or numbers");
                key = String(result.value);
            } else {
                key = property.name.text;
            }
            properties.set(key, {
                source: this,
                node: ts.isPropertyAssignment(property)
                    ? property.initializer
                    : ts.isShorthandPropertyAssignment(property)
                      ? property.name
                      : property,
            });
        }
        return {resolved: true, value: properties};
    }

    private readValue(node: ts.Node | undefined, context: SourceReadContext): SourceReadResult {
        const resolved = this.resolveNode(node, context);
        if (!resolved.resolved) return resolved;
        const binding = resolved.value;
        return binding.source.readResolvedValue(binding.node, binding.context);
    }

    private readResolvedValue(node: ts.Node, context: SourceReadContext): SourceReadResult {
        const success = (value: SourceValue): SourceReadResult => ({resolved: true, value});
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return success(node.text);
        if (ts.isNumericLiteral(node)) return success(Number(node.text));
        if (node.kind === ts.SyntaxKind.TrueKeyword) return success(true);
        if (node.kind === ts.SyntaxKind.FalseKeyword) return success(false);
        if (node.kind === ts.SyntaxKind.NullKeyword) return success(null);
        if (ts.isIdentifier(node) && node.text === "undefined") return success(undefined);
        if (ts.isPrefixUnaryExpression(node)) {
            const operand = this.readValue(node.operand, context);
            if (!operand.resolved) return operand;
            if (
                typeof operand.value === "number" &&
                (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken)
            )
                return success(node.operator === ts.SyntaxKind.MinusToken ? -operand.value : operand.value);
            return this.failure(context, "unsupported unary expression");
        }
        if (ts.isArrayLiteralExpression(node)) {
            const values: SourceValue[] = [];
            for (const [index, element] of node.elements.entries()) {
                const result = this.readValue(ts.isSpreadElement(element) ? element.expression : element, {
                    ...context,
                    path: `${context.path}[${index}]`,
                });
                if (!result.resolved) return result;
                if (ts.isSpreadElement(element)) {
                    if (!Array.isArray(result.value))
                        return this.failure(context, "array spread must reference a static array");
                    values.push(...result.value);
                } else values.push(result.value);
            }
            return success(values);
        }
        if (ts.isObjectLiteralExpression(node)) {
            const properties = this.objectProperties(node, context);
            if (!properties.resolved) return properties;
            const values: [string, SourceValue][] = [];
            for (const [key, binding] of properties.value) {
                const result = binding.source.readValue(binding.node, {
                    ...context,
                    path: context.path ? `${context.path}.${key}` : key,
                });
                if (!result.resolved) return result;
                values.push([key, result.value]);
            }
            return success(Object.fromEntries(values));
        }
        if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
            const property = ts.isPropertyAccessExpression(node)
                ? success(node.name.text)
                : this.readValue(node.argumentExpression, context);
            if (!property.resolved) return property;
            if (typeof property.value !== "string" && typeof property.value !== "number")
                return this.failure(context, "member name must be a string or number");
            const name = String(property.value);
            if (ts.isIdentifier(node.expression) && !this.getBindings().has(node.expression.text)) {
                const imported = this.getImportBinding(node.expression.text);
                if (imported) {
                    const value = this.resolveValue(imported.from, imported.name, name);
                    if (value !== undefined) return success(value);
                    if (imported.name === "*") {
                        const binding = this.getImportedSource(imported.from)?.getBindings(true).get(name);
                        if (binding) return binding.source.readValue(binding.node, context);
                    }
                }
            }
            const resolved = this.resolveNode(node.expression, context);
            if (!resolved.resolved) return resolved;
            const binding = resolved.value;
            if (ts.isObjectLiteralExpression(binding.node)) {
                const properties = binding.source.objectProperties(binding.node, binding.context);
                if (!properties.resolved) return properties;
                const member = properties.value.get(name);
                if (member) return member.source.readValue(member.node, binding.context);
                return this.failure(context, `unknown member ${name}`);
            }
            const object = binding.source.readResolvedValue(binding.node, binding.context);
            if (!object.resolved) return object;
            if (object.value !== null && typeof object.value === "object" && Object.hasOwn(object.value, name))
                return success((object.value as Record<string, SourceValue>)[name]);
            return this.failure(context, `unknown member ${name}`);
        }
        if (ts.isEnumDeclaration(node)) {
            const values: Record<string, SourceValue> = {};
            let previous: SourceValue = -1;
            for (const member of node.members) {
                const result = member.initializer
                    ? this.readValue(member.initializer, context)
                    : typeof previous === "number"
                      ? success(previous + 1)
                      : this.failure(context, "enum member needs a static initializer");
                if (!result.resolved) return result;
                if (typeof result.value !== "string" && typeof result.value !== "number")
                    return this.failure(context, "enum values must be strings or numbers");
                if (ts.isComputedPropertyName(member.name))
                    return this.failure(context, "computed enum names are not supported");
                values[member.name.text] = previous = result.value;
            }
            return success(values);
        }
        return this.failure(
            context,
            `unsupported ${ts.SyntaxKind[node.kind]}; use literals, constants or supported enum members`
        );
    }

    protected getInputResolver(): ImportResolver {
        if (!this.importResolver) this.importResolver = new ImportResolver();
        return this.importResolver.setBaseDir(path.dirname(this.file));
    }

    public setImportResolver(resolver: ImportResolver): ImportResolver {
        return (this.importResolver = resolver.setBaseDir(path.dirname(this.file)));
    }
}
