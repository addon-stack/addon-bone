import ts from "typescript";
import SourceFile from "../SourceFile";

/**
 * Finds nodes in the TypeScript AST.
 */
export default class NodeFinder {
    /**
     * Constructor for the NodeFinder.
     *
     * @param sourceFile The source file to find nodes in
     */
    constructor(private sourceFile: SourceFile) {}

    /** Finds default-export syntax without traversing nested scopes; skips explicitly type-only re-exports. */
    public findDefaultExport(): ts.Statement | undefined {
        return this.sourceFile
            .getSourceFile()
            .statements.find(
                statement =>
                    (ts.isExportAssignment(statement) && !statement.isExportEquals) ||
                    (ts.canHaveModifiers(statement) &&
                        ts.getModifiers(statement)?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) ||
                    (ts.isExportDeclaration(statement) &&
                        !statement.isTypeOnly &&
                        statement.exportClause &&
                        ts.isNamedExports(statement.exportClause) &&
                        statement.exportClause.elements.some(item => !item.isTypeOnly && item.name.text === "default"))
            );
    }

    /**
     * Generic method to find a node of a specific type by name in the AST.
     *
     * @param predicate The predicate to match the node
     * @param name The name to search for
     * @returns The found node or undefined if not found
     */
    public findNodeByName<T extends ts.Node>(
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

    /**
     * Searches the AST of this file for a class declaration by name.
     *
     * @param name The name of the class to find
     * @returns The class declaration or undefined if not found
     */
    public findClassDeclaration(name: string): ts.ClassDeclaration | undefined {
        return this.findNodeByName<ts.ClassDeclaration>(
            (node, searchName): node is ts.ClassDeclaration =>
                ts.isClassDeclaration(node) && node.name?.text === searchName,
            name
        );
    }

    /**
     * Searches the AST of this file for a type alias declaration by name.
     *
     * @param name The name of the type alias to find
     * @returns The type alias declaration or undefined if not found
     */
    public findTypeAliasDeclaration(name: string): ts.TypeAliasDeclaration | undefined {
        return this.findNodeByName<ts.TypeAliasDeclaration>(
            (node, searchName): node is ts.TypeAliasDeclaration =>
                ts.isTypeAliasDeclaration(node) && node.name.text === searchName,
            name
        );
    }

    /**
     * Searches the AST of this file for an interface declaration by name.
     *
     * @param name The name of the interface to find
     * @returns The interface declaration or undefined if not found
     */
    public findInterfaceDeclaration(name: string): ts.InterfaceDeclaration | undefined {
        return this.findNodeByName<ts.InterfaceDeclaration>(
            (node, searchName): node is ts.InterfaceDeclaration =>
                ts.isInterfaceDeclaration(node) && node.name.text === searchName,
            name
        );
    }

    /**
     * Searches the AST of this file for a variable declaration by name.
     *
     * @param name The name of the variable to find
     * @returns The variable declaration or undefined if not found
     */
    public findVariableDeclaration(name: string): ts.VariableDeclaration | undefined {
        return this.findNodeByName<ts.VariableDeclaration>(
            (node, searchName): node is ts.VariableDeclaration =>
                ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === searchName,
            name
        );
    }

    /**
     * Searches the AST of this file for an import equals declaration by name.
     *
     * @param name The name of the import equals declaration to find
     * @returns The import equals declaration or undefined if not found
     */
    public findImportEqualsDeclaration(name: string): ts.ImportEqualsDeclaration | undefined {
        return this.findNodeByName<ts.ImportEqualsDeclaration>(
            (node, searchName): node is ts.ImportEqualsDeclaration =>
                ts.isImportEqualsDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === searchName,
            name
        );
    }
}
