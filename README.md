# call – ein typisierter Fetch-Client mit Retry, Handlern und Progress

Ein dünner, typsicherer HTTP-Client auf Basis von fetch mit:
- konfigurierbaren Retries (Statuscodes, Wildcards, Namen, Network-/Parsing-Errors)
- Status-/Spezial-Handlern inkl. once-Flag (nur am letzten Versuch triggern)
- Progress-API und per-Request onProgress
- Token-Injektion (Bearer), Timeout, Abort, Credentials
- suppressError und returnFields für schlanke Ergebnisse
- TypeScript-first

## Installation
```bash
npm install @doschge/call
# oder
yarn add @doschge/call
```

Schnellstart
```ts
import { createCall } from '@doschge/call'

const call = createCall({
  baseUrl: 'https://api.example.com',
  token: async () => 'my-jwt',
  retry: {
    onStatus: { 500: { attempts: 2 } }, // 2 Wiederholungen bei 500
    methods: ['GET', 'HEAD', 'OPTIONS'],
  },
  on: {
    once: true, // Handler nur am finalen Versuch triggern
    internalServerError: async ({ status, url }) => {
      console.debug('Finaler 500:', status, url)
    },
  },
})

const res = await call.get<{ items: any[] }>('/products', {
  params: { q: 'shoes' },
})
if (!res.ok) throw new Error('Fehler')
console.log(res.content?.items)
```

## Features im Überblick
- ### Retries
    - Policies: onStatus (Code, Name, Wildcards 2xx/4xx/5xx), onNetworkError, onParsingError
    - Exponentieller Backoff (backoffBase), maxDelay, respectRetryAfterHeader, maxOverallTime, method-Whitelist
- ### Handler
    - Status-Handler per Code/Name/Wildcard, plus 'network-error' und 'parsing-error'
    - once: true bewirkt, dass Handler bei Retries nur am letzten Versuch ausgeführt werden
- ### Parsing und Progress
    - parseAs: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'response' | 'stream'
    - Globales ProgressAPI (start/set/done) und per-Request onProgress
- ### DX
    - Token als String oder Funktion, Authorization: Bearer
    - Timeout, AbortSignal, Credentials
    - suppressError und returnFields für minimierte CallResult-Strukturen
    - mapResponse zum Post-Processing des Response-Bodys

## API

### createCall(config): Call
- #### config
    - baseUrl?: string | URL
    - headers?: Record<string, string>
    - fetch?: typeof fetch (eigene Implementation/Polyfill)
    - timeout?: number
    - defaultOrigin?: string | URL (für relative URLs)
    - progress?: { start?(); set?(n: number | null); done?() }
    - suppressError?: boolean
    - returnFields?: Array<'content' | 'status' | 'statusText' | 'headers' | 'url' | 'ok' | 'redirected' | 'method' | 'error'>
    - credentials?: RequestCredentials
    - token?: string | () => string | Promise<string | undefined>
    - on?: OnStatus
    - retry?: RetryConfig

### OnStatus
- #### Mapping für:
    - numerische Codes (z. B. 500)
    - Namen (z. B. internalServerError, unauthorized, notFound, …)
    - Wildcards ('2xx' | '4xx' | '5xx')
    - Spezialschlüssel: 'network-error' | 'parsing-error'
- #### once?: boolean
    - false (Default): Handler feuern bei jedem Versuch
    - true: Handler feuern nur am finalen Versuch (wenn kein weiterer Retry folgt)
- #### Handler-Signaturen
    - Status: (ctx: { status, url, method, response, data, headers }) => void | Promise<void>
    - Parsing-Error: (ctx: { url, method, response, error }) => void | Promise<void>
    - Network-Error: (ctx: { url, method, error }) => void | Promise<void>

### RetryConfig
- onStatus?: Record<number | HttpStatusName | '1xx'|'2xx'|'3xx'|'4xx'|'5xx', RetryDecision>
- onNetworkError?: RetryDecision
- onParsingError?: RetryDecision
- maxDelay?: number
- backoffBase?: number
- respectRetryAfterHeader?: boolean
- maxOverallTime?: number
- methods?: HttpMethod[]
- RetryDecision:
    - boolean | { attempts: number; delay?: number | (attempt => number) }

### RequestOptions<TBody, TResponse>
- method?: HttpMethod
- headers?: Record<string, string>
- params?: Record<string, string | number | boolean | null | undefined>
- json?: TBody
- body?: BodyInit | null
- parseAs?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | 'response' | 'stream'
- signal?: AbortSignal
- timeout?: number
- mapResponse?: (data: any, res: Response) => TResponse
- onProgress?: (info: { loaded: number; total?: number; percent?: number | null }) => void
- useProgressApi?: boolean
- suppressError?: boolean
- returnFields?: ReturnFieldsEnum[]
- credentials?: RequestCredentials
- debug?: boolean
- token?: Token
- on?: OnStatus
- retry?: RetryCall
    - RetryCall = RetryDecision | { decision: RetryDecision; respectRetryAfterHeader?: boolean; maxDelay?: number; maxOverallTime?: number }

### CallResult<T>
- Abhängig von returnFields:
    - content?: T
    - status?, statusText?, headers?, url?, ok?, redirected?, method?, error?

### Fehlerverhalten
- suppressError = false (Default): wirft CallError bei Netzwerk-/Parsing-Fehlern und non-ok Responses
- suppressError = true: gibt CallResult mit ok: false und error zurück (kein Throw)
- Tipp: Für UI-Promises (z. B. toast.promise) ok=false in ein Reject verwandeln

## Beispiele

#### GET mit Params und returnFields
```ts
const call = createCall({ baseUrl: 'https://api.example.com', returnFields: ['status', 'content', 'ok'] })

const res = await call.get<{ items: string[] }>('/search', {
  params: { q: 'test', page: 2 },
})
if (!res.ok) return
console.log(res.status, res.content)
```

#### POST mit JSON, mapResponse
```ts
const res = await call.post<string, { title: string }>('/posts', {
  json: { title: 'Hello' },
  mapResponse: (data, _res) => data?.id as string,
})
console.log('ID:', res.content)
```

#### Retry: 500 mit 2 Versuchen, Handler nur am Ende
```ts
const call = createCall({
  retry: { onStatus: { 500: { attempts: 2 } } },
  on: {
    once: true,
    internalServerError: async ({ status }) => console.debug('final 500:', status),
  },
})
```

#### Progress verwenden
```ts
const call = createCall({
  progress: {
    start: () => NProgress.start(),
    set: (p) => p == null ? undefined : NProgress.set(p),
    done: () => NProgress.done(),
  },
})

await call.get('/large-file', {
  parseAs: 'text',
  onProgress: (p) => console.log(p.loaded, p.total, p.percent),
  useProgressApi: true,
})
```

#### Timeout, Abort
```ts
const c = new AbortController()
const p = call.get('/slow', { timeout: 5000, signal: c.signal })
setTimeout(() => c.abort(), 1000)
await p
```

#### Token/Authorization
```ts
const call = createCall({
  token: async () => localStorage.getItem('token') ?? undefined,
})
```

## Support
Node >= 18 (global fetch) oder fetch via config.fetch.

## Lizenz
- MIT

##  Changelog/Versionierung
- Semantic Versioning (semver). Nutze npm version [patch|minor|major] für Releases.