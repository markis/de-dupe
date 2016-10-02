
declare module escodegen {
  function generate(ast: ESTree.Program | ESTree.Node, options?: any): string;
}

declare module "escodegen" {
  export = escodegen;
}