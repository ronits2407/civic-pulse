import React from 'react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string | null | undefined
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) return null

  // Ensure literal escaped newlines like '\n' are converted to real newlines
  const normalized = content.replace(/\\n/g, '\n')

  return (
    <div
      className={cn(
        'text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium space-y-2 [&_strong]:font-bold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_li]:leading-relaxed [&_p]:leading-relaxed [&_p]:mb-1.5 last:[&_p]:mb-0 [&_a]:text-[#2f3fa8] [&_a]:underline [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-xs [&_h3]:font-bold [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:bg-muted/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono',
        className
      )}
    >
      <ReactMarkdown>{normalized}</ReactMarkdown>
    </div>
  )
}
