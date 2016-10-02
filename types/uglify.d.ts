

declare module uglifyjs {
  var AST_NODE: any;
  function Compressor(options?: any): any;
}

declare module 'uglify-js' {
  export = uglifyjs;
}