#De-dupe - a Javascript string minifier

[![Greenkeeper badge](https://badges.greenkeeper.io/markis/de-dupe.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/markis/de-dupe.svg?branch=master)](https://travis-ci.org/markis/de-dupe)

De-dupe is an asset minification process that will identify duplicate strings in all scopes of a javascript file and will introduce a variable instead of the string itself.  It does not introduce variables on the global scope, it will keep the variables to the individual scopes that it identifies.  It can also clean up strings so that they don't have large amounts of white space in them.

### Installation

project:
`npm install de-dupe --save-dev`

global:
`npm install de-dupe -g`

### Usage

```
Usage: de-dupe [options] -- <...files>
Options:
--addScope, -s       Adds an IIFE around the entire script, this broadens the possible instances where strings duplication could be consolidated
--cleanStrings, -c   Removes duplicate spaces from strings, usually strings in javascript render to the DOM and more than one space in the DOM is ignored and just bloats scripts
```