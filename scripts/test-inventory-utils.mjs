import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import ts from "typescript";

const parse = (file, source) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const walk = (node, visitor) => {
    visitor(node);
    ts.forEachChild(node, child => walk(child, visitor));
};
const sorted = values => [...values].sort();

export function findModuleMocks(source, file = "test.ts") {
    const modules = new Set();

    walk(parse(file, source), node => {
        if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
            return;
        }

        const {expression, name} = node.expression;
        const argument = node.arguments[0];

        if (
            ts.isIdentifier(expression) &&
            expression.text === "jest" &&
            ["mock", "doMock", "setMock", "unstable_mockModule"].includes(name.text) &&
            argument &&
            ts.isStringLiteralLike(argument) &&
            (argument.text.startsWith("@addon-core/") || argument.text === "@main/env")
        ) {
            modules.add(argument.text);
        }
    });

    return sorted(modules);
}

export function findStaticState(source, file) {
    const ast = parse(file, source);
    const classes = {};

    walk(ast, node => {
        if (!ts.isClassDeclaration(node) || !node.name) {
            return;
        }

        const members = node.members.filter(member =>
            member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword)
        );
        const fields = members.filter(ts.isPropertyDeclaration).map(member => member.name.getText(ast));
        const getInstance = members.some(member => member.name?.getText(ast) === "getInstance");

        if (fields.length || getInstance) {
            classes[node.name.text] = {file, fields, getInstance};
        }
    });

    return classes;
}

export function verifyMigrationInventory(root, testFiles, sourceFiles) {
    const read = file => readFileSync(path.join(root, file), "utf8");
    const {legacyFiles, localMocks} = JSON.parse(read("tests/browser-harness/migration.json"));

    assert.equal(new Set(legacyFiles).size, legacyFiles.length, "Duplicate legacy exceptions");

    for (const file of [...legacyFiles, ...Object.keys(localMocks)]) {
        assert(testFiles.has(file), `Stale migration entry: ${file}`);
    }

    const actualMocks = {};

    for (const file of testFiles) {
        const modules = findModuleMocks(read(file), file);

        if (modules.length) {
            actualMocks[file] = modules;
        }
    }

    assert.deepEqual(
        actualMocks,
        localMocks,
        "Module-mock inventory changed; migrate mocks or explicitly review exceptions"
    );
    const additional = Object.keys(actualMocks).filter(file => !legacyFiles.includes(file));
    const remaining = new Set([...legacyFiles, ...Object.keys(actualMocks)]);

    console.info(
        `Migration: ${legacyFiles.length} legacy files, ${additional.length} additional local-mock files, ${remaining.size} files remaining`
    );

    for (const file of sorted(remaining)) {
        console.info(
            `  ${file}: ${[...(legacyFiles.includes(file) ? ["legacy"] : []), ...(actualMocks[file] ?? [])].join(", ")}`
        );
    }

    const declared = JSON.parse(read("tests/browser-harness/framework-state-inventory.json"));
    const discovered = {};
    const globalKeys = new Set();

    for (const file of sourceFiles.filter(
        file =>
            file.startsWith("src/") &&
            /\.tsx?$/.test(file) &&
            !file.endsWith(".d.ts") &&
            !/\.test\.tsx?$/.test(file) &&
            !file.includes("/tests/")
    )) {
        const source = read(file);

        for (const [name, owner] of Object.entries(findStaticState(source, file))) {
            assert(!discovered[name], `Duplicate state-owner class name: ${name}`);
            discovered[name] = owner;
        }

        walk(parse(file, source), node => {
            if (
                ts.isVariableStatement(node) &&
                node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
            ) {
                for (const declaration of node.declarationList.declarations) {
                    if (ts.isIdentifier(declaration.name) && declaration.name.text.endsWith("GlobalKey")) {
                        globalKeys.add(declaration.name.text);
                    }
                }
            }
        });
    }

    const expected = Object.fromEntries(
        Object.entries(declared).map(([name, {retained, ...owner}]) => {
            if (retained !== undefined) {
                assert(typeof retained === "string" && retained.trim(), `Missing retention reason: ${name}`);
            }

            return [name, owner];
        })
    );

    assert.deepEqual(
        discovered,
        expected,
        "Static state inventory changed; register its reset policy or explain retention"
    );
    const resetSource = parse("framework-state.ts", read("tests/browser-harness/framework-state.ts"));
    const resetOwners = new Set();
    const resetKeys = new Set();

    walk(resetSource, node => {
        if (
            ts.isVariableDeclaration(node) &&
            node.name.getText(resetSource) === "frameworkStateResetters" &&
            node.initializer &&
            ts.isObjectLiteralExpression(node.initializer)
        ) {
            for (const property of node.initializer.properties) {
                resetOwners.add(property.name.getText(resetSource));
            }
        }

        if (ts.isCallExpression(node)) {
            for (const argument of node.arguments) {
                if (ts.isIdentifier(argument) && argument.text.endsWith("GlobalKey")) {
                    resetKeys.add(argument.text);
                }
            }
        }
    });

    assert.deepEqual(
        sorted(resetOwners),
        sorted(Object.keys(declared).filter(name => !declared[name].retained)),
        "Every session-state owner must have a resetter"
    );
    assert.deepEqual(sorted(resetKeys), sorted(globalKeys), "Every exported GlobalKey must be covered by reset");
    console.info(
        `Framework state: ${resetOwners.size} reset owners, ${globalKeys.size} global keys, ${Object.keys(declared).length - resetOwners.size} documented retained owners`
    );
}
