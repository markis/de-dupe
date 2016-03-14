/// <reference path="interfaces/_global.d.ts" />
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
export default class Dedupe {
    private options;
    constructor(options?: DedupeOptions);
    dedupe(code: string): any;
    private uglify(ast);
    private findStrings(scope);
    private change(strings);
    private replaceInstances(instances, key);
    private cleanStrings(instances);
    private __generatedCount;
    private __variablesDeclarations;
    private generateNewVariable(value);
    private static cleanString(value);
}
