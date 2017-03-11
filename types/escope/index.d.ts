import { Node, Program } from 'estree';

export function analyze(ast: Program): any;

export interface ScopeManager {
  /**
   * Get variables that are declared by the node.
   *
   * "are declared by the node" means the node is same as `Variable.defs[].node` or `Variable.defs[].parent`.
   * If the node declares nothing, this method returns an empty array.
   * CAUTION: This API is experimental. See https://github.com/estools/escope/pull/69 for more details.
   *
   * @param {ESTree.Node} node - a node to get.
   * @returns {Variable[]} variables that declared by the node.
   */
  getDeclaredVariables(node: Node): any;
  /**
   * acquire scope from node.
   * @method ScopeManager#acquire
   * @param {ESTree.Node} node - node for the acquired scope.
   * @param {boolean=} inner - look up the most inner scope, default value is false.
   * @return {Scope?}
   */
  acquire(node: Node, inner?: boolean): Scope;
  /**
   * acquire all scopes from node.
   * @method ScopeManager#acquireAll
   * @param {ESTree.Node} node - node for the acquired scope.
   * @return {Scope[]?}
   */
  acquireAll(node: Node): Scope[];
  /**
   * release the node.
   * @method ScopeManager#release
   * @param {ESTree.Node} node - releasing node.
   * @param {boolean=} inner - look up the most inner scope, default value is false.
   * @return {Scope?} upper scope for the node.
   */
  release(node: Node, inner: boolean): Scope;
}

export interface Scope {
  /**
   * One of 'TDZ', 'module', 'block', 'switch', 'function', 'catch', 'with', 'function', 'class', 'global'.
   * @member {String} Scope#type
   */
  type: string;
  /**
   * The scoped {@link Variable}s of this scope, as <code>{ Variable.name
       * : Variable }</code>.
   * @member {Map} Scope#set
   */
  set: Map<string, any>;
  /**
   * The tainted variables of this scope, as <code>{ Variable.name :
       * boolean }</code>.
   * @member {Map} Scope#taints */
  taints: Map<string, boolean>;
  /**
   * Generally, through the lexical scoping of JS you can always know
   * which variable an identifier in the source code refers to. There are
   * a few exceptions to this rule. With 'global' and 'with' scopes you
   * can only decide at runtime which variable a reference refers to.
   * Moreover, if 'eval()' is used in a scope, it might introduce new
   * bindings in this or its parent scopes.
   * All those scopes are considered 'dynamic'.
   * @member {boolean} Scope#dynamic
   */
  dynamic: boolean;
  /**
   * A reference to the scope-defining syntax node.
   * @member {ESTree.Node} Scope#block
   */
  block: Node;
  /**
   * The {@link Reference|references} that are not resolved with this scope.
   * @member {Reference[]} Scope#through
   */
  through: any[];
  /**
   * The scoped {@link Variable}s of this scope. In the case of a
   * 'function' scope this includes the automatic argument <em>arguments</em> as
   * its first element, as well as all further formal arguments.
   * @member {Variable[]} Scope#variables
   */
  variable: any[];
  /**
   * Any variable {@link Reference|reference} found in this scope. This
   * includes occurrences of local variables as well as variables from
   * parent scopes (including the global scope). For local variables
   * this also includes defining occurrences (like in a 'var' statement).
   * In a 'function' scope this does not include the occurrences of the
   * formal parameter in the parameter list.
   * @member {Reference[]} Scope#references
   */
  references: any[];
  /**
   * For 'global' and 'function' scopes, this is a self-reference. For
   * other scope types this is the <em>variableScope</em> value of the
   * parent scope.
   * @member {Scope} Scope#variableScope
   */
  variableScope: Scope;
  /**
   * Whether this scope is created by a FunctionExpression.
   * @member {boolean} Scope#functionExpressionScope
   */
  functionExpressionScope: boolean;
  /**
   * Whether this is a scope that contains an 'eval()' invocation.
   * @member {boolean} Scope#directCallToEvalScope
   */
  directCallToEvalScope: boolean;
  /**
   * @member {boolean} Scope#thisFound
   */
  thisFound: boolean;
  /**
   * Reference to the parent {@link Scope|scope}.
   * @member {Scope} Scope#upper
   */
  upper: Scope;
  /**
   * Whether 'use strict' is in effect in this scope.
   * @member {boolean} Scope#isStrict
   */
  isStrict: boolean;
  /**
   * List of nested {@link Scope}s.
   * @member {Scope[]} Scope#childScopes
   */
  childScopes: Scope[];
}
