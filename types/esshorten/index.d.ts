import { Program } from 'estree';

export interface ESShortenMangleOptions {
    // If false, AST is copied deeply (default: true)
    destructive: boolean;
    // If false, avoid [JSC bug](https://github.com/mozilla/sweet.js/issues/138) (default: false)
    distinguishFunctionExpressionScope: boolean;
}

export function mangle(ast: Program, options?: ESShortenMangleOptions): Program;
