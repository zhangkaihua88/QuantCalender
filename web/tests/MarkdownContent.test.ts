import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/markdown'

describe('safe important item markdown', () => {
  it('renders the supported basic formatting and secure HTTPS links', () => {
    const html = renderMarkdown('## 标题\n\n**重点**\n\n- 第一项\n- [资料](https://example.com/guide)')
    expect(html).toContain('<h2>标题</h2>')
    expect(html).toContain('<strong>重点</strong>')
    expect(html).toContain('<ul>')
    expect(html).toContain('href="https://example.com/guide"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('does not create dangerous HTML, images or unsafe links', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n[危险](javascript:alert(1))\n\n![图片](https://example.com/a.png)')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('href="javascript:')
  })
})
