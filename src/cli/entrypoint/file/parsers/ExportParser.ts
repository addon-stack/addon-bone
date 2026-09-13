import ts from "typescript";

import SourceFile from "../SourceFile";
import NodeFinder from "./NodeFinder";
import {ExportValueKind, type ExportValue} from "./types";

/** Describes default exports without assigning them a renderer, initializer or configuration role. */
export default class ExportParser {
    constructor(
        private readonly sourceFile: SourceFile,
        private readonly nodeFinder: NodeFinder,
        private readonly getCompilerOptions: () => ts.CompilerOptions
    ) {}

    public parseDefault(): ExportValue | undefined {
        const declaration = this.nodeFinder.findDefaultExport();
        if (!declaration) return undefined;
        if (ts.isFunctionDeclaration(declaration)) return {kind: ExportValueKind.Function, properties: []};
        if (ts.isClassDeclaration(declaration)) return {kind: ExportValueKind.Class, properties: []};
        if (ts.isExportAssignment(declaration)) {
            const value = this.describeExpression(declaration.expression);
            if (value) return value;
        }
        return this.describeType();
    }

    private describeExpression(expression: ts.Expression): ExportValue | undefined {
        while (
            ts.isParenthesizedExpression(expression) ||
            ts.isAsExpression(expression) ||
            ts.isSatisfiesExpression(expression) ||
            ts.isTypeAssertionExpression(expression) ||
            ts.isNonNullExpression(expression)
        ) {
            expression = expression.expression;
        }
        if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression))
            return {kind: ExportValueKind.Function, properties: []};
        if (ts.isClassExpression(expression)) return {kind: ExportValueKind.Class, properties: []};
        if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) || ts.isJsxFragment(expression))
            return {kind: ExportValueKind.Jsx, properties: []};
        if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
            return {kind: ExportValueKind.String, properties: [], value: expression.text};
        if (ts.isNumericLiteral(expression))
            return {kind: ExportValueKind.Number, properties: [], value: Number(expression.text)};
        if (ts.isObjectLiteralExpression(expression)) {
            const properties = new Set<string>();
            for (const property of expression.properties) {
                // Resolve spread/computed properties through the checker, without evaluating their values.
                if (ts.isSpreadAssignment(property) || ts.isComputedPropertyName(property.name)) return undefined;
                properties.add(property.name.text);
            }
            return {kind: ExportValueKind.Object, properties: [...properties]};
        }
        return undefined;
    }

    private describeType(): ExportValue | undefined {
        const filename = this.sourceFile.getSourceFile().fileName;
        // Keep the program local to this analysis: a watch rebuild must see changed imported exports.
        const program = ts.createProgram([filename], {...this.getCompilerOptions(), noEmit: true});
        const entry = program.getSourceFile(filename);
        if (!entry) return undefined;
        const checker = program.getTypeChecker();
        const module = checker.getSymbolAtLocation(entry);
        const exported = module && checker.getExportsOfModule(module).find(symbol => symbol.name === "default");
        if (!exported) return undefined;
        const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
        if (!(symbol.flags & ts.SymbolFlags.Value)) return undefined;
        const type = checker.getTypeOfSymbolAtLocation(symbol, entry);
        const properties = type.getProperties().map(property => property.name);
        if (type.getCallSignatures().length > 0) return {kind: ExportValueKind.Function, properties};
        if (type.getConstructSignatures().length > 0) return {kind: ExportValueKind.Class, properties};
        if (type.flags & ts.TypeFlags.StringLike)
            return {kind: ExportValueKind.String, properties, ...(type.isStringLiteral() ? {value: type.value} : {})};
        if (type.flags & ts.TypeFlags.NumberLike)
            return {kind: ExportValueKind.Number, properties, ...(type.isNumberLiteral() ? {value: type.value} : {})};
        return {kind: type.flags & ts.TypeFlags.Object ? ExportValueKind.Object : ExportValueKind.Other, properties};
    }
}
