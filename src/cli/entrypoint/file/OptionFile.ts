import ts from "typescript";
import _ from "lodash";

import SourceFile from "./SourceFile";
import type {SourceBinding, SourceReadResult} from "./types";

import {PackageName} from "@typing/app";

export default class<T extends Record<string, any>> extends SourceFile {
    protected definitions = new Set<string>();

    protected definition: string | null | undefined = undefined;

    protected properties = new Set<string>();

    public setDefinition(definition: string | string[]): this {
        if (_.isString(definition)) {
            definition = [definition];
        }

        definition.forEach(definition => this.definitions.add(definition));

        return this;
    }

    public setProperties(properties: string[]): this {
        properties.forEach(property => this.properties.add(property));

        return this;
    }

    public getOptions(): T {
        const options: [string, unknown][] = [];
        for (const [name, binding] of this.getOptionBindings()) {
            if (!this.properties.has(name)) continue;
            const value = this.requireValue(binding.source.parseNode(binding.node, name));
            options.push([name, value]);
        }
        return Object.fromEntries(options) as T;
    }

    /** Presence does not require evaluating the property's value (for example a render method). */
    public getDeclaredProperties(): Set<string> {
        return new Set(this.getOptionBindings().keys());
    }

    public getDefinition(): string | undefined {
        if (this.definition === undefined) this.getOptionBindings();
        return this.definition ?? undefined;
    }

    private requireValue<V>(result: SourceReadResult<V>): V {
        if (result.resolved) return result.value;
        const origin = result.file === this.file ? "" : ` (declared in "${result.file}")`;
        throw new Error(
            `Invalid options in "${this.file}": ${result.path || "options"} must be statically known: ${result.reason}${origin}`
        );
    }

    private getOptionBindings(): Map<string, SourceBinding> {
        const bindings = this.getBindings(true);
        bindings.delete("default");
        for (const statement of this.getSourceFile().statements) {
            if (!ts.isExportAssignment(statement)) continue;
            const expression = this.getExpressionForOptions(statement.expression);
            if (!expression) continue;
            const properties = this.requireValue(this.getProperties(expression));
            for (const [name, binding] of properties) bindings.set(name, binding);
        }
        return bindings;
    }

    protected getExpressionForOptions(expr: ts.Expression): ts.Expression | undefined {
        this.definition = null;

        while (
            ts.isAsExpression(expr) ||
            ts.isSatisfiesExpression(expr) ||
            ts.isParenthesizedExpression(expr) ||
            ts.isTypeAssertionExpression(expr)
        ) {
            expr = expr.expression;
        }

        if (ts.isObjectLiteralExpression(expr)) {
            return expr;
        } else if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
            const functionName = expr.expression.text;

            if (this.getImports().get(functionName) !== PackageName) {
                console.warn(`Function ${functionName} is not imported from '${PackageName}' on file ${this.file}`);

                return;
            }

            if (this.definitions.has(functionName) && expr.arguments.length > 0) {
                this.definition = functionName;
                return expr.arguments[0];
            }
        }
    }
}
