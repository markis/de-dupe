
declare module esmangle {
  function mangle(ast: ESTree.Program): ESTree.Program;
  function optimize(ast: ESTree.Program): ESTree.Program;
}

declare module "esmangle" {
  export = esmangle;
}


declare module esshorten {
  function mangle(ast: ESTree.Program): ESTree.Program;
}

declare module "esshorten" {
  export = esshorten;
}

