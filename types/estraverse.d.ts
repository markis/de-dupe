
declare module estraverse {
  const version: string;

  function traverse(root: ESTree.Node, visitor: Visitor): ESTree.Node;
  function replace(root: ESTree.Node, visitor: Visitor): ESTree.Node;

  export interface Visitor {
    enter(node: ESTree.Node, parent?: ESTree.Node): ESTree.Node ;
    leave(node: ESTree.Node, parent?: ESTree.Node): ESTree.Node;
  }

  export interface Reference {
    constructor(parent: any, key: string);
    replace(node: ESTree.Node);
    remove();
    Element(node, path, wrap, ref);
  }
}

declare module 'estraverse' {
  export = estraverse;
}