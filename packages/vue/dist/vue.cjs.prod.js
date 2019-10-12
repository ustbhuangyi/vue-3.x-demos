'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var compilerDom = require('@vue/compiler-dom');
var runtimeDom = require('@vue/runtime-dom');

// This package is the "full-build" that includes both the runtime
function compileToFunction(template, options) {
    const { code } = compilerDom.compile(template, {
        hoistStatic: true,
        ...options
    });
    return new Function('Vue', code)(runtimeDom);
}
runtimeDom.registerRuntimeCompiler(compileToFunction);

Object.keys(runtimeDom).forEach(function (k) {
  if (k !== 'default') Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () {
      return runtimeDom[k];
    }
  });
});
exports.compile = compileToFunction;
