import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: true,
  typographer: false
})

markdown.validateLink = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

markdown.renderer.rules.link_open = (tokens, index, options, environment, self) => {
  tokens[index]!.attrSet('target', '_blank')
  tokens[index]!.attrSet('rel', 'noopener noreferrer')
  return self.renderToken(tokens, index, options)
}

markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index]!.content)

const ALLOWED_TAGS = ['p', 'br', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'code', 'a']

export function renderMarkdown(value: string): string {
  return DOMPurify.sanitize(markdown.render(value || ''), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false
  })
}
