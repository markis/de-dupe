import { readFile, writeFile } from 'fs';
import { resolve } from 'path';
import Dedupe, { DedupeOptions } from './index';
// tslint:disable:no-var-requires
const config = require('./package.json');
// tslint:enable:no-var-require
declare type Process = typeof process;

process.title = config.name;

const options = parseArguments(process);
if (!options.showHelp && options.files.length > 0) {
  processFiles(options);
} else {
  printHelp();
}

function processFiles(opt: typeof options) {
  for (let file of opt.files) {
    readFile(file, 'utf-8', (err, code) => {
      if (err) {
        console.error(err);
      } else {
        const dedupe = new Dedupe(opt as DedupeOptions);
        const dedupedCode = dedupe.dedupe(code).code;
        writeFile(file.replace('.js', '') + '.min.js', dedupedCode);
      }
    });
  }
}

function printHelp() {
  process.stdout.write(
    config.name + ' ' + config.version + '\n' +
    '\n' +
    'Usage: de-dupe [options] -- <...files>' +
    '\n' +
    'Options:\n' +
    '--addScope, -s       Adds an IIFE around the entire script\n' +
    '--cleanStrings, -c   Clean out duplicate spaces from strings\n'
  );
}

function parseArguments(process: Process) {
  const parsedOptions: any = {
    files: []
  };
  let parseFiles = false;
  process.argv.forEach((val, idx) => {
    if (parseFiles) {
      parsedOptions.files.push(resolve(val));
    } else {
      switch (val) {
        case '--addScope':
        case '-s':
          parsedOptions.addScope = true;
          break;
        case '--cleanStrings':
        case '-c':
          parsedOptions.cleanStrings = true;
          break;
        case '--minLength':
        case '-ml':
          const minLength = parseInt(process.argv[idx + 1], 10);
          if (!isNaN(minLength)) {
            parsedOptions.minLength = minLength;
          }
          break;
        case '--minInstances':
        case '-mi':
          const minInstances = parseInt(process.argv[idx + 1], 10);
          if (!isNaN(minInstances)) {
            parsedOptions.minInstances = minInstances;
          }
          break;
        case '--':
          parsedOptions.showHelp = false;
          parseFiles = true;
          break;
        default:
          break;
      }
    }
  });
  return parsedOptions;
}
