import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

const safeMarkdownSchema = {
  ...defaultSchema,
  tagNames: ["p", "strong", "em", "ul", "ol", "li", "br"],
  attributes: {},
};

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

export function SafeMarkdown({ content, className }: SafeMarkdownProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <ReactMarkdown
        rehypePlugins={[[rehypeSanitize, safeMarkdownSchema]]}
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          em: ({ children }) => <em>{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-5 space-y-1.5 my-3">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-5 space-y-1.5 my-3">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
