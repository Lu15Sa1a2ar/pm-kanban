"use client";

import ReactMarkdown, { type Components } from "react-markdown";

// Assistant text is model output: render a safe Markdown subset only.
// No raw HTML (no rehype-raw), no images, links limited to http(s) in a new tab.
const components: Components = {
  img: () => null,
  a: ({ href, children }) =>
    href && /^https?:\/\//i.test(href) ? (
      <a className="underline" href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  code: ({ children }) => <code className="rounded bg-black/5 px-1">{children}</code>,
};

export const AssistantMessage = ({ content }: { content: string }) => (
  <div className="whitespace-pre-wrap break-words">
    <ReactMarkdown components={components}>{content}</ReactMarkdown>
  </div>
);
