function layout(element) {
  if (!element.computedStyle) return;

  let elementStyle = getStyle(element);

  // 只处理 flex 布局，不符合的就当中不存在
  if (elementStyle.display !== "flex") return;

  // 只处理 element，丢弃文本节点
  let items = element.children.filter((e) => e.type === "element");

  // 根据 order 可以对元素进行排序，不过现在没有用到
  items.sort((a, b) => {
    return (a.order || 0) - (b.order || 0);
  });

  //------------------------- 初始化 ---------------------------------/

  // 处理 width 或者 height 没有写值的情况，一般是会将父元素撑开刚好包裹所有子元素
  ["width", "height"].forEach((size) => {
    if (elementStyle[size] === "auto" || elementStyle[size] === "") {
      elementStyle[size] === null;
    }
  });

  if (!elementStyle.flexDirection || elementStyle.flexDirection === "auto") {
    elementStyle.flexDirection = "row";
  }
  if (!elementStyle.alignItems || elementStyle.alignItems === "auto") {
    elementStyle.alignItems = "stretch";
  }
  if (!elementStyle.justifyContent || elementStyle.justifyContent === "auto") {
    elementStyle.justifyContent = "flex-start";
  }
  if (!elementStyle.flexWrap || elementStyle.flexWrap === "auto") {
    elementStyle.flexWrap = "nowrap";
  }
  if (!elementStyle.alignContent || elementStyle.alignContent === "auto") {
    elementStyle.alignContent = "stretch";
  }

  // 将容器的 width、height、left、right、top、bottom 抽象成「主轴」和「交叉轴」
  let mainSize, mainStart, mainEnd, mainSign, mainBase;
  let crossSize, crossStart, crossEnd, crossSign, crossBase;
  if (elementStyle.flexDirection === "row") {
    mainSize = "width";
    mainStart = "left";
    mainEnd = "right";
    mainSign = +1; // 方向抽象成数值，便于计算
    mainBase = 0;

    crossSize = "height";
    crossStart = "top";
    crossEnd = "bottom";
  } else if (elementStyle.flexDirection === "row-reverse") {
    mainSize = "width";
    mainStart = "right";
    mainEnd = "left";
    mainSign = -1; // 方向抽象成数值，便于计算
    mainBase = elementStyle.width;

    crossSize = "height";
    crossStart = "top";
    crossEnd = "bottom";
  } else if (elementStyle.flexDirection === "column") {
    mainSize = "height";
    mainStart = "top";
    mainEnd = "bottom";
    mainSign = +1; // 方向抽象成数值，便于计算
    mainBase = 0;

    crossSize = "width";
    crossStart = "left";
    crossEnd = "right";
  } else if (elementStyle.flexDirection === "row-reverse") {
    mainSize = "height";
    mainStart = "bottom";
    mainEnd = "top";
    mainSign = -1; // 方向抽象成数值，便于计算
    mainBase = elementStyle.height;

    crossSize = "width";
    crossStart = "left";
    crossEnd = "right";
  }

  if (elementStyle.flexWrap === "wrap-reverse") {
    [crossStart, crossEnd] = [crossEnd, crossStart];
    crossSign = -1;
  } else {
    crossBase = 0;
    crossSign = +1;
  }

  //------------------------- 将元素收进行内 ---------------------------------/
  // auto sizing
  let isAutoMainSize = false;
  if (!elementStyle[mainSize]) {
    elementStyle[mainSize] = 0;
    for (let item of items) {
      let itemStyle = getStyle(item);
      if (itemStyle[mainSize] !== null && itemStyle[mainSize] !== void 0) {
        elementStyle[mainSize] += itemStyle[mainSize];
      }
    }
    isAutoMainSize = true;
  }

  let flexLine = []; // flex 的一行
  let flexLines = [flexLine]; // flex 的所有行

  // 主轴剩余空间
  let mainSpace = elementStyle[mainSize];
  // 交叉轴剩余空间
  let crossSpace = 0;

  let flexTotal = 0;
  for (let item of items) {
    // 给子元素设置 style
    let itemStyle = getStyle(item);

    if (itemStyle.flex) {
      flexTotal += itemStyle.flex;
      flexLine.push(item); // 子元素有 flex 要单独处理
    } else if (elementStyle.flexWrap === "nowrap" || isAutoMainSize) {
      mainSpace -= itemStyle[mainSize];
      if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== void 0) {
        crossSpace = Math.max(crossSpace, itemStyle[crossSize]); // 取子元素交叉轴中最大的值
      }
      flexLine.push(item);
    } else {
      // 如果子元素的主轴比父元素的主轴还长，就将子元素强制改为与父元素一样长
      if (itemStyle[mainSize] > elementStyle[mainSize]) {
        itemStyle[mainSize] = elementStyle[mainSize];
      }
      // 当前行被放满了，就换行
      if (itemStyle[mainSize] > mainSpace) {
        flexLine.mainSpace = mainSpace;
        flexLine.crossSpace = crossSpace;

        flexLine = [item];
        flexLines.push(flexLine);

        mainSpace = elementStyle[mainSize];
        crossSpace = 0;
      } else {
        flexLine.push(item);
      }
      if (itemStyle[crossSpace] !== null && itemStyle[crossSpace] !== void 0) {
        crossSpace = Math.max(crossSpace, itemStyle[crossSpace]);
      }
      mainSpace -= itemStyle[mainSize];
    }
  }
  flexLine.flexTotal = flexTotal;
  flexLine.mainSpace = mainSpace;
  if (elementStyle.flexWrap === "nowrap" || isAutoMainSize) {
    // 交叉轴有尺寸就直接使用，没有就用子元素中最大的
    flexLine.crossSpace =
      elementStyle[crossSize] !== void 0 ? elementStyle[crossSize] : crossSpace;
  } else {
    flexLine.crossSpace = crossSpace;
  }

  //------------------------- 计算主轴 ---------------------------------/
  flexLines.forEach((line) => {
    let lineMainSpace = Math.max(line.mainSpace, 0); // 处理掉剩余空间为负数
    let currentMainStart = mainBase;
    let gap = 0;
    if (line.flexTotal === 0) {
      if (element.style.justifyContent === "flex-end") {
        currentMainStart = mainBase;
        gap = 0;
      } else if (element.style.justifyContent === "flex-end") {
        currentMainStart = mainBase + mainSign * lineMainSpace;
        gap = 0;
      } else if (element.style.justifyContent === "center") {
        currentMainStart = mainBase + mainSign * (lineMainSpace / 2);
        gap = 0;
      } else if (element.style.justifyContent === "space-between") {
        currentMainStart = mainBase;
        gap = mainSign * (lineMainSpace / (line.length - 1));
      } else if (element.style.justifyContent === "space-around") {
        gap = mainSign * (lineMainSpace / line.length);
        currentMainStart = mainBase + gap / 2;
      }
    }
    const scale = Math.min(
      elementStyle[mainSize] / (elementStyle[mainSize] - mainSpace),
      1
    );
    // 计算容器内所有子元素的主轴尺寸
    line.forEach((item) => {
      // 有 flex
      if (item.style.flex) {
        item.style[mainSize] =
          (lineMainSpace * item.style.flex) / line.flexTotal;
      } else {
        item.style[mainSize] *= scale;
      }
      item.style[mainStart] = currentMainStart;
      item.style[mainEnd] =
        item.style[mainStart] + mainSign * item.style[mainSize];
      currentMainStart = item.style[mainEnd] + gap;
    });
  });

  //------------------------- 计算交叉轴 --------------------------------/
  if (!elementStyle[crossSize]) {
    crossSpace = 0;
    elementStyle[crossSize] = 0;
    for (let i = 0; i < flexLines.length; i++) {
      elementStyle[crossSize] =
        elementStyle[crossSize] + flexLines[i].crossSpace;
    }
  } else {
    crossSpace = elementStyle[crossSize];
    for (let i = 0; i < flexLines.length; i++) {
      crossSpace -= flexLines[i].crossSpace;
    }
  }

  if (elementStyle.flexWrap === "wrap-reverse") {
    crossBase = elementStyle[crossSize];
  } else {
    crossBase = 0;
  }

  let gap = 0;
  if (elementStyle.alignContent === "flex-start") {
    crossBase += 0;
    gap = 0;
  } else if (elementStyle.alignContent === "flex-end") {
    crossBase += crossSign * crossSpace;
    gap = 0;
  } else if (elementStyle.alignContent === "center") {
    crossBase += crossSign * (crossSpace / 2);
    gap = 0;
  } else if (elementStyle.alignContent === "space-between") {
    crossBase += 0;
    gap = crossSign * (crossSpace / (flexLines.length - 1));
  } else if (elementStyle.alignContent === "space-around") {
    gap = crossSpace / flexLines.length;
    crossBase += crossSign * (gap / 2);
  } else if (elementStyle.alignContent === "stretch") {
    crossBase += 0;
    gap = 0;
  }

  flexLines.forEach((line) => {
    let lineCrossSize =
      elementStyle.alignContent === "stretch"
        ? line.crossSpace + crossSpace / flexLines.length
        : line.crossSpace;
    line.forEach((item) => {
      // 子元素的 alignSelf 会覆盖父元素的 alignItems
      let itemAlign = item.style.alignSelf || elementStyle.alignItems;

      if (!item.style[crossSize]) {
        item.style[crossSize] = itemAlign === "stretch" ? lineCrossSize : 0;
      }

      if (itemAlign === "flex-start") {
        item.style[crossStart] = crossBase;
        item.style[crossEnd] =
          item.style[crossStart] + crossSign * item.style[mainSize];
      } else if (itemAlign === "flex-end") {
        item.style[crossEnd] = crossBase + crossSign * lineCrossSize;
        item.style[crossStart] =
          item.style[crossEnd] - crossSign * item.style[crossSize];
      } else if (itemAlign === "center") {
        item.style[crossStart] =
          crossBase + crossSign * ((lineCrossSize - item.style[crossSize]) / 2);
        item.style[crossEnd] =
          item.style[crossStart] + crossSign * (item.style[crossSize] / 2);
      } else if (itemAlign === "stretch") {
        item.style[crossStart] = crossBase;
        item.style[crossEnd] =
          crossBase +
          crossSign *
            (item.style[crossSize] ? item.style[crossSize] : lineCrossSize);
        item.style[crossSize] =
          crossSign * (item.style[crossEnd] - item.style[crossStart]);
      }
    });
    crossBase += crossSign * (lineCrossSize + gap);
  });
}

function getStyle(element) {
  if (!element.style) element.style = {};

  for (let prop in element.computedStyle) {
    // 抄属性
    element.style[prop] = element.computedStyle[prop].value;

    // 只处理 px 单位
    if (element.style[prop].toString().match(/px$/)) {
      element.style[prop] = parseInt(element.style[prop], 10);
    }

    if (element.style[prop].toString().match(/[0-9\.]+$/)) {
      element.style[prop] = parseInt(element.style[prop], 10);
    }
  }
  return element.style;
}

module.exports = layout;
