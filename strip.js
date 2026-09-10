#!/usr/bin/env node


const fs = require("fs");
const path = require("path");

const SUPPORTED_EXTS = ["js", "html", "css", "json", "yml", "yaml"];
const SKIP_DIRS = new Set(["node_modules", ".git", ".hg", ".svn"]);








function stripJsLikeComments(src, { allowRegex = true } = {}) {
  let out = "";
  let i = 0;
  const n = src.length;

  
  const REGEX_PRECEDERS = new Set([
    "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";",
    "+", "-", "*", "/", "%", "<", ">", "^", "~", "\n",
  ]);
  const REGEX_KEYWORDS = new Set([
    "return", "typeof", "instanceof", "in", "of", "new", "delete",
    "void", "throw", "case", "do", "else", "yield", "await",
  ]);

  function lastSignificant() {
    
    let j = out.length - 1;
    while (j >= 0 && /\s/.test(out[j])) j--;
    const lastChar = j >= 0 ? out[j] : "\n";
    let k = j;
    while (k >= 0 && /[a-zA-Z_$]/.test(out[k])) k--;
    const word = out.slice(k + 1, j + 1);
    return { lastChar, word };
  }

  while (i < n) {
    const c = src[i];

    
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] || "");
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          out += src[i];
          i++;
          break;
        }
        out += src[i];
        i++;
      }
      continue;
    }

    
    if (c === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < n && src[i] !== "\n") i++;
      continue; 
    }

    
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    
    if (allowRegex && c === "/") {
      const { lastChar, word } = lastSignificant();
      const looksLikeRegex =
        REGEX_PRECEDERS.has(lastChar) || REGEX_KEYWORDS.has(word) || out.trim() === "";

      if (looksLikeRegex) {
        let j = i + 1;
        let inClass = false;
        while (j < n) {
          if (src[j] === "\\") {
            j += 2;
            continue;
          }
          if (src[j] === "[") inClass = true;
          else if (src[j] === "]") inClass = false;
          else if (src[j] === "/" && !inClass) break;
          else if (src[j] === "\n") break; 
          j++;
        }
        if (src[j] === "/") {
          j++;
          while (j < n && /[a-z]/i.test(src[j])) j++; 
          out += src.slice(i, j);
          i = j;
          continue;
        }
      }
    }

    out += c;
    i++;
  }

  return out;
}





function stripCssComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];

    if (c === '"' || c === "'") {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] || "");
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          out += src[i];
          i++;
          break;
        }
        out += src[i];
        i++;
      }
      continue;
    }

    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    out += c;
    i++;
  }

  return out;
}





function stripHtmlComments(src) {
  
  let out = src.replace(/<!--[\s\S]*?-->/g, "");

  
  
  out = out.replace(
    /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (_m, open, body, close) => open + stripJsLikeComments(body) + close,
  );

  out = out.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open, body, close) => open + stripCssComments(body) + close,
  );

  return out;
}






function stripYamlComments(src) {
  const lines = src.split("\n");
  const result = [];

  for (const line of lines) {
    let inSingle = false;
    let inDouble = false;
    let cut = -1;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const prev = i > 0 ? line[i - 1] : "";

      if (inSingle) {
        if (c === "'" && line[i + 1] === "'") {
          i++; 
        } else if (c === "'") {
          inSingle = false;
        }
        continue;
      }

      if (inDouble) {
        if (c === "\\") {
          i++; 
        } else if (c === '"') {
          inDouble = false;
        }
        continue;
      }

      if (c === "'") {
        inSingle = true;
        continue;
      }
      if (c === '"') {
        inDouble = true;
        continue;
      }

      if (c === "#" && (i === 0 || /\s/.test(prev))) {
        cut = i;
        break;
      }
    }

    if (cut === -1) {
      result.push(line);
    } else {
      const wasWholeLineComment = line.slice(0, cut).trim() === "";
      if (wasWholeLineComment) {
        continue; 
      }
      result.push(line.slice(0, cut).replace(/\s+$/, ""));
    }
  }

  return result.join("\n");
}




function stripByExt(ext, content) {
  switch (ext) {
    case "js":
      return stripJsLikeComments(content, { allowRegex: true });
    case "json":
      return stripJsLikeComments(content, { allowRegex: false });
    case "css":
      return stripCssComments(content);
    case "html":
    case "htm":
      return stripHtmlComments(content);
    case "yml":
    case "yaml":
      return stripYamlComments(content);
    default:
      return content;
  }
}

function walk(dir, exts, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), exts, files);
      continue;
    }
    const ext = path.extname(entry.name).slice(1).toLowerCase();
    if (exts.includes(ext)) files.push(path.join(dir, entry.name));
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("--"));

  if (!target) {
    console.error("Usage: node strip-comments.js <path> [--dry-run] [--ext js,css] [--out <dir>]");
    process.exit(1);
  }

  const dryRun = args.includes("--dry-run");

  const extArg = args.find((a) => a.startsWith("--ext="));
  const exts = extArg
    ? extArg.split("=")[1].split(",").map((e) => e.trim().toLowerCase())
    : SUPPORTED_EXTS;

  const outArg = args.find((a) => a.startsWith("--out="));
  const outDir = outArg ? outArg.split("=")[1] : null;

  const stat = fs.statSync(target);
  const files = stat.isDirectory() ? walk(target, exts) : [target];

  let changed = 0;

  for (const file of files) {
    const ext = path.extname(file).slice(1).toLowerCase();
    const original = fs.readFileSync(file, "utf8");
    const stripped = stripByExt(ext, original);

    if (stripped === original) continue;

    changed++;
    console.log(`${dryRun ? "[dry-run] would change" : "stripped"}: ${file}`);

    if (dryRun) continue;

    if (outDir) {
      const rel = path.relative(stat.isDirectory() ? target : path.dirname(target), file);
      const destPath = path.join(outDir, rel);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, stripped, "utf8");
    } else {
      fs.writeFileSync(file, stripped, "utf8");
    }
  }

  console.log(`\n${changed} of ${files.length} file(s) had comments removed.`);
}

main();
