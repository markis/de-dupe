# De-dupe - a Javascript string minifier

[![Build Status](https://travis-ci.org/markis/de-dupe.svg?branch=master)](https://travis-ci.org/markis/de-dupe) [![Known Vulnerabilities](https://snyk.io/test/github/markis/de-dupe/badge.svg)](https://snyk.io/test/github/markis/de-dupe) 

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

### Example

The follow demonstrates what the de-dupe code will do.

Original code:
```
function x() { console.log('long string', 'long string', 'long string', 'long string', 'long string', 'long string'); }
```

De-duplicated code:
```
function x() { var a='long string'; console.log(a, a, a, a, a, a); }
```

### Why?

#### Doesn't gzip/deflate take care of this?

Yes, it does. But, this can help. Read on...

To put it in very simple terms, gzip and deflate work by identifying patterns that already exist in the string and then
place markers telling the decompressor where the pattern could be identified.  First 8 bits identify how long the pattern is, and the last 15 bits identify how far away the previous pattern could be identified.

Before gzip:
```
console.log('long string', 'long string');
```

After gzip:
```
console.log('long string', <13,15>);
```

#### Today's javascript >32KB

It works in theory, but sometimes falls short in practice.

Notice, the distance bits are only 15 (1-32768), which means the patterns have to be within 32KB of uncompressed data of each other. Basically, all of the major javascript frameworks are larger than 32KB.  And after taking a cruise around Alexa's Top 10 most popular websites on the internet (google.com, amazon.com, facebook.com, twitter.com, etc.), every single site had at least one javascript file over 32KB (mostly, I saw ~200KB range).  Assuming your site has a javascript file of over 200KB and a pattern at the beginning and somewhere in the middle; then gzip won't be able to help you.  Compounding the size of your javascript file.

#### Conclusion

If your javascript is tiny and emmaculately procured down to it's smallest form. Then quite possibly this tool will not help you. It might actually make your gzip'd javascript larger. But I am guessing since you found this tool, you probably are looking for something to help make your javascript smaller.
