import { createRenderer } from '@vue/runtime-core';
export * from '@vue/runtime-core';
import { markNonReactive } from '@vue/reactivity';

let nodeId = 0;
let recordedNodeOps = [];
function logNodeOp(op) {
    recordedNodeOps.push(op);
}
function resetOps() {
    recordedNodeOps = [];
}
function dumpOps() {
    const ops = recordedNodeOps.slice();
    resetOps();
    return ops;
}
function createElement(tag) {
    const node = {
        id: nodeId++,
        type: "element" /* ELEMENT */,
        tag,
        children: [],
        props: {},
        parentNode: null,
        eventListeners: null
    };
    logNodeOp({
        type: "create" /* CREATE */,
        nodeType: "element" /* ELEMENT */,
        targetNode: node,
        tag
    });
    // avoid test nodes from being observed
    markNonReactive(node);
    return node;
}
function createText(text) {
    const node = {
        id: nodeId++,
        type: "text" /* TEXT */,
        text,
        parentNode: null
    };
    logNodeOp({
        type: "create" /* CREATE */,
        nodeType: "text" /* TEXT */,
        targetNode: node,
        text
    });
    // avoid test nodes from being observed
    markNonReactive(node);
    return node;
}
function createComment(text) {
    const node = {
        id: nodeId++,
        type: "comment" /* COMMENT */,
        text,
        parentNode: null
    };
    logNodeOp({
        type: "create" /* CREATE */,
        nodeType: "comment" /* COMMENT */,
        targetNode: node,
        text
    });
    // avoid test nodes from being observed
    markNonReactive(node);
    return node;
}
function setText(node, text) {
    logNodeOp({
        type: "setText" /* SET_TEXT */,
        targetNode: node,
        text
    });
    node.text = text;
}
function insert(child, parent, ref) {
    let refIndex;
    if (ref != null) {
        refIndex = parent.children.indexOf(ref);
        if (refIndex === -1) {
            console.error('ref: ', ref);
            console.error('parent: ', parent);
            throw new Error('ref is not a child of parent');
        }
    }
    logNodeOp({
        type: "insert" /* INSERT */,
        targetNode: child,
        parentNode: parent,
        refNode: ref
    });
    // remove the node first, but don't log it as a REMOVE op
    remove(child, false);
    // re-calculate the ref index because the child's removal may have affected it
    refIndex = ref ? parent.children.indexOf(ref) : -1;
    if (refIndex === -1) {
        parent.children.push(child);
        child.parentNode = parent;
    }
    else {
        parent.children.splice(refIndex, 0, child);
        child.parentNode = parent;
    }
}
function remove(child, logOp = true) {
    const parent = child.parentNode;
    if (parent != null) {
        if (logOp) {
            logNodeOp({
                type: "remove" /* REMOVE */,
                targetNode: child,
                parentNode: parent
            });
        }
        const i = parent.children.indexOf(child);
        if (i > -1) {
            parent.children.splice(i, 1);
        }
        else {
            console.error('target: ', child);
            console.error('parent: ', parent);
            throw Error('target is not a childNode of parent');
        }
        child.parentNode = null;
    }
}
function setElementText(el, text) {
    logNodeOp({
        type: "setElementText" /* SET_ELEMENT_TEXT */,
        targetNode: el,
        text
    });
    el.children.forEach(c => {
        c.parentNode = null;
    });
    if (!text) {
        el.children = [];
    }
    else {
        el.children = [
            {
                id: nodeId++,
                type: "text" /* TEXT */,
                text,
                parentNode: el
            }
        ];
    }
}
function parentNode(node) {
    return node.parentNode;
}
function nextSibling(node) {
    const parent = node.parentNode;
    if (!parent) {
        return null;
    }
    const i = parent.children.indexOf(node);
    return parent.children[i + 1] || null;
}
function querySelector() {
    throw new Error('querySelector not supported in test renderer.');
}
const nodeOps = {
    insert,
    remove,
    createElement,
    createText,
    createComment,
    setText,
    setElementText,
    parentNode,
    nextSibling,
    querySelector
};

const EMPTY_OBJ = process.env.NODE_ENV !== 'production'
    ? Object.freeze({})
    : {};
const isOn = (key) => key[0] === 'o' && key[1] === 'n';

function patchProp(el, key, nextValue, prevValue) {
    logNodeOp({
        type: "patch" /* PATCH */,
        targetNode: el,
        propKey: key,
        propPrevValue: prevValue,
        propNextValue: nextValue
    });
    el.props[key] = nextValue;
    if (isOn(key)) {
        const event = key.slice(2).toLowerCase();
        (el.eventListeners || (el.eventListeners = {}))[event] = nextValue;
    }
}

function serialize(node, indent = 0, depth = 0) {
    if (node.type === "element" /* ELEMENT */) {
        return serializeElement(node, indent, depth);
    }
    else {
        return serializeText(node, indent, depth);
    }
}
function serializeInner(node, indent = 0, depth = 0) {
    const newLine = indent ? `\n` : ``;
    return node.children.length
        ? newLine +
            node.children.map(c => serialize(c, indent, depth + 1)).join(newLine) +
            newLine
        : ``;
}
function serializeElement(node, indent, depth) {
    const props = Object.keys(node.props)
        .map(key => {
        const value = node.props[key];
        return isOn(key) || value == null ? `` : `${key}=${JSON.stringify(value)}`;
    })
        .filter(Boolean)
        .join(' ');
    const padding = indent ? ` `.repeat(indent).repeat(depth) : ``;
    return (`${padding}<${node.tag}${props ? ` ${props}` : ``}>` +
        `${serializeInner(node, indent, depth)}` +
        `${padding}</${node.tag}>`);
}
function serializeText(node, indent, depth) {
    const padding = indent ? ` `.repeat(indent).repeat(depth) : ``;
    return (padding +
        (node.type === "comment" /* COMMENT */ ? `<!--${node.text}-->` : node.text));
}

function triggerEvent(el, event, payload = []) {
    const { eventListeners } = el;
    if (eventListeners) {
        const listener = eventListeners[event];
        if (listener) {
            if (Array.isArray(listener)) {
                for (let i = 0; i < listener.length; i++) {
                    listener[i](...payload);
                }
            }
            else {
                listener(...payload);
            }
        }
    }
}

function mockWarn() {
    expect.extend({
        toHaveBeenWarned(received) {
            asserted.add(received);
            const passed = warn.mock.calls.some(args => args[0].indexOf(received) > -1);
            if (passed) {
                return {
                    pass: true,
                    message: () => `expected "${received}" not to have been warned.`
                };
            }
            else {
                const msgs = warn.mock.calls.map(args => args[0]).join('\n - ');
                return {
                    pass: false,
                    message: () => `expected "${received}" to have been warned.\n\nActual messages:\n\n - ${msgs}`
                };
            }
        },
        toHaveBeenWarnedLast(received) {
            asserted.add(received);
            const passed = warn.mock.calls[warn.mock.calls.length - 1][0].indexOf(received) > -1;
            if (passed) {
                return {
                    pass: true,
                    message: () => `expected "${received}" not to have been warned last.`
                };
            }
            else {
                const msgs = warn.mock.calls.map(args => args[0]).join('\n - ');
                return {
                    pass: false,
                    message: () => `expected "${received}" to have been warned last.\n\nActual messages:\n\n - ${msgs}`
                };
            }
        },
        toHaveBeenWarnedTimes(received, n) {
            asserted.add(received);
            let found = 0;
            warn.mock.calls.forEach(args => {
                if (args[0].indexOf(received) > -1) {
                    found++;
                }
            });
            if (found === n) {
                return {
                    pass: true,
                    message: () => `expected "${received}" to have been warned ${n} times.`
                };
            }
            else {
                return {
                    pass: false,
                    message: () => `expected "${received}" to have been warned ${n} times but got ${found}.`
                };
            }
        }
    });
    let warn;
    const asserted = new Set();
    beforeEach(() => {
        asserted.clear();
        warn = jest.spyOn(console, 'warn');
        warn.mockImplementation(() => { });
    });
    afterEach(() => {
        const assertedArray = Array.from(asserted);
        const nonAssertedWarnings = warn.mock.calls
            .map(args => args[0])
            .filter(received => {
            return !assertedArray.some(assertedMsg => {
                return received.indexOf(assertedMsg) > -1;
            });
        });
        warn.mockRestore();
        if (nonAssertedWarnings.length) {
            nonAssertedWarnings.forEach(warning => {
                console.warn(warning);
            });
            throw new Error(`test case threw unexpected warnings.`);
        }
    });
}

const { render, createApp } = createRenderer({
    patchProp,
    ...nodeOps
});
// convenience for one-off render validations
function renderToString(vnode) {
    const root = nodeOps.createElement('div');
    render(vnode, root);
    return serializeInner(root);
}

export { createApp, dumpOps, logNodeOp, mockWarn, nodeOps, render, renderToString, resetOps, serialize, serializeInner, triggerEvent };
