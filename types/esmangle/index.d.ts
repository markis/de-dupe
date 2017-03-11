import { Node, Program } from 'estree';

export function mangle(ast: Program, options?: any): Program;
export function optimize(ast: Program): Program;
