import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

import { Button, LinkButton, Spinner } from '../../src/design-system'

describe('design-system components', () => {
  it('Button renders variant class and content', () => {
    const html = renderToStaticMarkup(createElement(Button, { variant: 'secondary' }, 'Save'))
    expect(html).toContain('Save')
    expect(html).toContain('border-slate-200')
  })

  it('LinkButton renders as anchor with provided route', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        undefined,
        createElement(LinkButton, { to: '/profile', children: 'Profile' })
      )
    )

    expect(html).toContain('href="/profile"')
    expect(html).toContain('Profile')
  })

  it('Spinner renders loading semantics', () => {
    const html = renderToStaticMarkup(createElement(Spinner))
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-label="Loading"')
  })
})
