'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var runtimeCore = require('@vue/runtime-core');

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

const EMPTY_OBJ =  {};
const isOn = (key) => key[0] === 'o' && key[1] === 'n';
const isArray = Array.isArray;
const isString = (val) => typeof val === 'string';
const isObject = (val) => val !== null && typeof val === 'object';
/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 */
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

function patchStyle(el, prev, next) {
    const { style } = el;
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

const xlinkNS = 'http://www.w3.org/1999/xlink';
function isXlink(name) {
    return name.charAt(5) === ':' && name.slice(0, 5) === 'xlink';
}
function getXlinkProp(name) {
    return isXlink(name) ? name.slice(6, name.length) : '';
}
function patchAttr(el, key, value, isSVG) {
    // isSVG short-circuits isXlink check
    if (isSVG && isXlink(key)) {
        if (value == null) {
            el.removeAttributeNS(xlinkNS, getXlinkProp(key));
        }
        else {
            el.setAttributeNS(xlinkNS, key, value);
        }
    }
    else {
        if (value == null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, value);
        }
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
    const persistent = nextValue && 'persistent' in nextValue && nextValue.persistent;
    if (!persistent && (prevOptions || nextOptions)) {
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
            const args = [e];
            const value = invoker.value;
            if (isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    runtimeCore.callWithAsyncErrorHandling(value[i], instance, 5 /* NATIVE_EVENT_HANDLER */, args);
                }
            }
            else {
                runtimeCore.callWithAsyncErrorHandling(value, instance, 5 /* NATIVE_EVENT_HANDLER */, args);
            }
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
                patchAttr(el, key, nextValue, isSVG);
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
            if (isArray(modelValue)) {
                const i = looseIndexOf(modelValue, elementValue);
                if (i > -1) {
                    assign([...modelValue.slice(0, i), ...modelValue.slice(i + 1)]);
                }
                else {
                    assign(modelValue.concat(elementValue));
                }
            }
            else {
                assign(el.checked);
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
function looseIndexOf(arr, val) {
    for (let i = 0; i < arr.length; i++) {
        if (looseEqual(arr[i], val))
            return i;
    }
    return -1;
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

const { render, createApp } = runtimeCore.createRenderer({
    patchProp,
    ...nodeOps
});

Object.keys(runtimeCore).forEach(function (k) {
  if (k !== 'default') Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () {
      return runtimeCore[k];
    }
  });
});
exports.createApp = createApp;
exports.render = render;
exports.vModelCheckbox = vModelCheckbox;
exports.vModelDynamic = vModelDynamic;
exports.vModelRadio = vModelRadio;
exports.vModelSelect = vModelSelect;
exports.vModelText = vModelText;
