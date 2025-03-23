// code.js

// 플러그인 UI 창 설정
figma.showUI(__html__, { width: 450, height: 550 });

// 선택 항목 변경 시 이벤트 처리
figma.on("selectionchange", () => {
  updateSelection();
});

// 현재 선택된 항목 정보 업데이트
function updateSelection() {
  const selection = figma.currentPage.selection;
  if (selection.length > 0) {
    // 선택된 항목의 정보 추출 (재귀적으로 하위 컴포넌트 포함)
    const componentData = extractComponentData(selection[0]);
    
    // UI로 데이터 전송
    figma.ui.postMessage({
      type: "selection-updated",
      data: componentData
    });
  } else {
    // 선택된 항목이 없을 때
    figma.ui.postMessage({
      type: "no-selection"
    });
  }
}

// 컴포넌트 데이터 추출 함수 (재귀적으로 하위 컴포넌트 포함)
function extractComponentData(node) {
  try {
    // 기본 컴포넌트 정보
    const componentInfo = {
      id: node.id || "",
      name: node.name || "",
      type: node.type || "",
      css: extractCssProperties(node)
    };
    
    // 컴포넌트 속성 정보 추가 (있을 경우)
    if (node.componentProperties) {
      componentInfo.properties = {};
      
      // 객체를 안전하게 복사
      Object.keys(node.componentProperties).forEach(key => {
        try {
          const prop = node.componentProperties[key];
          componentInfo.properties[key] = {
            type: prop.type,
            value: prop.value
          };
        } catch (e) {
          console.log("속성 처리 오류", e);
        }
      });
    }

    // 텍스트 노드인 경우 텍스트 정보 추가 (있을 경우)
    if (node.type === "TEXT") {
      componentInfo.text = { content: node.characters || "" };
      // 텍스트 스타일 정보 추가 (있을 경우)
      if (node.textStyleId) {
        const style = figma.getStyleById(node.textStyleId);
        if (style) {
          componentInfo.text.style = style.name;
        }
      }
    }

    // 이미지 노드인 경우 이미지 정보 추가 (있을 경우)
    if (node.type === "IMAGE") {
      componentInfo.image = {
        url: node.fills[0].imageHash || "",
        width: node.width || 0,
        height: node.height || 0
      };
    }
    
    // 하위 컴포넌트 처리 (재귀적)
    if (node.children && node.children.length > 0) {
      componentInfo.children = [];
      
      // 각 자식 노드에 대해 재귀적으로 처리
      for (const childNode of node.children) {
        try {
          const childData = extractComponentData(childNode);
          componentInfo.children.push(childData);
        } catch (e) {
          console.error("자식 노드 처리 오류:", e);
          // 오류가 있어도 기본 정보 추가
          componentInfo.children.push({
            id: childNode.id || "",
            name: childNode.name || "Unknown",
            type: childNode.type || "",
            error: "처리 실패"
          });
        }
      }
    }
    
    return componentInfo;
  } catch (error) {
    console.error("컴포넌트 데이터 추출 오류:", error);
    return {
      id: node.id || "",
      name: node.name || "",
      type: node.type || "",
      error: "데이터 추출 중 오류가 발생했습니다",
      css: {}
    };
  }
}

// CSS 속성 추출 함수
function extractCssProperties(node) {
  try {
    const css = {};
    
    // 1. 레이아웃 속성 (Auto Layout)
    if (node.layoutMode) {
      css["display"] = "flex";
      
      // 방향
      css["flex-direction"] = node.layoutMode === "HORIZONTAL" ? "row" : "column";
      
      // 주축 정렬
      if (node.primaryAxisAlignItems) {
        const alignMap = {
          "MIN": "flex-start",
          "CENTER": "center",
          "MAX": "flex-end",
          "SPACE_BETWEEN": "space-between"
        };
        css["justify-content"] = alignMap[node.primaryAxisAlignItems] || "flex-start";
      }
      
      // 교차축 정렬
      if (node.counterAxisAlignItems) {
        const alignMap = {
          "MIN": "flex-start",
          "CENTER": "center",
          "MAX": "flex-end"
        };
        css["align-items"] = alignMap[node.counterAxisAlignItems] || "flex-start";
      }
      
      // 간격
      if (typeof node.itemSpacing === "number") {
        css["gap"] = processVariableProperty(node, "itemSpacing", `${node.itemSpacing}px`);
      }
      
      // 자기 자신 정렬
      if (node.layoutAlign) {
        const selfAlignMap = {
          "MIN": "flex-start",
          "CENTER": "center",
          "MAX": "flex-end",
          "STRETCH": "stretch"
        };
        css["align-self"] = selfAlignMap[node.layoutAlign] || "auto";
      }
    }
    
    // 2. 크기 속성
    if (typeof node.width === "number") {
      css["width"] = processVariableProperty(node, "width", `${node.width}px`);
    }
    
    if (node.layoutGrow > 0) {
      css["flex-grow"] = node.layoutGrow;
    }
    
    if (typeof node.height === "number") {
      css["height"] = processVariableProperty(node, "height", `${node.height}px`);
    }
    
    // 최소 크기 설정 확인
    if (typeof node.minWidth === "number") {
      css["min-width"] = processVariableProperty(node, "minWidth", `${node.minWidth}px`);
    }
    
    if (typeof node.minHeight === "number") {
      css["min-height"] = processVariableProperty(node, "minHeight", `${node.minHeight}px`);
    }
    
    // 최대 크기 설정 확인
    if (typeof node.maxWidth === "number") {
      css["max-width"] = processVariableProperty(node, "maxWidth", `${node.maxWidth}px`);
    }
    
    if (typeof node.maxHeight === "number") {
      css["max-height"] = processVariableProperty(node, "maxHeight", `${node.maxHeight}px`);
    }
    
    // 3. 패딩 속성
    const hasPadding = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]
      .some(prop => typeof node[prop] === "number");
    
    if (hasPadding) {
      const top = processVariableProperty(node, "paddingTop", 
        typeof node.paddingTop === "number" ? `${node.paddingTop}px` : "0px");
      const right = processVariableProperty(node, "paddingRight", 
        typeof node.paddingRight === "number" ? `${node.paddingRight}px` : "0px");
      const bottom = processVariableProperty(node, "paddingBottom", 
        typeof node.paddingBottom === "number" ? `${node.paddingBottom}px` : "0px");
      const left = processVariableProperty(node, "paddingLeft", 
        typeof node.paddingLeft === "number" ? `${node.paddingLeft}px` : "0px");
      
      // 모든 방향 패딩이 같은 경우 축약
      if (top === right && right === bottom && bottom === left) {
        css["padding"] = top;
      }
      // 상하/좌우 패딩이 같은 경우 축약
      else if (top === bottom && right === left) {
        css["padding"] = `${top} ${right}`;
      }
      // 개별 지정
      else {
        css["padding"] = `${top} ${right} ${bottom} ${left}`;
      }
    }
    
    // 4. 테두리 속성
    if (typeof node.cornerRadius === "number" && node.cornerRadius > 0) {
      css["border-radius"] = processVariableProperty(node, "cornerRadius", `${node.cornerRadius}px`);
    }
    
    // 5. 테두리(Border) 속성 처리 추가
    if (node.strokes && Array.isArray(node.strokes) && node.strokes.length > 0) {
      for (const stroke of node.strokes) {
        if (stroke.visible !== false) {
          // 테두리 스타일 (실선, 점선 등)
          if (node.strokeDashes && node.strokeDashes.length > 0) {
            css["border-style"] = "dashed";
          } else {
            css["border-style"] = "solid";
          }
          
          // 테두리 두께
          if (typeof node.strokeWeight === "number") {
            css["border-width"] = processVariableProperty(node, "strokeWeight", `${node.strokeWeight}px`);
          }
          
          // 테두리 색상
          if (stroke.type === "SOLID") {
            const color = stroke.color || {};
            const r = Math.round((color.r || 0) * 255);
            const g = Math.round((color.g || 0) * 255);
            const b = Math.round((color.b || 0) * 255);
            const a = stroke.opacity || 1;
            
            css["border-color"] = `rgba(${r}, ${g}, ${b}, ${a})`;
          }
          
          // 테두리 위치 (내부, 중앙, 외부)
          if (node.strokeAlign) {
            // 참고용으로 주석으로 추가 (CSS에 직접적으로 대응하는 속성은 없음)
            // css["stroke-align"] = node.strokeAlign.toLowerCase(); // INSIDE, CENTER, OUTSIDE
          }
          
          // 특정 면만 테두리가 있는 경우 처리 (strokeTopWeight, strokeRightWeight 등이 있는 경우)
          if (typeof node.strokeTopWeight === "number") {
            css["border-top-width"] = processVariableProperty(node, "strokeTopWeight", `${node.strokeTopWeight}px`);
          }
          if (typeof node.strokeRightWeight === "number") {
            css["border-right-width"] = processVariableProperty(node, "strokeRightWeight", `${node.strokeRightWeight}px`);
          }
          if (typeof node.strokeBottomWeight === "number") {
            css["border-bottom-width"] = processVariableProperty(node, "strokeBottomWeight", `${node.strokeBottomWeight}px`);
          }
          if (typeof node.strokeLeftWeight === "number") {
            css["border-left-width"] = processVariableProperty(node, "strokeLeftWeight", `${node.strokeLeftWeight}px`);
          }
          
          break; // 첫 번째 유효한 테두리만 처리
        }
      }
    }
    
    // 6. 배경색 처리
    if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
      for (const fill of node.fills) {
        if (fill.type === "SOLID" && fill.visible !== false) {
          // 색상 변환
          const color = fill.color || {};
          const r = Math.round((color.r || 0) * 255);
          const g = Math.round((color.g || 0) * 255);
          const b = Math.round((color.b || 0) * 255);
          const a = fill.opacity || 1;
          
          // 색상 변수 처리 시도
          css["background-color"] = `rgba(${r}, ${g}, ${b}, ${a})`;
          break;
        }
      }
    }
    
    return css;
  } catch (error) {
    console.error("CSS 속성 추출 오류:", error);
    return {}; // 오류 시 빈 객체 반환
  }
}

// 변수 속성 처리 함수
function processVariableProperty(node, propName, defaultValue) {
  try {
    // 바인딩된 변수가 있는지 확인
    if (node.boundVariables && node.boundVariables[propName]) {
      const variableRef = node.boundVariables[propName];
      if (variableRef && variableRef.id) {
        try {
          // 변수 정보 조회
          const variable = figma.variables.getVariableById(variableRef.id);
          if (variable) {
            const variableName = variable.name;
            // 변수 컬렉션 정보 조회
            const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
            if (collection) {
              const collectionName = collection.name;
              // CSS 변수 형식으로 반환
              return `var(--${collectionName}-${variableName}, ${defaultValue})`;
            }
          }
        } catch (e) {
          console.log("변수 정보 조회 오류", e);
        }
      }
    }
    
    // 변수 정보가 없거나 처리 실패 시 기본값 반환
    return defaultValue;
  } catch (error) {
    console.error("변수 속성 처리 오류:", error);
    return defaultValue;
  }
}

// UI에서 오는 메시지 처리
figma.ui.onmessage = (message) => {
  if (message.type === "get-selection") {
    updateSelection();
  } else if (message.type === "close-plugin") {
    figma.closePlugin();
  }
};

// 초기 선택 항목 업데이트
updateSelection();