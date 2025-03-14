import { marked } from "marked";

export const formatText = (text: string): string => {
  if (text === "") return "";

  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  // Handle custom image dimensions before passing to marked
  text = text.replace(
    /!\[(.*?)\]\((.*?)\){width=(\d+)}/g,
    (_, alt, src, width) => `<img src="${src}" alt="${alt}" width="${width}" />`
  );

  return marked(text) as string;
};

export const formatSpecialFormats = (text: string): string => {
  if (text === "") return "";
  const regexPullquote =
    /(?:<p>)?:::pullquote[A-Za-z]*?\s*([\s\S]*?)\s*:::(?:<\/p>)?/g;
  const regexBlockquote =
    /(?:<p>)?:::blockquote[A-Za-z]*?\s*([\s\S]*?)\s*:::(?:<\/p>)?/g;

  const quotes: { type: string; content: string }[] = [];

  // Extract pullquotes with better whitespace handling
  text = text.replace(regexPullquote, (match, content, offset, string) => {
    quotes.push({ type: "pullquote", content: content.trim() });
    // Check if we need to preserve a newline
    const needsNewline = string[offset + match.length] === "\n" ? "\n" : "";
    return `###PULLQUOTE${quotes.length - 1}###${needsNewline}`;
  });

  // Extract blockquotes with better whitespace handling
  text = text.replace(regexBlockquote, (match, content, offset, string) => {
    quotes.push({ type: "blockquote", content: content.trim() });
    // Check if we need to preserve a newline
    const needsNewline = string[offset + match.length] === "\n" ? "\n" : "";
    return `###BLOCKQUOTE${quotes.length - 1}###${needsNewline}`;
  });

  // Replace quote placeholders with formatted HTML, preserving only necessary whitespace
  quotes.forEach((quote, index) => {
    const formattedContent = formatText(quote.content);
    if (quote.type === "pullquote") {
      text = text.replace(
        `###PULLQUOTE${index}###`,
        `<div class="pullquote">${formattedContent}</div>`
      );
    } else {
      text = text.replace(
        `###BLOCKQUOTE${index}###`,
        `<blockquote>${formattedContent}</blockquote>`
      );
    }
  });

  // Clean up any potential double newlines
  return text.replace(/\n{3,}/g, "\n\n");
};

const insertBody = (body: string) => {
  let formattedContent = formatText(body);
  let contentWithSpecialFormats = formatSpecialFormats(formattedContent);
  // Clean up empty paragraphs with trailing breaks before quotes
  let cleanedHtml = contentWithSpecialFormats.replace(
    /<br\s*class=["']ProseMirror-trailingBreak["']\s*\/?>/g,
    ""
  );
  const editorElement = document.querySelector(".tiptap.ProseMirror");
  if (!editorElement) {
    console.log("TipTap editor not found on this page");
  } else {
    editorElement.innerHTML = cleanedHtml;
  }
};

// class page-title
const inertTitle = (title: string) => {
  const titleElement = document.querySelector(".page-title");
  console.log("titleElement", titleElement);
  if (!titleElement) {
    console.log("Page title not found on this page");
  } else {
    titleElement.innerHTML = title;
  }
};

// class subtitle
const insertSubtitle = (subtitle: string) => {
  const subtitleElement = document.querySelector(".subtitle");
  console.log("subtitleElement", subtitleElement);
  if (!subtitleElement) {
    console.log("Subtitle not found on this page");
  } else {
    subtitleElement.innerHTML = subtitle;
  }
};

export { insertBody, inertTitle, insertSubtitle };
