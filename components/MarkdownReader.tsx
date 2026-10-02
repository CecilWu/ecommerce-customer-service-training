import type React from "react";

function flushParagraph(blocks: React.ReactNode[], paragraph: string[], key: string) {
  if (!paragraph.length) return;
  blocks.push(
    <p key={key}>
      {paragraph.join(" ")}
    </p>
  );
  paragraph.length = 0;
}

function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function MarkdownReader({ content }: { content: string }) {
  const blocks: React.ReactNode[] = [];
  const paragraph: string[] = [];
  const lines = content.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(blocks, paragraph, `p-${index}`);
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph(blocks, paragraph, `p-${index}`);
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push(<pre key={`code-${index}`}><code>{code.join("\n")}</code></pre>);
      index += 1;
      continue;
    }

    if (trimmed === "---") {
      flushParagraph(blocks, paragraph, `p-${index}`);
      blocks.push(<hr key={`hr-${index}`} />);
      index += 1;
      continue;
    }

    if (trimmed.startsWith("|")) {
      flushParagraph(blocks, paragraph, `p-${index}`);
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        const cells = lines[index].trim().split("|").slice(1, -1).map((cell) => cell.trim());
        if (!cells.every((cell) => /^-+$/.test(cell.replace(/:/g, "")))) rows.push(cells);
        index += 1;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div className="markdown-table-wrap" key={`table-${index}`}>
          <table>
            {head ? (
              <thead>
                <tr>{head.map((cell, cellIndex) => <th key={`${cell}-${cellIndex}`}>{renderInlineCode(cell)}</th>)}</tr>
              </thead>
            ) : null}
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{renderInlineCode(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(blocks, paragraph, `p-${index}`);
      const level = heading[1].length;
      const text = heading[2];
      if (level === 1) blocks.push(<h1 key={`h-${index}`}>{text}</h1>);
      else if (level === 2) blocks.push(<h2 key={`h-${index}`}>{text}</h2>);
      else if (level === 3) blocks.push(<h3 key={`h-${index}`}>{text}</h3>);
      else blocks.push(<h4 key={`h-${index}`}>{text}</h4>);
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph(blocks, paragraph, `p-${index}`);
      blocks.push(<blockquote key={`quote-${index}`}>{renderInlineCode(trimmed.replace(/^>\s?/, ""))}</blockquote>);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph(blocks, paragraph, `p-${index}`);
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item) => <li key={item}>{renderInlineCode(item)}</li>)}
        </ul>
      );
      continue;
    }

    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph(blocks, paragraph, "p-last");
  return <article className="markdown-reader">{blocks}</article>;
}
