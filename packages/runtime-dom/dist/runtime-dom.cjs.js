'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var runtimeCore = require('@vue/runtime-core');
var compilerDom = require('@vue/compiler-dom');

const doc = document;
const svgNS = 'http://www.w3.org/2000/svg';
const nodeOps = {
    insert: (child, parent, anchor) => {
        if (anchor != null) {
            parent.insertBefore(child, anchor);
        }
        else {
            parent.appendChild(child);
        }
    },
    remove: (child) => {
        const parent = child.parentNode;
        if (parent != null) {
            parent.removeChild(child);
        }
    },
    createElement: (tag, isSVG) => isSVG ? doc.createElementNS(svgNS, tag) : doc.createElement(tag),
    createText: (text) => doc.createTextNode(text),
    createComment: (text) => doc.createComment(text),
    setText: (node, text) => {
        node.nodeValue = text;
    },
    setElementText: (el, text) => {
        el.textContent = text;
    },
    parentNode: (node) => node.parentNode,
    nextSibling: (node) => node.nextSibling,
    querySelector: (selector) => doc.querySelector(selector)
};

// compiler should normalize class + :class bindings on the same element
// into a single binding ['staticClass', dynamic]
function patchClass(el, value, isSVG) {
    // directly setting className should be faster than setAttribute in theory
    if (isSVG) {
        el.setAttribute('class', value);
    }
    else {
        el.className = value;
    }
}

const EMPTY_OBJ =  Object.freeze({})
    ;
const isOn = (key) => key[0] === 'o' && key[1] === 'n';
const isArray = Array.isArray;
const isString = (val) => typeof val === 'string';
const isObject = (val) => val !== null && typeof val === 'object';

function patchStyle(el, prev, next) {
    const style = el.style;
    if (!next) {
        el.removeAttribute('style');
    }
    else if (isString(next)) {
        style.cssText = next;
    }
    else {
        for (const key in next) {
            style[key] = next[key];
        }
        if (prev && !isString(prev)) {
            for (const key in prev) {
                if (!next[key]) {
                    style[key] = '';
                }
            }
        }
    }
}

function patchAttr(el, key, value) {
    if (value == null) {
        el.removeAttribute(key);
    }
    else {
        el.setAttribute(key, value);
    }
}

function patchDOMProp(el, key, value, 
// the following args are passed only due to potential innerHTML/textContent
// overriding existing VNodes, in which case the old tree must be properly
// unmounted.
prevChildren, parentComponent, parentSuspense, unmountChildren) {
    if ((key === 'innerHTML' || key === 'textContent') && prevChildren != null) {
        unmountChildren(prevChildren, parentComponent, parentSuspense);
    }
    if (key === 'value' && el.tagName !== 'PROGRESS') {
        // store value as _value as well since
        // non-string values will be stringified.
        el._value = value;
    }
    if (value === '' && typeof el[key] === 'boolean') {
        // e.g. <select multiple> compiles to { multiple: '' }
        el[key] = true;
    }
    else {
        el[key] = value == null ? '' : value;
    }
}

// Async edge case fix requires storing an event listener's attach timestamp.
let _getNow = Date.now;
// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res ( relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
if (typeof document !== 'undefined' &&
    _getNow() > document.createEvent('Event').timeStamp) {
    // if the low-res timestamp which is bigger than the event timestamp
    // (which is evaluated AFTER) it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listeners as well.
    _getNow = () => performance.now();
}
// To avoid the overhead of repeatedly calling performance.now(), we cache
// and use the same timestamp for all event listeners attached in the same tick.
let cachedNow = 0;
const p = Promise.resolve();
const reset = () => {
    cachedNow = 0;
};
const getNow = () => cachedNow || (p.then(reset), (cachedNow = _getNow()));
function addEventListener(el, event, handler, options) {
    el.addEventListener(event, handler, options);
}
function removeEventListener(el, event, handler, options) {
    el.removeEventListener(event, handler, options);
}
function patchEvent(el, name, prevValue, nextValue, instance = null) {
    const prevOptions = prevValue && 'options' in prevValue && prevValue.options;
    const nextOptions = nextValue && 'options' in nextValue && nextValue.options;
    const invoker = prevValue && prevValue.invoker;
    const value = nextValue && 'handler' in nextValue ? nextValue.handler : nextValue;
    if (prevOptions || nextOptions) {
        const prev = prevOptions || EMPTY_OBJ;
        const next = nextOptions || EMPTY_OBJ;
        if (prev.capture !== next.capture ||
            prev.passive !== next.passive ||
            prev.once !== next.once) {
            if (invoker) {
                removeEventListener(el, name, invoker, prev);
            }
            if (nextValue && value) {
                const invoker = createInvoker(value, instance);
                nextValue.invoker = invoker;
                addEventListener(el, name, invoker, next);
            }
            return;
        }
    }
    if (nextValue && value) {
        if (invoker) {
            prevValue.invoker = null;
            invoker.value = value;
            nextValue.invoker = invoker;
            invoker.lastUpdated = getNow();
        }
        else {
            addEventListener(el, name, createInvoker(value, instance), nextOptions || void 0);
        }
    }
    else if (invoker) {
        removeEventListener(el, name, invoker, prevOptions || void 0);
    }
}
function createInvoker(initialValue, instance) {
    const invoker = (e) => {
        // async edge case #6566: inner click event triggers patch, event handler
        // attached to outer element during patch, and triggered again. This
        // happens because browsers fire microtask ticks between event propagation.
        // the solution is simple: we save the timestamp when a handler is attached,
        // and the handler would only fire if the event passed to it was fired
        // AFTER it was attached.
        if (e.timeStamp >= invoker.lastUpdated - 1) {
            runtimeCore.callWithAsyncErrorHandling(invoker.value, instance, 5 /* NATIVE_EVENT_HANDLER */, [e]);
        }
    };
    invoker.value = initialValue;
    initialValue.invoker = invoker;
    invoker.lastUpdated = getNow();
    return invoker;
}

function patchProp(el, key, nextValue, prevValue, isSVG, prevChildren, parentComponent, parentSuspense, unmountChildren) {
    switch (key) {
        // special
        case 'class':
            patchClass(el, nextValue, isSVG);
            break;
        case 'style':
            patchStyle(el, prevValue, nextValue);
            break;
        case 'modelValue':
        case 'onUpdate:modelValue':
            // Do nothing. This is handled by v-model directives.
            break;
        default:
            if (isOn(key)) {
                patchEvent(el, key.slice(2).toLowerCase(), prevValue, nextValue, parentComponent);
            }
            else if (!isSVG && key in el) {
                patchDOMProp(el, key, nextValue, prevChildren, parentComponent, parentSuspense, unmountChildren);
            }
            else {
                patchAttr(el, key, nextValue);
            }
            break;
    }
}

const getModelAssigner = (vnode) => vnode.props['onUpdate:modelValue'];
function onCompositionStart(e) {
    e.target.composing = true;
}
function onCompositionEnd(e) {
    const target = e.target;
    if (target.composing) {
        target.composing = false;
        trigger(target, 'input');
    }
}
function trigger(el, type) {
    const e = document.createEvent('HTMLEvents');
    e.initEvent(type, true, true);
    el.dispatchEvent(e);
}
function toNumber(val) {
    const n = parseFloat(val);
    return isNaN(n) ? val : n;
}
// We are exporting the v-model runtime directly as vnode hooks so that it can
// be tree-shaken in case v-model is never used.
const vModelText = {
    beforeMount(el, { value, modifiers: { lazy, trim, number } }, vnode) {
        el.value = value;
        const assign = getModelAssigner(vnode);
        const castToNumber = number || el.type === 'number';
        addEventListener(el, lazy ? 'change' : 'input', () => {
            let domValue = el.value;
            if (trim) {
                domValue = domValue.trim();
            }
            else if (castToNumber) {
                domValue = toNumber(domValue);
            }
            assign(domValue);
        });
        if (trim) {
            addEventListener(el, 'change', () => {
                el.value = el.value.trim();
            });
        }
        if (!lazy) {
            addEventListener(el, 'compositionstart', onCompositionStart);
            addEventListener(el, 'compositionend', onCompositionEnd);
            // Safari < 10.2 & UIWebView doesn't fire compositionend when
            // switching focus before confirming composition choice
            // this also fixes the issue where some browsers e.g. iOS Chrome
            // fires "change" instead of "input" on autocomplete.
            addEventListener(el, 'change', onCompositionEnd);
        }
    },
    beforeUpdate(el, { value, modifiers: { trim, number } }) {
        if (document.activeElement === el) {
            if (trim && el.value.trim() === value) {
                return;
            }
            if ((number || el.type === 'number') && toNumber(el.value) === value) {
                return;
            }
        }
        el.value = value;
    }
};
const vModelCheckbox = {
    beforeMount(el, binding, vnode) {
        setChecked(el, binding, vnode);
        const assign = getModelAssigner(vnode);
        addEventListener(el, 'change', () => {
            const modelValue = el._modelValue;
            const elementValue = getValue(el);
            const checked = el.checked;
            if (isArray(modelValue)) {
                const index = looseIndexOf(modelValue, elementValue);
                const found = index !== -1;
                if (checked && !found) {
                    assign(modelValue.concat(elementValue));
                }
                else if (!checked && found) {
                    const filtered = [...modelValue];
                    filtered.splice(index, 1);
                    assign(filtered);
                }
            }
            else {
                assign(checked);
            }
        });
    },
    beforeUpdate: setChecked
};
function setChecked(el, { value }, vnode) {
    el._modelValue = value;
    el.checked = isArray(value)
        ? looseIndexOf(value, vnode.props.value) > -1
        : !!value;
}
const vModelRadio = {
    beforeMount(el, { value }, vnode) {
        el.checked = looseEqual(value, vnode.props.value);
        const assign = getModelAssigner(vnode);
        addEventListener(el, 'change', () => {
            assign(getValue(el));
        });
    },
    beforeUpdate(el, { value }, vnode) {
        el.checked = looseEqual(value, vnode.props.value);
    }
};
const vModelSelect = {
    // use mounted & updated because <select> relies on its children <option>s.
    mounted(el, { value }, vnode) {
        setSelected(el, value);
        const assign = getModelAssigner(vnode);
        addEventListener(el, 'change', () => {
            const selectedVal = Array.prototype.filter
                .call(el.options, (o) => o.selected)
                .map(getValue);
            assign(el.multiple ? selectedVal : selectedVal[0]);
        });
    },
    updated(el, { value }) {
        setSelected(el, value);
    }
};
function setSelected(el, value) {
    const isMultiple = el.multiple;
    if (isMultiple && !isArray(value)) {
        
            runtimeCore.warn(`<select multiple v-model> expects an Array value for its binding, ` +
                `but got ${Object.prototype.toString.call(value).slice(8, -1)}.`);
        return;
    }
    for (let i = 0, l = el.options.length; i < l; i++) {
        const option = el.options[i];
        const optionValue = getValue(option);
        if (isMultiple) {
            option.selected = looseIndexOf(value, optionValue) > -1;
        }
        else {
            if (looseEqual(getValue(option), value)) {
                el.selectedIndex = i;
                return;
            }
        }
    }
    if (!isMultiple) {
        el.selectedIndex = -1;
    }
}
function looseEqual(a, b) {
    if (a === b)
        return true;
    const isObjectA = isObject(a);
    const isObjectB = isObject(b);
    if (isObjectA && isObjectB) {
        try {
            const isArrayA = isArray(a);
            const isArrayB = isArray(b);
            if (isArrayA && isArrayB) {
                return (a.length === b.length &&
                    a.every((e, i) => looseEqual(e, b[i])));
            }
            else if (a instanceof Date && b instanceof Date) {
                return a.getTime() === b.getTime();
            }
            else if (!isArrayA && !isArrayB) {
                const keysA = Object.keys(a);
                const keysB = Object.keys(b);
                return (keysA.length === keysB.length &&
                    keysA.every(key => looseEqual(a[key], b[key])));
            }
            else {
                /* istanbul ignore next */
                return false;
            }
        }
        catch (e) {
            /* istanbul ignore next */
            return false;
        }
    }
    else if (!isObjectA && !isObjectB) {
        return String(a) === String(b);
    }
    else {
        return false;
    }
}
function looseIndexOf(arr, val) {
    return arr.findIndex(item => looseEqual(item, val));
}
// retrieve raw value set via :value bindings
function getValue(el) {
    return '_value' in el ? el._value : el.value;
}
const vModelDynamic = {
    beforeMount(el, binding, vnode) {
        callModelHook(el, binding, vnode, null, 'beforeMount');
    },
    mounted(el, binding, vnode) {
        callModelHook(el, binding, vnode, null, 'mounted');
    },
    beforeUpdate(el, binding, vnode, prevVNode) {
        callModelHook(el, binding, vnode, prevVNode, 'beforeUpdate');
    },
    updated(el, binding, vnode, prevVNode) {
        callModelHook(el, binding, vnode, prevVNode, 'updated');
    }
};
function callModelHook(el, binding, vnode, prevVNode, hook) {
    let modelToUse;
    switch (el.tagName) {
        case 'SELECT':
            modelToUse = vModelSelect;
            break;
        case 'TEXTAREA':
            modelToUse = vModelText;
            break;
        default:
            switch (el.type) {
                case 'checkbox':
                    modelToUse = vModelCheckbox;
                    break;
                case 'radio':
                    modelToUse = vModelRadio;
                    break;
                default:
                    modelToUse = vModelText;
            }
    }
    const fn = modelToUse[hook];
    fn && fn(el, binding, vnode, prevVNode);
}

const systemModifiers = ['ctrl', 'shift', 'alt', 'meta'];
const modifierGuards = {
    stop: e => e.stopPropagation(),
    prevent: e => e.preventDefault(),
    self: e => e.target !== e.currentTarget,
    ctrl: e => !e.ctrlKey,
    shift: e => !e.shiftKey,
    alt: e => !e.altKey,
    meta: e => !e.metaKey,
    left: e => 'button' in e && e.button !== 0,
    middle: e => 'button' in e && e.button !== 1,
    right: e => 'button' in e && e.button !== 2,
    exact: (e, modifiers) => systemModifiers.some(m => e[`${m}Key`] && !modifiers.includes(m))
};
const withModifiers = (fn, modifiers) => {
    return (event) => {
        for (let i = 0; i < modifiers.length; i++) {
            const guard = modifierGuards[modifiers[i]];
            if (guard && guard(event, modifiers))
                return;
        }
        return fn(event);
    };
};
// Kept for 2.x compat.
// Note: IE11 compat for `spacebar` and `del` is removed for now.
const keyNames = {
    esc: 'escape',
    space: ' ',
    up: 'arrowup',
    left: 'arrowleft',
    right: 'arrowright',
    down: 'arrowdown',
    delete: 'backspace'
};
const withKeys = (fn, modifiers) => {
    return (event) => {
        if (!('key' in event))
            return;
        const eventKey = event.key.toLowerCase();
        if (
        // None of the provided key modifiers match the current event key
        !modifiers.some(k => k === eventKey || keyNames[k] === eventKey)) {
            return;
        }
        return fn(event);
    };
};

const { render, createApp } = runtimeCore.createRenderer({
    patchProp,
    ...nodeOps
});
const wrappedCreateApp = () => {
    const app = createApp();
    // inject `isNativeTag` dev only
    Object.defineProperty(app.config, 'isNativeTag', {
        value: (tag) => compilerDom.isHTMLTag(tag) || compilerDom.isSVGTag(tag),
        writable: false
    });
    return app;
};
const exportedCreateApp =  wrappedCreateApp ;

Object.keys(runtimeCore).forEach(function (k) {
  if (k !== 'default') Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () {
      return runtimeCore[k];
    }
  });
});
exports.createApp = exportedCreateApp;
exports.render = render;
exports.vModelCheckbox = vModelCheckbox;
exports.vModelDynamic = vModelDynamic;
exports.vModelRadio = vModelRadio;
exports.vModelSelect = vModelSelect;
exports.vModelText = vModelText;
exports.withKeys = withKeys;
exports.withModifiers = withModifiers;
