import { describe, expect, it, vi } from 'vitest'
import { createApiMiddlewareRunner } from '../../src/middleware'

describe('api middleware runner', () => {
  it('runs request/response/error middlewares in registration order', async () => {
    const runner = createApiMiddlewareRunner()
    const calls: string[] = []

    runner.add({
      onRequest: () => {
        calls.push('m1:req')
      },
      onResponse: () => {
        calls.push('m1:res')
      },
      onError: () => {
        calls.push('m1:err')
      },
    })

    runner.add({
      onRequest: () => {
        calls.push('m2:req')
      },
      onResponse: () => {
        calls.push('m2:res')
      },
      onError: () => {
        calls.push('m2:err')
      },
    })

    const requestContext = { url: '/x', init: { method: 'GET' } }
    await runner.runRequest(requestContext)
    await runner.runResponse({ ...requestContext, response: new Response(null, { status: 204 }) })
    await runner.runError({ ...requestContext, error: new Error('boom') })

    expect(calls).toEqual(['m1:req', 'm2:req', 'm1:res', 'm2:res', 'm1:err', 'm2:err'])
  })

  it('unsubscribe returned by add removes middleware', async () => {
    const runner = createApiMiddlewareRunner()
    const spy = vi.fn()

    const unsubscribe = runner.add({ onRequest: spy })
    unsubscribe()

    await runner.runRequest({ url: '/x', init: { method: 'GET' } })
    expect(spy).not.toHaveBeenCalled()
  })

  it('replaceAll swaps middleware set', async () => {
    const runner = createApiMiddlewareRunner()
    const first = vi.fn()
    const second = vi.fn()

    runner.add({ onRequest: first })
    runner.replaceAll([{ onRequest: second }])

    await runner.runRequest({ url: '/x', init: { method: 'GET' } })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
