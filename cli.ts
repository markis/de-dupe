import { readFile, writeFile } from 'fs';
import { resolve } from 'path';
import Dedupe from './index';
const config = require('./package.json');
declare type Process = typeof process;

process.title = config.name;

var options = parseArguments(process);
if (!options.showHelp && options.files.length > 0) {
  for (var i = 0; i < options.files.length; i++) {
    let file = options.files[i];
    readFile(file, 'utf-8', function(err, code) {
      if (err) {
        console.error(err);
      } else {
        var dedupeOptions = {
          cleanStrings: !!options.cleanString,
          addScope: !!options.addScope
        };
        var dedupe = new Dedupe(dedupeOptions);

        var ast = dedupe.dedupe(code);
        writeFile('./output.js', ast);
      }
    });
  }
} else {
  printHelp();
}

function printHelp() {
  console.log(
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
  var options = {
    addScope: false,
    cleanString: false,
    showHelp: true,
    files: [] as string[]
  };
  var parseFiles = false;
  process.argv.forEach((val) => {
    if (parseFiles) {
      options.files.push(resolve(val));
    } else {
      switch (val) {
        case '--addScope':
        case '-s':
          options.addScope = true;
          break;
        case '--cleanStrings':
        case '-c':
          options.cleanString = true;
          break;
        case '--':
          options.showHelp = false;
          parseFiles = true;
          break;
      }
    }
  });
  return options;
}