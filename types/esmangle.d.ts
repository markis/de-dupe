
declare module esmangle {
  function mangle(ast: ESTree.Program, options?: any): ESTree.Program;
  function optimize(ast: ESTree.Program): ESTree.Program;
}

declare module "esmangle" {
  export = esmangle;
}

export interface ESShortenMangleOptions {
    // If false, AST is copied deeply (default: true)
    destructive: boolean;
    // If false, avoid [JSC bug](https://github.com/mozilla/sweet.js/issues/138) (default: false)
    distinguishFunctionExpressionScope: boolean;
}

declare module esshorten {
  function mangle(ast: ESTree.Program, options?: ESShortenMangleOptions): ESTree.Program;
}

declare module "esshorten" {
  export = esshorten;
}

