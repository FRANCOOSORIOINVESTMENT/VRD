const ts = require("typescript");
const fs = require("fs");
const path = require("path");

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (full.endsWith(".tsx")) files.push(full);
  }
  return files;
}

const files = walk("src");
let totalButtons = 0;
let inaccessibleButtons = [];
let inputsWithoutLabel = [];
let fileInputsWithoutLabel = [];
let contrastIssues = [];
let truncatedWithoutTitle = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node) ? node.openingElement.tagName.getText(sourceFile) : node.tagName.getText(sourceFile);
      const attrs = ts.isJsxElement(node) ? node.openingElement.attributes.properties : node.attributes.properties;

      if (tagName === "button") {
        totalButtons++;
        let hasAriaLabel = false;
        let hasTitle = false;
        for (const attr of attrs) {
          if (ts.isJsxAttribute(attr)) {
            const attrName = attr.name.getText(sourceFile);
            if (attrName === "aria-label") hasAriaLabel = true;
            if (attrName === "title") hasTitle = true;
          }
        }

        if (ts.isJsxElement(node)) {
          let hasTextChild = false;
          for (const child of node.children) {
            if (ts.isJsxText(child)) {
              if (child.getText(sourceFile).trim().length > 0) hasTextChild = true;
            } else if (ts.isJsxExpression(child) && child.expression) {
              const expText = child.expression.getText(sourceFile).trim();
              if (!expText.startsWith("<")) hasTextChild = true;
            } else if (ts.isJsxElement(child)) {
              const childTag = child.openingElement.tagName.getText(sourceFile);
              if (childTag === "span" || childTag === "p" || childTag === "div") {
                const inner = child.getText(sourceFile).replace(/<[^>]+>/g, "").trim();
                if (inner.length > 0) hasTextChild = true;
              }
            }
          }
          if (!hasTextChild && !hasAriaLabel && !hasTitle) {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            inaccessibleButtons.push({
              file: path.relative(".", file),
              line: pos.line + 1,
              tag: node.openingElement.getText(sourceFile).replace(/\s+/g, " ")
            });
          }
        }
      }

      if (tagName === "input") {
        let hasId = false;
        let hasAria = false;
        let hasTitle = false;
        let type = "text";
        let isHidden = false;
        for (const attr of attrs) {
          if (ts.isJsxAttribute(attr)) {
            const attrName = attr.name.getText(sourceFile);
            if (attrName === "id") hasId = true;
            if (attrName.startsWith("aria-")) hasAria = true;
            if (attrName === "title") hasTitle = true;
            if (attrName === "type" && attr.initializer) type = attr.initializer.getText(sourceFile).replace(/["'`]/g, "");
            if (attrName === "className" && attr.initializer) {
              const cName = attr.initializer.getText(sourceFile);
              if (cName.includes("hidden")) isHidden = true;
            }
          }
        }
        if (!hasId && !hasAria && !hasTitle) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          if (type === "file" && isHidden) {
            fileInputsWithoutLabel.push({ file: path.relative(".", file), line: pos.line + 1 });
          } else if (type !== "hidden") {
            inputsWithoutLabel.push({ file: path.relative(".", file), line: pos.line + 1, type });
          }
        }
      }

      // Check truncate without title
      let hasTruncate = false;
      let hasTitleAttr = false;
      for (const attr of attrs) {
        if (ts.isJsxAttribute(attr)) {
          const attrName = attr.name.getText(sourceFile);
          if (attrName === "className" && attr.initializer && attr.initializer.getText(sourceFile).includes("truncate")) {
            hasTruncate = true;
          }
          if (attrName === "title") hasTitleAttr = true;
        }
      }
      if (hasTruncate && !hasTitleAttr) {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        truncatedWithoutTitle.push({ file: path.relative(".", file), line: pos.line + 1, tag: tagName });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

console.log("=== RESUMEN AUDITORÍA AST ===");
console.log("Total botones analizados:", totalButtons);
console.log("Botones sin nombre accesible (sin aria-label, sin title, sin texto):", inaccessibleButtons.length);
inaccessibleButtons.slice(0, 15).forEach(b => console.log(`  ${b.file}:${b.line} -> ${b.tag.slice(0, 70)}`));
console.log("Inputs visibles sin id / aria-label / title:", inputsWithoutLabel.length);
inputsWithoutLabel.slice(0, 10).forEach(i => console.log(`  ${i.file}:${i.line} (type=${i.type})`));
console.log("Inputs type=file ocultos sin id (imposible vincular por label htmlFor):", fileInputsWithoutLabel.length);
fileInputsWithoutLabel.slice(0, 5).forEach(i => console.log(`  ${i.file}:${i.line}`));
console.log("Elementos con truncate sin atributo title (texto cortado inaccesible):", truncatedWithoutTitle.length);
