const z_act = (function() {
  const GLOBALS = {
    queuedDidMounts: [],
    stackedWillUnMounts: []
  };
  function Component() {}
  Component.prototype.isComponent = true;
  Component.prototype.setState = function(nextState) {
    if (Object.prototype.toString.call(nextState) === "[object Object]") {
      updateState(this.state, nextState);
      diff(componentToVnode(this, this.props, this.children), this.dom, this.dom.parentNode);
      _cleanUpCashedDidMounts();
      return;
    }
    throw new Error("setState first argument must be an object");
  };
  function updateState(prevState, nextState) {
    for (let x in nextState) prevState[x] = nextState[x];
  }
  function VNode(tag, attrs, children) {
    this.tag = tag;
    this.attrs = attrs;
    this.children = children;
  }
  function h(tag, attrs) {
    attrs = attrs || {};
    let children = extractJSXChildren(arguments);
    if (attrs.children) delete attrs.children;
    if (typeof tag === "string") return new VNode(tag, attrs, children);
    if (typeof tag === "function") {
      if (tag.prototype.isComponent) {
        let comp = new tag();
        if (comp.render) return componentToVnode(comp, attrs, children);
        throw new Error("every component must have a render method");
      }
      return fcomponentToVnode(tag, attrs, children);
    }
  }
  function fcomponentToVnode(f, attrs, children) {
    let vnode = f(attrs, children);
    vnode.attrs.key = attrs.key;
    vnode.attrs.isFComponent = true;
    return vnode;
  }
  function componentToVnode(component, attrs, children) {
    component.props = attrs;
    component.children = children;
    let vnode = component.render();
    vnode.component = component;
    vnode.isComponent = true;
    vnode.attrs.key = attrs.key;
    return vnode;
  }
  function extractJSXChildren(args, children = []) {
    if (args.length > 2) {
      for (let i = 2; i < args.length; i++) {
        if (Array.isArray(args[i])) {
          if (args[i].length)
            for (let j = 0; j < args[i].length; j++)
              if ((args[i][j] && args[i][j] !== true) || args[i][j] === 0 || args[i] === "") children.push(args[i][j]);
        } else {
          if ((args[i] && args[i] !== true) || args[i] === 0 || args[i] === "") children.push(args[i]);
        }
      }
      if (children.length) return children;
    }
  }
  function domFactory({ tag, attrs, children, component }) {
    var node = document.createElement(tag);
    node._tag = tag;
    node._attrs = attrs;
    if (component) {
      component.dom = node;
      node.component = component;
      node.isComponent = true;
      component.componentDidMount && GLOBALS.queuedDidMounts.push(component.componentDidMount.bind(component));
    }
    applyAttrs(attrs, node);
    if (children)
      for (let i = 0; i < children.length; i++)
        typeof children[i] === "string" || typeof children[i] === "number"
          ? node.appendChild(document.createTextNode(children[i]))
          : node.appendChild(domFactory(children[i]));
    return node;
  }
  function resetUnUsedAttrs(v_attrs, d_attrs, dom, hint) {
    let isDirty = false;
    for (let attr in d_attrs) {
      if (attr === "style") {
        resetUnUsedAttrs(v_attrs[attr] || {}, d_attrs[attr], dom, "style");
      } else if (attr[0] === "o" && attr[1] === "n" && attr.length > 2 && !hint) {
        if (d_attrs[attr] !== v_attrs[attr]) {
          dom.removeEventListener(attr.slice(2).toLowerCase(), d_attrs[attr]);
          isDirty = true;
        }
      } else {
        if (!v_attrs[attr]) {
          hint === "style" ? dom.removeProperty(attr) : dom.removeAttribute(attr);
          isDirty = true;
        }
      }
    }
    return isDirty;
  }
  function applyAttrs(attrs, dom, hint) {
    for (let attr in attrs) {
      if (attr === "style") applyAttrs(attrs.style, dom.style, "style");
      else if (attr[0] === "o" && attr[1] === "n" && attr.length > 2 && !hint)
        dom.addEventListener(attr.slice(2).toLowerCase(), attrs[attr]);
      else dom[attr] = attrs[attr];
    }
  }
  function _recycle(dom) {
    if (
      dom.nodeType === 3 ||
      (dom.nodeType === 1 && !dom.isComponent && dom.childNodes.length <= 1 && dom.childNodes[0] && dom.childNodes[0].nodeType === 3)
    ) {
      return;
    }
    if (dom.nodeType === 1 && dom.isComponent && dom.component.componentWillUnmount) {
      GLOBALS.stackedWillUnMounts.push(dom.component.componentWillUnmount.bind(dom.component));
      if (dom.childNodes.length) {
        let i = 0,
          l = dom.childNodes.length;
        while (i < l) {
          _recycle(dom.childNodes[i]);
          i++;
        }
      }
    }
  }
  function _cleanUpCashedDidMounts() {
    if (GLOBALS.queuedDidMounts.length) {
      let qdm = GLOBALS.queuedDidMounts.slice();
      GLOBALS.queuedDidMounts.length = 0;
      for (let i = 0; i < qdm.length; i++) qdm[i]();
    }
  }
  function _cleanUpCashedWillUnMounts() {
    if (GLOBALS.stackedWillUnMounts.length) {
      let sdum = GLOBALS.stackedWillUnMounts.slice();
      GLOBALS.stackedWillUnMounts.length = 0;
      for (let i = sdum.length - 1; i > -1; i--) sdum[i]();
    }
  }
  function recycle(dom, unMountOnly) {
    _recycle(dom);
    _cleanUpCashedWillUnMounts();
    unMountOnly || dom.remove();
  }
  function diffAttrs(v_attrs, d_attrs, dom, hint) {
    let isDirty = false;
    for (let attr in v_attrs) {
      if (attr === "style") {
        diffAttrs(v_attrs[attr], d_attrs[attr], dom[attr], "style");
      } else if (attr[0] === "o" && attr[1] === "n" && attr.length > 2 && !hint && v_attrs[attr] !== d_attrs[attr]) {
        dom.addEventListener(attr.slice(2).toLowerCase(), v_attrs[attr]);
        isDirty = true;
      } else {
        if (dom[attr] !== v_attrs[attr]) {
          dom[attr] = v_attrs[attr];
          isDirty = true;
        }
      }
    }
    return isDirty;
  }
  function deleteNotNeededChildren(dchildren, vchildren) {
    if (vchildren && dchildren.length > vchildren.length) {
      let start = dchildren.length,
        end = vchildren.length;
      while (start-- > end) {
        recycle(dchildren[start]);
      }
    }
  }
  function _diffAndUpdate(vnode, dom) {
    resetUnUsedAttrs(vnode.attrs, dom._attrs, dom);
    diffAttrs(vnode.attrs, dom._attrs, dom);
    if (vnode.isComponent) {
      dom.component = vnode.component;
      dom.component.dom = dom;
    }
    dom._attrs = vnode.attrs;
    dom._tag = vnode.tag;
  }
  function diff(vnode, dom, parent, keyed, vchildren, dchildren, cf, mutateKeysMode) {
    if (dom && (vnode || vnode === "")) {
      if (dom.nodeType === 1) {
        if (vnode.tag === dom._tag && !keyed) {
          if (mutateKeysMode && (vnode.tag === "input" || vnode.tag === "textarea")) {
            let isActive = document.activeElement === dom;
            let _dom = domFactory(vnode);
            parent.replaceChild(_dom, dom);
            isActive && _dom.focus();
            return;
          }
          _diffAndUpdate(vnode, dom);
          if (vnode.children && vnode.children.length) {
            for (let i = 0; i < vnode.children.length; i++) {
              let iskeyed;
              if (vnode.children[i].attrs && (vnode.children[i].attrs.key || vnode.children[i].attrs.key === 0)) iskeyed = true;
              else if (dom.childNodes[i] && (dom.childNodes[i].key || dom.childNodes[i].key === 0)) iskeyed = true;
              else iskeyed = false;
              let res = diff(vnode.children[i], dom.childNodes[i], dom, iskeyed, vnode.children, dom.childNodes, i, mutateKeysMode);
              if (res) break;
            }
          }
          deleteNotNeededChildren(dom.childNodes, vnode.children || []);
        } else if (keyed) {
          let focusedElement = document.activeElement;
          let isFocusedElementChildOfCurrentParent = focusedElement.parentNode === parent;
          let vkeysMap = {};
          for (let i = cf; i < vchildren.length; i++)
            if (vchildren[i].attrs.key || vchildren[i].attrs.key === 0) vkeysMap[vchildren[i].attrs.key] = true;
          let dkeysMap = [];
          for (let i = cf; i < dchildren.length; i++) dkeysMap.push(dchildren[i].key || dchildren[i].key === 0 ? dchildren[i].key : null);
          for (let i = cf; i < vchildren.length; i++) {
            let vchildKey = vchildren[i].attrs.key;
            if (vchildKey || vchildKey === 0) {
              let index = dkeysMap.indexOf(vchildKey);
              let originalIndex = index;
              ~index && (index = index + cf);
              if (index === i) {
                diff(vchildren[i], dchildren[index], parent);
                dkeysMap[originalIndex] = null;
              } else if (~index && i < dchildren.length) {
                diff(vchildren[i], dchildren[index], parent);
                parent.insertBefore(dchildren[index], dchildren[i]);
                dkeysMap[originalIndex] = null;
                dkeysMap[originalIndex - 1] === null || originalIndex === 0 || dkeysMap.unshift(dkeysMap.splice(originalIndex, 1)[0]);
              } else if (!~index && i > dchildren.length - 1) {
                parent.appendChild(domFactory(vchildren[i]));
              } else if (!~index && i < dchildren.length) {
                if (vkeysMap[dchildren[i].key]) {
                  parent.insertBefore(domFactory(vchildren[i]), dchildren[i]);
                  dkeysMap.unshift(null);
                } else {
                  let empty = undefined;
                  diff(vchildren[i], dchildren[i], parent, empty, empty, empty, empty, true);
                }
              }
            } else {
              if (i > dchildren.length - 1) {
                parent.appendChild(domFactory(vchildren[i]));
              } else {
                if (vkeysMap[dchildren[i].key]) {
                  parent.insertBefore(domFactory(vchildren[i]), dchildren[i]);
                  dkeysMap.unshift(null);
                } else {
                  diff(vchildren[i], dchildren[i], parent);
                }
              }
            }
          }
          dkeysMap = undefined;
          vkeysMap = undefined;
          isFocusedElementChildOfCurrentParent && focusedElement.focus();
          return true;
        } else {
          let _dom = domFactory(vnode);
          recycle(dom, true);
          parent.replaceChild(_dom, dom);
          dom = _dom;
        }
      } else if (dom.nodeType === 3) {
        if (typeof vnode === "string" || typeof vnode === "number") {
          vnode !== dom.nodeValue && (dom.nodeValue = vnode);
        } else {
          let _dom = domFactory(vnode);
          recycle(dom, true);
          parent.replaceChild(_dom, dom);
          dom = _dom;
        }
      }
    } else if (dom == null && vnode) {
      parent.appendChild(domFactory(vnode));
    }
  }
  function render(entry, where) {
    if (where.appendChild) {
      where.appendChild(domFactory(entry));
      _cleanUpCashedDidMounts();
    }
  }
  return { h, Component, render };
})();
