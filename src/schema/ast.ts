import ts from 'typescript';
// Supplemental syntax only: no imports executed, constructors instantiated or decorators evaluated.
export function syntaxInventory(text: string, fileName = 'component.ts') {
    const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
    const classes: {
        name: string;
        fields: {
            name: string;
            accessor: boolean;
            readonly: boolean;
            type: string | null;
        }[];
    }[] = [];
    function visit(node: ts.Node) {
        if (ts.isClassDeclaration(node) && node.name)
            classes.push({ name: node.name.text, fields: node.members.filter(m => ts.isPropertyDeclaration(m) || ts.isGetAccessorDeclaration(m) || ts.isSetAccessorDeclaration(m)).map(m => ({ name: m.name?.getText(file) ?? 'computed', accessor: ts.isGetAccessorDeclaration(m) || ts.isSetAccessorDeclaration(m), readonly: !!(ts.getCombinedModifierFlags(m as ts.Declaration) & ts.ModifierFlags.Readonly), type: (m as ts.PropertyDeclaration).type?.getText(file) ?? null })) });
        ts.forEachChild(node, visit);
    }
    visit(file);
    return { source: fileName, scope: 'syntax-only', classes };
}
