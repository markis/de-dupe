/// <reference path="interfaces/_global.d.ts" />
import parser = require('esprima');
import scopeFinder = require('escope');
import codeGenerator = require('escodegen');
import walker = require('estraverse');
import mangler = require('esshorten');
import optimizer = require('esmangle');
import uglifyjs = require('uglify-js');

import Visitor = estraverse.Visitor;
import VariableDeclarator = ESTree.VariableDeclarator;
import ScopeManager = escope.ScopeManager;
import Scope = escope.Scope;
import Literal = ESTree.Literal;

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

const _defaultOptions: DedupeOptions = {
  addScope: false,
  cleanStrings: false
};

export default class Dedupe {
  private options:DedupeOptions;
  constructor(options: DedupeOptions = _defaultOptions) {
    this.options = _defaultOptions;
    Object.assign(this.options, options);
  }
  dedupe(code: string): any {
    if (this.options.addScope === true) {
      code = `!function(){${code}}()`
    }

    let ast = parser.parse(code);
    const scopeManager: ScopeManager = scopeFinder.analyze(ast);
    const globalScope: Scope = scopeManager.acquire(ast);   // global scope
    const scopes = globalScope.childScopes;
    let strings: Map<string, any>;

    for (let i = 0; i < scopes.length; i++) {
      this.__variablesDeclarations = {
        type: 'VariableDeclaration',
        declarations: <ESTree.VariableDeclarator[]>[],
        kind: 'var'
      };
      const scope: Scope = scopes[i];
      const block: ESTree.Function = <ESTree.Function>scope.block;
      const body: ESTree.BlockStatement = <ESTree.BlockStatement>block.body;
      strings = this.findStrings(scope);
      this.change(strings);
      if (this.__variablesDeclarations.declarations.length > 0) {
        body.body.splice(0, 0, this.__variablesDeclarations);
      }
    }

    mangler.mangle(ast);
    const mangledAst = this.uglify(ast);

    return codeGenerator.generate(mangledAst, {
      format: {
        escapeless: true,
        quotes: 'auto',
        compact: true,
        semicolons: false,
        parentheses: false
      }
    });
  }

  private uglify(ast: ESTree.Program): ESTree.Program {
    var uglify: any = uglifyjs;

    // Conversion from SpiderMonkey AST to internal format
    var uAST = uglify.AST_Node.from_mozilla_ast(ast);

    // Compression
    uAST.figure_out_scope();
    uAST = uAST.transform(uglify.Compressor({ warnings: false }));

    // Mangling (optional)
    uAST.figure_out_scope();
    uAST.compute_char_frequency();
    uAST.mangle_names();

    // Back-conversion to SpiderMonkey AST
    return uAST.to_mozilla_ast();
  }

  private findStrings(scope: Scope): Map<string, any[]> {
    let block: ESTree.Node, strings: Map<string, any[]>, instances:any[];
    strings = <Map<string, any[]>>new Map();
    block = scope.block;
    walker.traverse(block, <Visitor>{
      enter: (node, parent) => {
        const literal = <ESTree.Literal>node, value: string = <string>literal.value;
        if (literal.type === 'Literal' && typeof value === 'string' && parent.type !== 'Property') {

          instances = strings.get(value);
          if (!instances) {
            instances = [];
            strings.set(value, instances);
          }

          instances.push({node, parent});
        }
      }
    });
    return strings;
  }

  private change(strings: Map<string, any[]>): void {
    for (let [key, instances] of strings.entries()) {
      if (key && instances && Array.isArray(instances)) {
        this.cleanStrings(instances);
        //if (key.length > 10 && instances.length > 5) {
        //  this.replaceInstances(instances[0], key);
        //} else
        if (instances.length > 5) {
          this.replaceInstances(instances, key);
        }
      }
    }
  }

  private replaceInstances(instances: any[], key: string): void {
    let instance,
      newVariable = this.generateNewVariable(key),
      name = newVariable.id['name'];

    for (let i = 0; i < instances.length; i++) {
      instance = instances[i];
      walker.replace(instance.parent, <Visitor>{
        enter: function (node) {
          if (node === instance.node) {
            return <ESTree.Node>{
              type: "Identifier",
              name: name
            }
          }
        }
      });
    }
  }

  private cleanStrings(instances): void {
    if (this.options.cleanStrings) {
      let instance;
      for (let i = 0; i < instances.length; i++) {
        instance = instances[i];
        walker.replace(instance.parent, <Visitor>{
          enter: function (node: Literal) {
            if (node === instance.node) {
              let value = <string>node.value,
                quote = value.charAt(0);
              node.value = value = Dedupe.cleanString(value);
              node.raw = quote + value + quote;
              return node;
            }
          }
        });
      }
    }
  }

  private __generatedCount = 0;
  private __variablesDeclarations = {
    type: 'VariableDeclaration',
    declarations: <ESTree.VariableDeclarator[]>[],
    kind: 'var'
  };
  private generateNewVariable(value: string): ESTree.VariableDeclarator {
    const newDeclarator = {
      type: 'VariableDeclarator',
      id: <ESTree.Identifier>{
        type: 'Identifier',
        name: `dedupe${this.__generatedCount++}`
      },
      init: <ESTree.Literal>{
        type: 'Literal',
        value: value,
        raw: `"${value}"`
      }
    };
    this.__variablesDeclarations.declarations.push(newDeclarator);
    return newDeclarator;
  }

  private static cleanString(value: string): string {
    return value.replace(/\s+/g, ' ');
  }

}