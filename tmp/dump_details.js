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
let inaccessibleButtons = [];
let truncatedWithoutTitle = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node) ? node.openingElement.tagName.getText(sourceFile) : node.tagName.getText(sourceFile);
      const attrs = ts.isJsxElement(node) ? node.openingElement.attributes.properties : node.attributes.properties;

      if (tagName === "button") {
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
              fullText: node.getText(sourceFile)
            });
          }
        }
      }

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
        truncatedWithoutTitle.push({
          file: path.relative(".", file),
          line: pos.line + 1,
          tag: tagName,
          fullText: node.getText(sourceFile)
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

fs.writeFileSync("/tmp/audit_details.json", JSON.stringify({ inaccessibleButtons, truncatedWithoutTitle }, null, 2));
console.log("Found buttons:", inaccessibleButtons.length);
console.log("Found truncated:", truncatedWithoutTitle.length);
