import type { ApiMiddleware } from '../middleware'
import { createApiMiddlewareRunner } from '../middleware'
import {
  createRequestContext,
  parseResponseBody,
  toApiResponseError,
  toNetworkApiError,
  type RequestOptions,
} from '../lib/api-helpers'

interface CreateApiRequestExecutorInput {
  apiBaseUrl: string
  timeoutMs: number
  getAccessToken: () => string | null
}

export interface ApiRequestExecutor {
  execute<T>(path: string, options: RequestOptions): Promise<T>
  addMiddleware(middleware: ApiMiddleware): () => void
  setMiddlewares(middlewares: ApiMiddleware[]): void
}

export function createApiRequestExecutor({
  apiBaseUrl,
  timeoutMs,
  getAccessToken,
}: CreateApiRequestExecutorInput): ApiRequestExecutor {
  const middlewareRunner = createApiMiddlewareRunner()

  const emitErrorToMiddlewares = async (
    requestContext: { url: string; init: RequestInit },
    error: unknown,
  ) => {
    await middlewareRunner.runError({
      url: requestContext.url,
      init: requestContext.init,
      error,
    })
  }

  const execute = async <T>(path: string, options: RequestOptions): Promise<T> => {
    const requestContext = createRequestContext({
      accessToken: getAccessToken(),
      apiBaseUrl,
      path,
      options,
      timeoutMs,
    })

    await middlewareRunner.runRequest(requestContext)

    let response: Response
    try {
      response = await fetch(requestContext.url, requestContext.init)
    } catch (error) {
      await emitErrorToMiddlewares(requestContext, error)
      throw toNetworkApiError(error)
    }

    await middlewareRunner.runResponse({ url: requestContext.url, init: requestContext.init, response })

    if (response.status === 204) return undefined as T
    if (!response.ok) {
      const error = await toApiResponseError(response)
      await emitErrorToMiddlewares(requestContext, error)
      throw error
    }

    const data = await parseResponseBody(response)
    return data as T
  }

  return {
    execute,
    addMiddleware(middleware) {
      return middlewareRunner.add(middleware)
    },
    setMiddlewares(middlewares) {
      middlewareRunner.replaceAll(middlewares)
    },
  }
}
