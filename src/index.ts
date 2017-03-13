import {
  Block,
  createSourceFile,
  forEachChild,
  Identifier,
  Node,
  ScriptTarget,
  SourceFile,
  StringLiteral,
  SyntaxKind,
  VariableDeclaration
} from 'typescript';

export interface DedupeOptions {
  /**
   * Adds an IIFE around the entire script, this broadens the possible instances
   * where strings duplication could be consolidated
   */
  addScope: boolean;
  /**
   * Removes duplicate spaces from strings, usually strings in javascript render
   * to the DOM and more than one space in the DOM is ignored and just bloats scripts
   */
  cleanStrings: boolean;
}

interface StringMap extends Map<string, StringLiteral[]> { }

interface StatementAction {
  (statement: Node): void;
}

interface StringReplacement {
  end: number;
  start: number;
  text: string;
}

const USE_STRICT = 'use strict';
const RESERVED_WORDS = `
  abstract arguments await boolean break byte case catch char class const continue debugger
  default delete do double else enum eval export extends false final finally float for
  function goto if implements import in instanceof int interface let long native new null
  package private protected public return short static super switch synchronized this throw
  throws transient true try typeof var void volatile while with yield`.trim().split(/[\s]+/g);

export default class Dedupe {
  private attempt: number = 0;

  private options: DedupeOptions = {
    addScope: false,
    cleanStrings: false
  };

  constructor(options?: DedupeOptions) {
    if (typeof options !== 'undefined') {
      Object.assign(this.options, options);
    }
  }

  public dedupe(code: string): string {
    if (this.options.addScope) {
      code = `!function(){${code}}`;
    }

    let replacements: StringReplacement[] = [];
    const sourceFile = createSourceFile('', code, ScriptTarget.Latest, true);
    const topLevelScopes = this.getTopLevelScopes(sourceFile);
    const identifiers = <Map<string, string>> (<any> sourceFile).identifiers;
    const usedIdentifiers = new Map<string, string>(identifiers);

    const reservedWords = RESERVED_WORDS;
    for (let word of reservedWords) {
      usedIdentifiers.set(word, word);
    }

    for (let i = 0, length = topLevelScopes.length; i < length; i++) {
      this.attempt = 0;
      const startingPos = this.getStartingPositionOfScope(topLevelScopes[i]);
      const usedNames = usedIdentifiers; //this.getUsedVariableNames(usedIdentifiers, topLevelScopes[i]);
      const stringMap = this.getStringMap(topLevelScopes[i]);
      const scopeReplacements = this.getStringReplacements(stringMap, startingPos, usedNames);
      replacements = replacements.concat(scopeReplacements);
    }
    const sortedReplacements = this.sortReplacements(replacements);
    code = this.makeAllReplacements(code, sortedReplacements);

    return code;
  }

  private shouldStringBeReplaced(str: string, count: number): boolean {
    if (count > 1) {
      if (str.length > 5) {
        return true;
      }
      if (count > 5) {
        return true;
      }
    }
    return false;
  }

  private getStringReplacements(stringMap: StringMap, startingPos: number,
                                usedVariableNames: Map<string, string>): StringReplacement[] {
    let variableDeclarationBuffer: string[] = [];
    const replacements: StringReplacement[] = [];
    stringMap.forEach((values, key) => {
      if (this.shouldStringBeReplaced(key, values.length)) {
        const variableName = this.getUniqueVariableName(usedVariableNames);
        variableDeclarationBuffer.push(`${variableName}=${JSON.stringify(key)}`);

        for (let j = 0, length = values.length; j < length; j++) {
          replacements.push({
            end: values[j].getEnd(),
            start: values[j].getStart(),
            text: variableName
          });
        }
      }
    });

    let variableDeclaration = '';
    if (variableDeclarationBuffer.length > 0) {
      variableDeclaration = `var ${variableDeclarationBuffer.join(',\n')};`;
      replacements.push({
        end: startingPos,
        start: startingPos,
        text: variableDeclaration
      });
    }
    return replacements;
  }

  private getUsedVariableNames(identifiers: Map<string, string>, startingNode: Node): Map<string, string> {
    const names = new Map<string, string>(identifiers);
    const walk = this.createWalker((node) => {
      switch (node.kind) {
        case SyntaxKind.VariableDeclaration:
          const variableNode = node as VariableDeclaration;
          const id = variableNode.name as Identifier;
          if (!names.has(id.text)) {
            names.set(id.text, id.text);
          }
        default:
          break;
      }
    });
    walk(startingNode);
    return names;
  }

  private getStringMap(startingNode: Node): Map<string, StringLiteral[]> {
    const stringMap = new Map<string, StringLiteral[]>();
    const walk = this.createWalker((node) => {
      switch (node.kind) {
        case SyntaxKind.StringLiteral:

          // make sure this string is not part of an object assignment { "a": 123 }
          if (node.parent && node.parent.kind === SyntaxKind.PropertyAssignment &&
              node.parent.parent && node.parent.parent.kind === SyntaxKind.ObjectLiteralExpression) {
            break;
          }

          const stringNode = node as StringLiteral;
          const text = stringNode.text;
          if (text === USE_STRICT) {
            break;
          }
          const strings = stringMap.get(text);
          if (strings) {
            strings.push(stringNode);
          } else {
            stringMap.set(stringNode.text, [stringNode]);
          }
        default:
          break;
      }
    });
    walk(startingNode);
    return stringMap;
  }

  private getUniqueVariableName(usedVariableNames: Map<string, string>): string {
    const namer = (): string => {
      const newVariable = this.translateNumberToVariable(this.attempt);
      if (!usedVariableNames.has(newVariable)) {
        usedVariableNames.set(newVariable, newVariable);
        return newVariable;
      }
      this.attempt++;
      return namer();
    };
    return namer();
  }

  private translateNumberToVariable(num: number): string {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const charLen = Math.floor(num / letters.length);

    const base = letters.length;
    let rixit; // like 'digit', only in some non-decimal radix
    let residual = Math.floor(num);
    let result = '';
    while (true) {
      rixit = residual % base;
      result = letters.charAt(rixit) + result;
      residual = Math.floor(residual / base);
      if (residual === 0) {
        break;
      }
    }
    return result;
  }

  private sortReplacements(replacements: StringReplacement[]) {
    return replacements.sort((a, b) => a.start > b.start ? 1 : a.start < b.start ? -1 : 0);
  }

  private makeAllReplacements(code: string, sortedReplacements: StringReplacement[]): string {
    const codeBuffer = [];
    let cursor = 0;
    for (let i = 0, length = sortedReplacements.length; i < length; i++) {
      let replacement = sortedReplacements[i];
      codeBuffer.push(code.substring(cursor, replacement.start));
      codeBuffer.push(this.cleanString(replacement.text));
      cursor = replacement.end;
    }
    codeBuffer.push(code.substring(cursor, code.length));

    return codeBuffer.join('');
  }

  private createWalker(traverser: StatementAction) {
    const walker = (node: Node) => {
      traverser(node);
      forEachChild(node, walker);
    };
    return walker;
  }

  private getStartingPositionOfScope(scope: Block) {
    let startingPos = scope.getChildAt(1).pos;

    // check the top level of the block for "use strict"
    forEachChild(scope, (expressionNode) => {
      if (expressionNode.kind === SyntaxKind.ExpressionStatement) {
        forEachChild(expressionNode, (stringNode: StringLiteral) => {
          if (stringNode.kind === SyntaxKind.StringLiteral && stringNode.text === USE_STRICT) {
            startingPos = expressionNode.getEnd();
          }
        });
      }
    });

    return startingPos;
  }

  private cleanString(fatString: string): string {
    return this.options.cleanStrings
            ? fatString.replace(/[\s]+/g, ' ')
            : fatString;
  }

  private getTopLevelScopes(node?: Node) {
    if (typeof node === 'undefined') {
      return [];
    }

    let scopes: Block[] = [];
    const functions = this.getTopLevelFunctions(node);
    for (let functionNode of functions) {
      const blocks = this.getTopLevelFunctionBlocks(functionNode);
      scopes = scopes.concat(blocks);
    }
    return scopes;
  }

  private getTopLevelFunctions(node?: Node) {
    const queue: Node[] = [];
    const found: Block[] = [];
    while (node) {
      if (
          node.kind !== SyntaxKind.ArrowFunction &&
          node.kind !== SyntaxKind.FunctionDeclaration &&
          node.kind !== SyntaxKind.FunctionExpression &&
          node.kind !== SyntaxKind.FunctionType
      ) {
        forEachChild(node, childNode => {
          queue.push(childNode);
        });
      } else {
        found.push(node as Block);
      }
      node = queue.shift();
    }
    return found;
  }

  private getTopLevelFunctionBlocks(node?: Node) {
    const queue: Node[] = [];
    const found: Block[] = [];
    while (node) {
      if (node.kind !== SyntaxKind.Block) {
        forEachChild(node, childNode => {
          queue.push(childNode);
        });
      } else {
        found.push(node as Block);
      }
      node = queue.shift();
    }
    return found;
  }

}
