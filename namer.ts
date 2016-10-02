import * as scopeFinder from 'escope';

import Scope = escope.Scope;
import Identifier = ESTree.Identifier;
import Literal = ESTree.Literal;
import VariableDeclarator = ESTree.VariableDeclarator

export interface TrackedScope extends Scope {
  allVariables: Set<String>;
}

export interface TrackVariable {
  (scope: Scope, name: string): void;
}

export default class Namer {
  private generatedCount: number = 0;

  public trackVariable(scope: Scope, name: string) {
    console.log(name);
    const trackedScope = <TrackedScope> scope;
    if (!trackedScope.allVariables) {
      trackedScope.allVariables = new Set();
    }
    trackedScope.allVariables.add(name);
  }

  public generateNewVariable(scope: Scope, value: string): VariableDeclarator {
    const trackedScope = <TrackedScope> scope;
    const allVariables = trackedScope.allVariables;

    let unique = this.generatedCount.toString(36);
    while (!allVariables.has(unique)) {
      unique = (this.generatedCount++).toString(36);
    }
    allVariables.add(unique);

    const newDeclarator = {
      type: 'VariableDeclarator',
      id: <Identifier>{
        type: 'Identifier',
        name: unique
      },
      init: <Literal>{
        type: 'Literal',
        value: value,
        raw: `"${value}"`
      }
    };
    // this.variablesDeclarations.declarations.push(newDeclarator);
    return newDeclarator;
  }
}