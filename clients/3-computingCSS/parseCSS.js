const CSS = require("css");

let rules = [];
function addCSSRules(text) {
  let ast = CSS.parse(text);
  rules.push(...ast.stylesheet.rules);
}

function computeCSS(element) {
  // 每次有 style 属性进来时，应该要触发一次重新计算
  // 我们这里 style 是在 html 和 head 之后，但是它们一般没有 CSS 就不做处理了。

  if (!element.computedStyle) element.computedStyle = {};

  for (let rule of rules) {
    let selectorParts = rule.selectors[0].split(" ").reverse();

    if (!match(element, selectorParts[0])) continue;

    let i = 1;
    let curr = element.parent;
    let matched = false;
    while (curr) {
      if (match(curr, selectorParts[i])) i++;
      curr = curr.parent;
    }
    if (i >= selectorParts.length) matched = true;

    if (matched) {
      let sp = getSpecificity(rule.selectors[0]);
      let computedStyle = element.computedStyle;
      for (let declaration of rule.declarations) {
        if (!computedStyle[declaration.property]) {
          computedStyle[declaration.property] = {};
        }
        if (
          !computedStyle[declaration.property].specificity ||
          compare(computedStyle[declaration.property].specificity, sp) < 0
        ) {
          computedStyle[declaration.property].value = declaration.value;
          computedStyle[declaration.property].specificity = sp;
        }
      }
    }
  }
}

function match(element, compoundSelector) {
  if (!compoundSelector || !element.attributes) return false;

  // ?= 是一个零宽断言，会找匹配字符的前面零宽的位置
  // 以 . 或则 # 将复合选择器切开
  let selectors = compoundSelector.split(/(?=[.#])/);

  let matched = false;
  for (let selector of selectors) {
    // 处理简单选择器，这里只处理 class、id、tag 选择器
    if (selector.charAt(0) === "#") {
      let attr = element.attributes.filter((attr) => attr.name === "id")[0];
      if (!attr) return false;

      matched = attr.value === selector.replace("#", "");
    } else if (selector.charAt(0) === ".") {
      let attr = element.attributes.filter((attr) => attr.name === "class")[0];
      if (!attr) return false;

      // 处理 class 用 空格 分开的情况
      let values = attr.value.trim().split(" ");
      for (let val of values) {
        matched = val === selector.replace(".", "");
        if (matched) break;
      }
    } else {
      matched = element.tagName === selector;
    }
  }
  return matched;
}

function getSpecificity(selector) {
  let p = [0, 0, 0, 0];
  let selectorParts = selector.split(" ");
  for (let part of selectorParts) {
    // 处理复合选择器
    let selectors = part.split(/(?=[.#])/);
    for (let se of selectors) {
      if (se.charAt(0) === "#") {
        p[1] += 1;
      } else if (se.charAt(0) === ".") {
        p[2] += 1;
      } else {
        p[3] += 1;
      }
    }
  }
  return p;
}

// 比较优先级
function compare(sp1, sp2) {
  if (sp1[0] - sp2[0]) return sp1[0] - sp2[0];
  if (sp1[1] - sp2[1]) return sp1[1] - sp2[1];
  if (sp1[2] - sp2[2]) return sp1[2] - sp2[2];
  return sp1[3] - sp2[3];
}

module.exports = {
  addCSSRules,
  computeCSS,
};
