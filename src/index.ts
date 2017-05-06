import {
  Block,
  createSourceFile,
  forEachChild,
  Identifier,
  Node,
  ScriptTarget,
  StringLiteral,
  SyntaxKind,
  VariableDeclaration
} from 'typescript';

export interface DedupeOptions {
  /**
   * Specify a de-duplication method
   *    gzip - Works best for files that will be gzipped
   *    all - Generic method to de-duplicate all strings
   */
  type?: 'gzip' | 'all';
  /**
   * Adds an IIFE around the entire script, this broadens the possible instances
   * where strings duplication could be consolidated
   */
  addScope?: boolean;
  /**
   * Should the result include the replacements
   */
  includeReplacements?: boolean;
  /**
   * Minimum number of string instances before de-dupe will replace the string. (Only works when type === 'all')
   */
  minInstances?: number;
  /**
   * Minimum length of the string before de-dupe will replace the string.  (Only works when type === 'all'
   */
  minLength?: number;
}

type StringMap = Map<string, StringLiteral[]>;

type StatementAction = (statement: Node) => void;

export interface StringReplacement {
  end: number;
  start: number;
  text: string;
}

export interface Result {
  code: string;
  replacements?: StringReplacement[];
}

const INFREQUENT_CHARS = /[\\\/kwzq]+/ig;
const BOUNDARY = /\b/;
const USE_STRICT = 'use strict';
const RESERVED_WORDS = [ 'abstract', 'arguments', 'await', 'boolean', 'break', 'byte', 'case',
                         'catch', 'char', 'class', 'const', 'continue', 'debugger', 'default',
                         'delete', 'do', 'double', 'else', 'enum', 'eval', 'export', 'extends',
                         'false', 'final', 'finally', 'float', 'for', 'function', 'goto', 'if',
                         'implements', 'import', 'in', 'instanceof', 'int', 'interface', 'let',
                         'long', 'native', 'new', 'null', 'package', 'private', 'protected',
                         'public', 'return', 'short', 'static', 'super', 'switch', 'synchronized',
                         'this', 'throw', 'throws', 'transient', 'true', 'try', 'typeof', 'var',
                         'void', 'volatile', 'while', 'with', 'yield'];

export default class Dedupe {
  private attempt: number = 0;

  private options: DedupeOptions = {
    addScope: false,
    includeReplacements: false,
    minInstances: -1,
    minLength: -1,
    type: 'gzip'
  };

  constructor(options?: DedupeOptions) {
    if (typeof options !== 'undefined') {
      Object.assign(this.options, options);
    }
  }

  public dedupe(code: string): Result {
    if (this.options.addScope) {
      code = `!function(){${code}}();`;
    }

    let replacements: StringReplacement[] = [];
    const sourceFile = createSourceFile('', code, ScriptTarget.Latest, true);
    const topLevelScopes = this.getTopLevelScopes(sourceFile);
    const identifiers = (sourceFile as any).identifiers as Map<string, string>;
    const usedIdentifiers = new Map<string, string>(identifiers);

    const reservedWords = RESERVED_WORDS;
    for (const word of reservedWords) {
      usedIdentifiers.set(word, word);
    }

    for (let i = 0, length = topLevelScopes.length; i < length; i++) {
      this.attempt = 0;
      const startingPos = this.getStartingPositionOfScope(topLevelScopes[i]);
      const usedNames = this.getUsedVariableNames(usedIdentifiers, topLevelScopes[i]);
      const stringMap = this.getStringMap(topLevelScopes[i]);

      if (this.options.type === 'gzip') {
        const scopeReplacements = this.getGzipStringReplacements(stringMap, startingPos, usedNames);
        replacements = replacements.concat(scopeReplacements);
      } else {
        const scopeReplacements = this.getAllStringReplacements(stringMap, startingPos, usedNames);
        replacements = replacements.concat(scopeReplacements);
      }
    }
    const sortedReplacements = this.sortReplacements(replacements);
    code = this.makeAllReplacements(code, sortedReplacements);

    if (this.options.includeReplacements) {
      return { code, replacements: sortedReplacements };
    } else {
      return { code };
    }
  }

  private getGzipStringReplacements(stringMap: StringMap, startingPos: number,
                                    usedVariableNames: Map<string, string>): StringReplacement[] {

    const variableDeclarationBuffer: string[] = [];
    const replacements: StringReplacement[] = [];
    const gzipSlidingWindowSize = 32768;
    const stringKeysToReplace: string[] = [];

    stringMap.forEach((values, key) => {
      values = values.sort((a, b) => {
        const start1 = a.getStart();
        const start2 = b.getStart();

        if (start1 > start2) {
          return 1;
        }
        if (start1 < start2) {
          return -1;
        }
        return 0;
      });

      for (let i = 1; i < values.length; i++) {
        const start1 = values[i - 1].getStart();
        const start2 = values[i].getStart();
        if ((start2 - start1) > gzipSlidingWindowSize) {
          stringKeysToReplace.push(key);
          return;
        }
      }
    });

    for (const key of stringKeysToReplace) {
      const values = stringMap.get(key);
      if (!values) {
        break;
      }
      const variableName = this.getUniqueVariableName(usedVariableNames);
      variableDeclarationBuffer.push(`${variableName}=${JSON.stringify(key)}`);

      for (let j = 0, length = values.length; j < length; j++) {
        const node = values[j];
        const start = node.getStart();
        const end = node.getEnd();

        replacements.push({
          end,
          start,
          text: variableName
        });
      }
    }

    let variableDeclaration = '';
    if (variableDeclarationBuffer.length > 0) {
      variableDeclaration = `var ${variableDeclarationBuffer.join(',')};`;
      replacements.push({
        end: startingPos,
        start: startingPos,
        text: variableDeclaration
      });
    }
    return replacements;
  }

  private getAllStringReplacements(stringMap: StringMap, startingPos: number,
                                   usedVariableNames: Map<string, string>): StringReplacement[] {
    const variableDeclarationBuffer: string[] = [];
    const replacements: StringReplacement[] = [];
    const rankingMap: Array<Array<string | number>> = [];

    const minLength = typeof this.options.minLength === 'undefined' ? -1 : this.options.minLength;
    const minInstances = typeof this.options.minInstances === 'undefined' ? -1 : this.options.minInstances;

    const shouldStringBeReplaced = (str: string, count: number) => {
      const matches = (str.match(INFREQUENT_CHARS) as any);
      if (matches && matches.length > 1) {
        return true;
      }
      if (str.length > minLength) {
        return true;
      }
      if (count > minInstances) {
        return true;
      }
      return false;
    };

    stringMap.forEach((values, key) => {
      const count = values.length;
      if (shouldStringBeReplaced(key, count)) {
        rankingMap.push([key, count]);
      }
    });

    rankingMap.sort((a, b) => {
      return a[1] > b[1] ? 1 : a[1] < b[1] ? -1 : 0;
    });

    for (const ranking of rankingMap) {
      const key = ranking[0] as string;
      const values = stringMap.get(key);
      if (values) {
        const variableName = this.getUniqueVariableName(usedVariableNames);
        variableDeclarationBuffer.push(`${variableName}=${JSON.stringify(key)}`);

        for (let j = 0, length = values.length; j < length; j++) {
          const node = values[j];
          const start = node.getStart();
          const end = node.getEnd();

          replacements.push({
            end,
            start,
            text: variableName
          });
        }
      }
    }

    let variableDeclaration = '';
    if (variableDeclarationBuffer.length > 0) {
      variableDeclaration = `var ${variableDeclarationBuffer.join(',')};`;
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

          // make sure this string is not part of an property assignment { "a": 123 }
          if (node.parent && node.parent.kind === SyntaxKind.PropertyAssignment) {
            if (node.parent.getChildAt(0) === node) {
              break;
            }
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
    const letters = '_eariotnslcu';
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
      const replacement = sortedReplacements[i];

      codeBuffer.push(code.substring(cursor, replacement.start));
      if (BOUNDARY.test(code.charAt(replacement.start - 1))) {
        codeBuffer.push(' ');
      }
      codeBuffer.push(replacement.text);
      if (BOUNDARY.test(code.charAt(replacement.end))) {
        codeBuffer.push(' ');
      }
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
    const firstChild = scope.getChildAt(0);
    const secondChild = scope.getChildAt(1);
    let startingPos = secondChild ? secondChild.getFullStart() : firstChild.getFullStart();

    // check the top level of the block for "use strict"
    forEachChild(scope, (expressionNode: Node) => {
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

  private getTopLevelScopes(node?: Node) {
    if (typeof node === 'undefined') {
      return [];
    }

    let scopes: Block[] = [];
    const functions = this.getTopLevelFunctions(node);
    for (const functionNode of functions) {
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
        forEachChild(node, (childNode: Node) => {
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
        forEachChild(node, (childNode: Node) => {
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
