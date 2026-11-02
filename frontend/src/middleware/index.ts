export interface ApiRequestContext {
  url: string
  init: RequestInit
}

export interface ApiErrorContext {
  url: string
  init: RequestInit
  error: unknown
}

export interface ApiResponseContext {
  url: string
  init: RequestInit
  response: Response
}

export interface ApiMiddleware {
  onRequest?(context: ApiRequestContext): void | Promise<void>
  onResponse?(context: ApiResponseContext): void | Promise<void>
  onError?(context: ApiErrorContext): void | Promise<void>
}

export interface ApiMiddlewareRunner {
  add(middleware: ApiMiddleware): () => void
  replaceAll(middlewares: ApiMiddleware[]): void
  runRequest(context: ApiRequestContext): Promise<void>
  runResponse(context: ApiResponseContext): Promise<void>
  runError(context: ApiErrorContext): Promise<void>
}

export function createApiMiddlewareRunner(): ApiMiddlewareRunner {
  const middlewares: ApiMiddleware[] = []

  return {
    add(middleware) {
      middlewares.push(middleware)
      return () => {
        const index = middlewares.indexOf(middleware)
        if (index >= 0) middlewares.splice(index, 1)
      }
    },

    replaceAll(nextMiddlewares) {
      middlewares.splice(0, middlewares.length, ...nextMiddlewares)
    },

    async runRequest(context) {
      for (const middleware of middlewares) {
        await middleware.onRequest?.(context)
      }
    },

    async runResponse(context) {
      for (const middleware of middlewares) {
        await middleware.onResponse?.(context)
      }
    },

    async runError(context) {
      for (const middleware of middlewares) {
        await middleware.onError?.(context)
      }
    },
  }
}
