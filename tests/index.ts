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

    expect(result).to.be.equal(expected);
    expect(markers.length).to.be.equal(1);
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
    const markers = result.match(/z/g) as any[];

    expect(markers.length).to.be.equal(2);
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

    expect(markers.length).to.be.equal(1);
  });

  it('will add scope', () => {
    const code = `
      console.log('z', 'z', 'z', 'z', 'z', 'z');
    `;

    const result = scopeAdder.dedupe(code);
    const markers = result.match(/z/g) as any[];

    expect(result).to.contain('!function');
    expect(markers.length).to.be.equal(1);
  });

  it('will clean strings', () => {
    const code = `
      !function() {
        console.log('z  ', 'z  ', 'z  ', 'z  ', 'z  ', 'z  ', 'z  ', 'z  ');
      }()
    `;

    const result = stringCleaner.dedupe(code);

    expect(result).to.contain(`"z "`);
  });

  it('not effect global scope', () => {
    const code = `
      if (true) {
        console.log('z', 'z', 'z', 'z', 'z', 'z');
      }
    `;

    const result = dedupe.dedupe(code);
    const markers = result.match(/z/g) as any[];

    expect(markers.length).to.be.equal(6);
  });

});
