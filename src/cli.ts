import { readFile, writeFile } from 'fs';
import { resolve } from 'path';
import Dedupe from './index';
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
        const dedupeOptions = {
          addScope: !!opt.addScope,
          cleanStrings: !!opt.cleanString,
          minInstances: opt.minInstances || 0
        };
        const dedupe = new Dedupe(dedupeOptions);
        const dedupedCode = dedupe.dedupe(code);
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
  const parsedOptions = {
    addScope: false,
    cleanString: false,
    files: [] as string[],
    minInstances: undefined,
    showHelp: true
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
          parsedOptions.cleanString = true;
          break;
        case '--minInstances':
        case '-m':
          const minInstances = parseInt(process.argv[idx + 1], 10);
          if (minInstances && minInstances > 0) {
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
