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
    const expected = `!function() {var j="z"; console.log(j, j, j, j, j, j); }()`;

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
    const expected = `function x() {var j="z"; console.log(j, j, j, j, j, j); }`;

    const result = dedupe.dedupe(code);

    expect(result).equal(expected);
    expect((result.match(/z/g) as any[]).length).equal(1);
  });

  it('can handle arrow functions', () => {
    const code = `() => { console.log('z', 'z', 'z', 'z', 'z', 'z'); }`;
    const expected = `() => {var j="z"; console.log(j, j, j, j, j, j); }`;

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

    expect((result.match(/z/g) as any[]).length).equal(6);
  });

  it('will take less than a millisecond to process a simple code block', () => {
    const code = `!function() { console.log('z', 'z', 'z', 'z', 'z', 'z'); }()`;

    const start = process.hrtime();
    const result = dedupe.dedupe(code);
    const elapsed = process.hrtime(start)[1] / 1000000; // divide by 1M to convert nano to milli

    expect(elapsed).lessThan(1);
  });

});
