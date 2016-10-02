import Namer, { TrackVariable } from './namer';

import * as parser from 'esprima';
import * as estree from 'estree';
import * as scopeFinder from 'escope';
import * as codeGenerator from 'escodegen';
import * as walker from 'estraverse';
// import * as mangler from 'esshorten';
// import * as optimizer from 'esmangle';
import * as uglifyjs from 'uglify-js';

import Visitor = estraverse.Visitor;
import ScopeManager = escope.ScopeManager;
import Scope = escope.Scope;
import BlockStatement = ESTree.BlockStatement;
import Function = ESTree.Function;
import Identifier = ESTree.Identifier;
import Literal = ESTree.Literal;
import Node = ESTree.Node;
import Program = ESTree.Program;
import VariableDeclarator = ESTree.VariableDeclarator;
import VariableDeclaration = ESTree.VariableDeclaration;

export interface DedupeOptions {
  /**
   * Adds an IIFE around the entire script, this broadens the possible instances where strings duplication could be consolidated
   */
  addScope: boolean;
  /**
   * Removes duplicate spaces from strings, usually strings in javascript render to the DOM and more than one space in
   * the DOM is ignored and just bloats scripts
   */
  cleanStrings: boolean;
}

export interface VariablesDeclarations {
  declarations: VariableDeclarator[];
  kind: 'var';
  type: 'VariableDeclaration';
}

export interface StringInstance {
  node: Node;
  parent: Node;
  scope: Scope;
  value: string;
}

export interface TrackInstances {
  (node: Node, parent: Node, scope: Scope, value: string): void;
}

export type StringMap = Map<String, StringInstance[]>

const defaultOptions: DedupeOptions = {
  addScope: false,
  cleanStrings: false,
  minInstances: 5
};

export default class Dedupe {
  private namer: Namer;
  private options: DedupeOptions;
  private generatedCount = 0;
  private variablesDeclarations: VariablesDeclarations = {
    type: 'VariableDeclaration',
    declarations: <VariableDeclarator[]>[],
    kind: 'var'
  };

  constructor(options: DedupeOptions = defaultOptions, namer: Namer = new Namer()) {
    this.namer = namer;
    this.options = defaultOptions;
    Object.assign(this.options, options);
  }

  dedupe(code: string): string {
    if (this.options.addScope === true) {
      code = `!function(){${code}}()`
    }

    let ast = parser.parse(code);
    let strings: StringMap;
    const scopeManager = <ScopeManager> scopeFinder.analyze(ast);
    const globalScope = <Scope> scopeManager.acquire(ast);
    const scopes = globalScope.childScopes;
    const trackVariable = this.namer.trackVariable.bind(this.namer);

    for (let i = 0; i < scopes.length; i++) {
      this.variablesDeclarations = {
        declarations: [],
        kind: 'var',
        type: 'VariableDeclaration'
      };
      const scope = <Scope> scopes[i];
      const block = <Function> scope.block;
      const body = <BlockStatement> block.body;
      strings = new Map();
      firstwalk(scope, trackVariable, trackInstances(strings));
      this.change(scope, strings);

      // strings = this.findstrings(scope);
      // this.change(scope, strings);
      if (this.variablesDeclarations.declarations.length > 0) {
        body.body.splice(0, 0, this.variablesDeclarations);
      }
    }

    // mangler.mangle(ast, { destructive: true });
    // const mangledAst = this.uglify(ast);

    return codeGenerator.generate(ast, {
      format: {
        escapeless: true,
        quotes: 'auto',
        compact: false,
        semicolons: false,
        parentheses: false
      }
    });
  }

  private uglify(ast: Program): Program {
    const uglify: any = uglifyjs;

    // Conversion from SpiderMonkey AST to internal format
    const uAST = uglify.AST_Node.from_mozilla_ast(ast);

    // Compression
    uAST.figure_out_scope();
    const uASTTransform = uAST.transform(uglify.Compressor({ warnings: false }));

    // Mangling (optional)
    uASTTransform.figure_out_scope();
    uASTTransform.compute_char_frequency();
    uASTTransform.mangle_names();

    // Back-conversion to SpiderMonkey AST
    return uAST.to_mozilla_ast();
  }

  private change(scope: Scope, strings: StringMap): void {
    strings.forEach((instances: StringInstance[], key: string) => {
      if (key && instances && Array.isArray(instances)) {
        this.cleanStrings(instances);
        if (instances.length > this.options.minInstances) {
          this.replaceInstances(instances, key);
        }
      }
    });
  }

  private replaceInstances(scope: Scope, instances: StringInstance[], key: string): void {
    const newVariable = this.namer.generateNewVariable(scope, key);
    const identifier = <Identifier> newVariable.id;

    this.variablesDeclarations.declarations.push(newVariable);
    for (let i = 0, instance = instances[i]; i < instances.length; i++) {
      walker.replace(instance.parent, <Visitor> {
        enter: replacer(instance, identifier.name)
      });
    }
  }

  private cleanStrings(instances: StringInstance[]): void {
    if (this.options.cleanStrings) {
      for (let i = 0, instance = instances[i]; i < instances.length; i++) {
        walker.replace(instance.parent, <Visitor> {
          enter: cleaner(instance)
        });
      }
    }
  }

  private generateNewVariable(scope: Scope, value: string): VariableDeclarator {
    const newDeclarator = {
      type: 'VariableDeclarator',
      id: <Identifier>{
        type: 'Identifier',
        name: `dedupe${this.generatedCount++}`
      },
      init: <Literal>{
        type: 'Literal',
        value: value,
        raw: `"${value}"`
      }
    };
    this.variablesDeclarations.declarations.push(newDeclarator);
    return newDeclarator;
  }
}

function firstwalk(scope: Scope, trackVariable: TrackVariable, trackInstances: TrackInstances) {
  const block: Node = scope.block;
  walker.traverse(block, <Visitor> {
    enter: (node, parent) => {
      let instances: StringInstance[];
      const literal = <Literal> node;
      const variable = <VariableDeclarator> node;
      const value = <string> literal.value;

      if (node.type === 'VariableDeclarator') {
        const id = <Identifier> variable.id;
        trackVariable(scope, id.name);
      } else if (literal.type === 'Literal' && typeof value === 'string' && parent.type !== 'Property') {
        trackInstances(node, parent, scope, value);
      }
    }
  });
}

function trackInstances(strings: StringMap) {
  return (node: Node, parent: Node, scope: Scope, value: string) => {
    let instances = strings.get(value);
    if (!instances) {
      instances = [];
      strings.set(value, instances);
    }
    instances.push({ node, parent, scope, value });
  }
}

function replacer(instance: StringInstance, name: string) {
  return (node) => {
    const instanceLiteral = <Literal> instance.node;
    const literal = <Literal> node;
    if (node === instance.node ||
      node.type === 'Literal' && literal.value === instanceLiteral.value) {

      return <Node> {
        type: "Identifier",
        name: name
      }
    }
  };
}

function cleaner(instance: StringInstance) {
  return (node: Literal) => {
    if (node === instance.node) {
      let value = node.value as string;
      const quote = value.charAt(0);
      node.value = value = cleanString(value);
      node.raw = quote + value + quote;
      return node;
    }
  }
}

function cleanString(value: string): string {
  return value.replace(/\s+/g, ' ');
}
