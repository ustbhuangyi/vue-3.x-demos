import { compile } from '@vue/compiler-dom';
import * as runtimeDom from '@vue/runtime-dom';
import { registerRuntimeCompiler } from '@vue/runtime-dom';
export * from '@vue/runtime-dom';

// This package is the "full-build" that includes both the runtime
function compileToFunction(template, options) {
    const { code } = compile(template, {
        hoistStatic: true,
        ...options
    });
    return new Function('Vue', code)(runtimeDom);
}
registerRuntimeCompiler(compileToFunction);

export { compileToFunction as compile };
