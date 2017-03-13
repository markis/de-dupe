import 'mocha';

import { expect } from 'chai';
import Dedupe from '../src/index';

const dedupe = new Dedupe();
const stringCleaner = new Dedupe({
  addScope: false,
  cleanStrings: true
});
const scopeAdder = new Dedupe({
  addScope: true,
  cleanStrings: false
});

describe('de-dupe', () => {

  it('can handle large strings', () => {
    const code = `!function() { console.log('zzzzzzzzzz', 'zzzzzzzzzz'); }()`;

    const result = dedupe.dedupe(code);
    const markers = result.match(/zzzzzzzzzz/g) as any[];

    expect(markers.length).to.be.equal(1);
  });

  it('can handle many small strings', () => {
    const code = `!function() { console.log('z', 'z', 'z', 'z', 'z', 'z'); }()`;
    const expected = `!function() {var a="z"; console.log(a, a, a, a, a, a); }()`;

    const result = dedupe.dedupe(code);
    const markers = result.match(/z/g) as any[];

    expect(result).equal(expected);
    expect(markers.length).equal(1);
  });

  it('can handle multiple scopes', () => {
    const code = `
      !function() {
        console.log('z', 'z', 'z', 'z', 'z', 'z');
      }()

      !function() {
        console.log('z', 'z', 'z', 'z', 'z', 'z');
      }()
    `;

    const result = dedupe.dedupe(code);

    expect((result.match(/z/g) as any[]).length).equal(2);
  });

  it('can handle multiple scopes from one global scope', () => {
    const code = `
      !function() {
        !function() {
          console.log('z', 'z', 'z', 'z', 'z', 'z');
        }()

        !function() {
          console.log('z', 'z', 'z', 'z', 'z', 'z');
        }()
      }()
    `;

    const result = dedupe.dedupe(code);
    const markers = result.match(/z/g) as any[];

    expect(markers.length).equal(1);
  });

  it('can handle named functions', () => {
    const code = `function x() { console.log('z', 'z', 'z', 'z', 'z', 'z'); }`;
    const expected = `function x() {var a="z"; console.log(a, a, a, a, a, a); }`;

    const result = dedupe.dedupe(code);

    expect(result).equal(expected);
    expect((result.match(/z/g) as any[]).length).equal(1);
  });

  it('can handle arrow functions', () => {
    const code = `() => { console.log('z', 'z', 'z', 'z', 'z', 'z'); }`;
    const expected = `() => {var a="z"; console.log(a, a, a, a, a, a); }`;

    const result = dedupe.dedupe(code);

    expect(result).equal(expected);
    expect((result.match(/z/g) as any[]).length).equal(1);
  });

  it('can handle strict mode', () => {
    const code = `function x() { "use strict"; console.log('z', 'z', 'z', 'z', 'z', 'z'); }`;
    const expected = `function x() { "use strict";var a="z"; console.log(a, a, a, a, a, a); }`;

    const result = dedupe.dedupe(code);

    expect(result).equal(expected);
    expect((result.match(/z/g) as any[]).length).equal(1);
  });

  it('will add scope', () => {
    const code = `console.log('z', 'z', 'z', 'z', 'z', 'z');`;

    const result = scopeAdder.dedupe(code);

    expect(result).contain('!function');
    expect((result.match(/z/g) as any[]).length).equal(1);
  });

  it('will clean strings', () => {
    const code = `
      !function() {
        console.log('z  ', 'z  ', 'z  ', 'z  ', 'z  ', 'z  ', 'z  ', 'z  ');
      }()
    `;

    const result = stringCleaner.dedupe(code);

    expect(result).contain(`"z "`);
  });

  it('will not effect non-function blocks', () => {
    const code = `
      if (true) {
        console.log('z', 'z', 'z', 'z', 'z', 'z');
      }
    `;

    const result = dedupe.dedupe(code);

    expect(result).equal(code);
  });

  it('will not treat "use strict" as a string', () => {
    const code = `
      () => {
        'use strict';
        console.log('use strict', 'use strict', 'use strict', 'use strict', 'use strict', 'use strict');
      }
    `;

    const result = dedupe.dedupe(code);

    expect(code).equal(result);
  });

  it('will not treat property assignment as a string', () => {
    const propertyAssignment = `var stuff = { 'z' : 123 };`;
    const code = `
      function x() {
        ${propertyAssignment}
        console.log('z', 'z', 'z', 'z', 'z', 'z', 'z', 'z');
      }
    `;

    const result = dedupe.dedupe(code);

    expect(result).contains(propertyAssignment);
  });

  it('will not treat the left side of a property assignment as a string', () => {
    const code = `
      function x() {
        var stuff = { 'z' : 'z' };
        console.log('z', 'z', 'z', 'z', 'z', 'z', 'z', 'z');
      }
    `;
    const expected = `
      function x() {var a="z";
        var stuff = { 'z' : a };
        console.log(a, a, a, a, a, a, a, a);
      }
    `;

    const result = dedupe.dedupe(code);

    expect(result).equals(expected);
  });


  it('will handle magical globals', () => {
    // notice the expected is expecting dedupe to identify that "a" is referring to an outside variable
    const code = `function x() { a.evar36 = 'asdf'; console.log('z', 'z', 'z', 'z', 'z', 'z', 'z', 'z'); }`;
    const expected = `function x() {var b="z"; a.evar36 = 'asdf'; console.log(b, b, b, b, b, b, b, b); }`;

    const result = dedupe.dedupe(code);

    expect(result).equal(expected);
  });

});
