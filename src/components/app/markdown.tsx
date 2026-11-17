import * as React from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { shotSrc } from "@/api/client";
import remarkGfm from "remark-gfm";
import { slug } from "@/core/util";

function text(children: React.ReactNode): string {
  return React.Children.toArray(children).map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : React.isValidElement(c) ? text((c.props as { children?: React.ReactNode }).children) : "")).join("");
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith("shot:") ? url : defaultUrlTransform(url))}
        components={{
          // ![caption](shot:<id>) embeds one of the application's screenshots
          img: ({ src, alt }) => {
            const s = String(src ?? "");
            return <img src={s.startsWith("shot:") ? shotSrc(s.slice(5)) : s} alt={alt ?? ""} loading="lazy" />;
          },
          h1: ({ children }) => <h1 id={slug(text(children))}>{children}</h1>,
          h2: ({ children }) => <h2 id={slug(text(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={slug(text(children))}>{children}</h3>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

export function tocOf(source: string) {
  const out: { level: number; text: string; id: string }[] = [];
  let fenced = false;
  for (const line of source.split("\n")) {
    if (line.trim().startsWith("```")) fenced = !fenced;
    if (fenced) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*$/);
    if (m) {
      const t = m[2]!.replace(/[*_`[\]]/g, "");
      out.push({ level: m[1]!.length, text: t, id: slug(t) });
    }
  }
  return out;
}

/** Very small HTML → Markdown converter for pasted/imported HTML documents. */
export function htmlToMarkdown(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/\s+/g, " ");
    if (!(node instanceof HTMLElement)) return "";
    const inner = [...node.childNodes].map(walk).join("");
    switch (node.tagName) {
      case "H1": return `\n# ${inner.trim()}\n\n`;
      case "H2": return `\n## ${inner.trim()}\n\n`;
      case "H3": case "H4": case "H5": case "H6": return `\n### ${inner.trim()}\n\n`;
      case "P": case "DIV": case "SECTION": case "ARTICLE": return `\n${inner.trim()}\n\n`;
      case "BR": return "  \n";
      case "STRONG": case "B": return `**${inner}**`;
      case "EM": case "I": return `*${inner}*`;
      case "CODE": return `\`${inner}\``;
      case "PRE": return `\n\`\`\`\n${node.textContent}\n\`\`\`\n\n`;
      case "A": return `[${inner}](${node.getAttribute("href") ?? ""})`;
      case "IMG": return `![${node.getAttribute("alt") ?? ""}](${node.getAttribute("src") ?? ""})`;
      case "LI": return `- ${inner.trim()}\n`;
      case "UL": case "OL": return `\n${inner}\n`;
      case "TR": return `| ${[...node.children].map((c) => walk(c).trim()).join(" | ")} |\n`;
      case "TABLE": {
        const rows = [...node.querySelectorAll("tr")].map((tr) => `| ${[...tr.children].map((c) => walk(c).trim()).join(" | ")} |`);
        if (!rows.length) return "";
        const cols = node.querySelector("tr")?.children.length ?? 1;
        return `\n${rows[0]}\n| ${Array(cols).fill("---").join(" | ")} |\n${rows.slice(1).join("\n")}\n\n`;
      }
      case "SCRIPT": case "STYLE": case "HEAD": return "";
      default: return inner;
    }
  };
  return walk(doc.body).replace(/\n{3,}/g, "\n\n").trim();
}
