/**
 * HTTP methods supported by the HTTP client.
 */
export type HttpMethod =
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'PATCH'
    | 'OPTIONS'
    | 'HEAD'
;
/**
 * Progress API used for global progress updates.
 * @remarks
 * - `start` is called when the progress starts.
 * - `set` is called with the current progress (0..1) or null if unknown.
 * - `done` is called when the progress is complete.
 */
export interface ProgressAPI {
    start?(): void;
    set?(progress: number | null): void;
    done?(): void;
}

/**
 * Fields that can be returned in the CallResult based on the `returnFields` option.
 */
export const returnFields = [
    "content",
    "status",
    "statusText",
    "headers",
    "url",
    "ok",
    "redirected",
    "method",
    "error",
] as const;

/**
 * Handler for HTTP codes (e.g. 200, 201, 500), names of codes (e.g. unauthorized, ok, notFound) and wildcards (e.g. 2xx, 4xx).
 * @remarks The following data is provided to the handler:
 * - `status`: The HTTP status code.
 * - `url`: The requested URL.
 * - `method`: The HTTP method used.
 * - `response`: The original Response object.
 * - `data`: The parsed response data (if any).
 * - `headers`: The response headers.
 */
export type OnStatusHandler = (ctx: {
    status: number;
    url: string;
    method: HttpMethod;
    response: Response;
    data: any;
    headers: Headers;
}) => void | Promise<void>;

/**
 * Handler for parsing errors ('parsing-error').
 * @remarks The following data is provided to the handler:
 * - `url`: The requested URL.
 * - `method`: The HTTP method used.
 * - `response`: The original Response object.
 * - `error`: The parsing error that occurred.
 */
export type OnParsingErrorHandler = (ctx: {
    url: string;
    method: HttpMethod;
    response: Response;
    error: unknown;
}) => void | Promise<void>;

/**
 * Handler for network errors ('network-error').
 * @remarks The following data is provided to the handler:
 * - `url`: The requested URL.
 * - `method`: The HTTP method used.
 * - `error`: The parsing error that occurred.
 */
export type OnNetworkErrorHandler = (ctx: {
    url: string;
    method: HttpMethod;
    error: unknown;
}) => void | Promise<void>;

export interface HttpStatusNames {
    /** 100 Continue */ continue?: OnStatusHandler;
    /** 101 Switching Protocols */ switchingProtocols?: OnStatusHandler;
    /** 102 Processing */ processing?: OnStatusHandler;
    /** 103 Early Hints */ earlyHints?: OnStatusHandler;

    /** 200 OK */ ok?: OnStatusHandler;
    /** 201 Created */ created?: OnStatusHandler;
    /** 202 Accepted */ accepted?: OnStatusHandler;
    /** 203 Non-Authoritative Information */ nonAuthoritativeInformation?: OnStatusHandler;
    /** 204 No Content */ noContent?: OnStatusHandler;
    /** 205 Reset Content */ resetContent?: OnStatusHandler;
    /** 206 Partial Content */ partialContent?: OnStatusHandler;
    /** 207 Multi-Status */ multiStatus?: OnStatusHandler;
    /** 208 Already Reported */ alreadyReported?: OnStatusHandler;
    /** 214 Transformation Applied */ transformationApplied?: OnStatusHandler;
    /** 226 IM Used */ imUsed?: OnStatusHandler;

    /** 300 Multiple Choices */ multipleChoices?: OnStatusHandler;
    /** 301 Moved Permanently */ movedPermanently?: OnStatusHandler;
    /** 302 Found */ found?: OnStatusHandler;
    /** 303 See Other */ seeOther?: OnStatusHandler;
    /** 304 Not Modified */ notModified?: OnStatusHandler;
    /** 305 Use Proxy */ useProxy?: OnStatusHandler;
    /** 307 Temporary Redirect */ temporaryRedirect?: OnStatusHandler;
    /** 308 Permanent Redirect */ permanentRedirect?: OnStatusHandler;

    /** 400 Bad Request */ badRequest?: OnStatusHandler;
    /** 401 Unauthorized */ unauthorized?: OnStatusHandler;
    /** 402 Payment Required */ paymentRequired?: OnStatusHandler;
    /** 403 Forbidden */ forbidden?: OnStatusHandler;
    /** 404 Not Found */ notFound?: OnStatusHandler;
    /** 405 Method Not Allowed */ methodNotAllowed?: OnStatusHandler;
    /** 406 Not Acceptable */ notAcceptable?: OnStatusHandler;
    /** 407 Proxy Authentication Required */ proxyAuthenticationRequired?: OnStatusHandler;
    /** 408 Request Timeout */ requestTimeout?: OnStatusHandler;
    /** 409 Conflict */ conflict?: OnStatusHandler;
    /** 410 Gone */ gone?: OnStatusHandler;
    /** 411 Length Required */ lengthRequired?: OnStatusHandler;
    /** 412 Precondition Failed */ preconditionFailed?: OnStatusHandler;
    /** 413 Payload Too Large */ payloadTooLarge?: OnStatusHandler;
    /** 414 URI Too Long */ uriTooLong?: OnStatusHandler;
    /** 415 Unsupported Media Type */ unsupportedMediaType?: OnStatusHandler;
    /** 416 Range Not Satisfiable */ rangeNotSatisfiable?: OnStatusHandler;
    /** 417 Expectation Failed */ expectationFailed?: OnStatusHandler;
    /** 418 I'm a teapot */ imATeapot?: OnStatusHandler;
    /** 421 Misdirected Request */ misdirectedRequest?: OnStatusHandler;
    /** 422 Unprocessable Entity */ unprocessableEntity?: OnStatusHandler;
    /** 423 Locked */ locked?: OnStatusHandler;
    /** 424 Failed Dependency */ failedDependency?: OnStatusHandler;
    /** 425 Too Early */ tooEarly?: OnStatusHandler;
    /** 426 Upgrade Required */ upgradeRequired?: OnStatusHandler;
    /** 428 Precondition Required */ preconditionRequired?: OnStatusHandler;
    /** 429 Too Many Requests */ tooManyRequests?: OnStatusHandler;
    /** 431 Request Header Fields Too Large */ requestHeaderFieldsTooLarge?: OnStatusHandler;
    /** 444 No Response */ noResponse?: OnStatusHandler;
    /** 450 Blocked by Windows Parent Controls */ blockedByWindowsParentControls?: OnStatusHandler;
    /** 451 Unavailable For Legal Reasons */ unavailableForLegalReasons?: OnStatusHandler;
    /** 495 SSL Certificate Error */ sslCertificateError?: OnStatusHandler;
    /** 496 SSL Certificate Required */ sslCertificateRequired?: OnStatusHandler;
    /** 497 HTTP Request Sent to HTTPS Port */ httpRequestSentToHttpsPort?: OnStatusHandler;
    /** 498 Token expired/invalid */ tokenExpiredInvalid?: OnStatusHandler;
    /** 499 Client Closed Request */ clientClosedRequest?: OnStatusHandler;

    /** 500 Internal Server Error */ internalServerError?: OnStatusHandler;
    /** 501 Not Implemented */ notImplemented?: OnStatusHandler;
    /** 502 Bad Gateway */ badGateway?: OnStatusHandler;
    /** 503 Service Unavailable */ serviceUnavailable?: OnStatusHandler;
    /** 504 Gateway Timeout */ gatewayTimeout?: OnStatusHandler;
    /** 505 HTTP Version Not Supported */ httpVersionNotSupported?: OnStatusHandler;
    /** 506 Variant Also Negotiates */ variantAlsoNegotiates?: OnStatusHandler;
    /** 507 Insufficient Storage */ insufficientStorage?: OnStatusHandler;
    /** 508 Loop Detected */ loopDetected?: OnStatusHandler;
    /** 509 Bandwidth Limit Exceeded */ bandwidthLimitExceeded?: OnStatusHandler;
    /** 510 Not Extended */ notExtended?: OnStatusHandler;
    /** 511 Network Authentication Required */ networkAuthenticationRequired?: OnStatusHandler;
    /** 521 Web Server Is Down (Cloudflare) */ webServerIsDown?: OnStatusHandler;
    /** 522 Connection Timed Out (Cloudflare) */ connectionTimedOut?: OnStatusHandler;
    /** 523 Origin Is Unreachable (Cloudflare) */ originIsUnreachable?: OnStatusHandler;
    /** 525 SSL Handshake Failed (Cloudflare) */ sslHandshakeFailed?: OnStatusHandler;
    /** 530 Site Frozen */ siteFrozen?: OnStatusHandler;
    /** 599 Network Connect Timeout Error */ networkConnectTimeoutError?: OnStatusHandler;
}

export const StatusCodeByName = {
    continue: 100,
    switchingProtocols: 101,
    processing: 102,
    earlyHints: 103,

    ok: 200,
    created: 201,
    accepted: 202,
    nonAuthoritativeInformation: 203,
    noContent: 204,
    resetContent: 205,
    partialContent: 206,
    multiStatus: 207,
    alreadyReported: 208,
    transformationApplied: 214,
    imUsed: 226,

    multipleChoices: 300,
    movedPermanently: 301,
    found: 302,
    seeOther: 303,
    notModified: 304,
    useProxy: 305,
    temporaryRedirect: 307,
    permanentRedirect: 308,

    badRequest: 400,
    unauthorized: 401,
    paymentRequired: 402,
    forbidden: 403,
    notFound: 404,
    methodNotAllowed: 405,
    notAcceptable: 406,
    proxyAuthenticationRequired: 407,
    requestTimeout: 408,
    conflict: 409,
    gone: 410,
    lengthRequired: 411,
    preconditionFailed: 412,
    payloadTooLarge: 413,
    uriTooLong: 414,
    unsupportedMediaType: 415,
    rangeNotSatisfiable: 416,
    expectationFailed: 417,
    imATeapot: 418,
    misdirectedRequest: 421,
    unprocessableEntity: 422,
    locked: 423,
    failedDependency: 424,
    tooEarly: 425,
    upgradeRequired: 426,
    preconditionRequired: 428,
    tooManyRequests: 429,
    requestHeaderFieldsTooLarge: 431,
    noResponse: 444,
    blockedByWindowsParentControls: 450,
    unavailableForLegalReasons: 451,
    sslCertificateError: 495,
    sslCertificateRequired: 496,
    httpRequestSentToHttpsPort: 497,
    tokenExpiredInvalid: 498,
    clientClosedRequest: 499,

    internalServerError: 500,
    notImplemented: 501,
    badGateway: 502,
    serviceUnavailable: 503,
    gatewayTimeout: 504,
    httpVersionNotSupported: 505,
    variantAlsoNegotiates: 506,
    insufficientStorage: 507,
    loopDetected: 508,
    bandwidthLimitExceeded: 509,
    notExtended: 510,
    networkAuthenticationRequired: 511,
    webServerIsDown: 521,
    connectionTimedOut: 522,
    originIsUnreachable: 523,
    sslHandshakeFailed: 525,
    siteFrozen: 530,
    networkConnectTimeoutError: 599,
} as const;

/**
 * Wildcard types for HTTP status codes.
 */
export type HttpStatusWildcard =
    | '1xx'
    | '2xx'
    | '3xx'
    | '4xx'
    | '5xx'
;

/**
 * Fields that can be returned in the CallResult based on the `returnFields` option.
 */
export type ReturnFieldsEnum = (typeof returnFields)[number];

/**
 * Token type for authentication.
 * Can be a string or a function that returns a string or a Promise resolving to a string.
 */
export type Token = string | (() => string | Promise<string | undefined>)

/**
 * Handlers for different events during the HTTP call lifecycle.
 * @remarks
 * - HTTP status codes (e.g. 200, 400), status names (e.g. ok, notFound) and wildcards (e.g. 2xx, 4xx) map to OnStatusHandler.
 * - network-error maps to {@link OnNetworkErrorHandler}.
 * - parsing-error maps to {@link OnParsingErrorHandler}.
 */
type OnHandlers =
    Partial<Record<number | HttpStatusWildcard, OnStatusHandler>>
    & Partial<HttpStatusNames>
    & {
        'network-error'?: OnNetworkErrorHandler;
        'parsing-error'?: OnParsingErrorHandler;
    };


/**
 * Merge of {@link OnHandlers} with an optional `once` flag to indicate whether the `on` should be triggered on every retry or just the final one.
 */
export type OnStatus = OnHandlers & {
    once?: boolean;
}

/**
 * Decision type for retrying requests.
 * @remarks
 * - `true` to retry once.
 * - `false` to not retry.
 * - An object with `attempts` and optional `delay` to specify the number of retry attempts and delay between attempts.
 */
export type RetryDecision =
    | boolean
    | {
        attempts: number;
        delay?: number | ((attempt: number) => number);
    }

/**
 * Retry policy configured in {@link CallConfig}. May be overwritten in individual calls.
 * @remarks
 * - `onNetworkError`: Retry decision for network errors.
 * - `onParsingError`: Retry decision for parsing errors.
 * - `onStatus`: Retry decisions for specific HTTP status codes, names, or wildcards.
 * - `maxDelay`: Maximum delay between retries in milliseconds.
 * - `backoffBase`: Base for exponential backoff calculation.
 * - `respectRetryAfterHeader`: Whether to respect the Retry-After header from the server (e.g. on code 429).
 * - `maxOverallTime`: Maximum overall time for all retries in milliseconds.
 * - `methods`: HTTP methods to apply the retry policy to.
 */
export type RetryConfig = {
    onNetworkError?: RetryDecision;
    onParsingError?: RetryDecision;
    onStatus?: Partial<Record<number | keyof typeof StatusCodeByName | HttpStatusWildcard, RetryDecision>>;
    maxDelay?: number;
    backoffBase?: number;
    respectRetryAfterHeader?: boolean;
    maxOverallTime?: number;
    methods?: HttpMethod[];
}

/**
 * Retry policy configured in {@link RequestOptions}. Overwrites parts of {@link RetryConfig}.
 * @remarks
 * - `decision`: The retry decision for the call.
 * - `respectRetryAfterHeader`: Whether to respect the Retry-After header from the server (e.g. on code 429).
 * - `maxDelay`: Maximum delay between retries in milliseconds.
 * - `maxOverallTime`: Maximum overall time for all retries in milliseconds.
 */
export type RetryCall = RetryDecision | {
    decision: RetryDecision;
    respectRetryAfterHeader?: boolean;
    maxDelay?: number;
    maxOverallTime?: number;
}

/**
 * Configuration of the call instance. May be overridden in individual calls.
 * @remarks
 * - `baseUrl`: Base URL for the call.
 * - `headers`: Default headers for the call.
 * - `fetch`: Custom fetch implementation to use for the call. Defaults to global fetch.
 * - `timeout`: Timeout for the call in milliseconds.
 * - `defaultOrigin`: Default origin to use for relative URLs.
 * - `progress`: Global progress API (e.g. for static loading-bar). See {@link ProgressAPI}.
 * - `suppressError`: Whether to suppress errors and return them in the CallResult. Defaults to false.
 * - `returnFields`: Fields to return in the CallResult. See {@link ReturnFieldsEnum}.
 * - `credentials`: Credentials mode for the call.
 * - `token`: Token for authentication. Added to the Authorization header as Bearer token.
 * - `on`: Handlers for different events during the call lifecycle. See {@link OnStatus}.
 * - `retry`: Retry policy for the call. See {@link RetryCall}.
 */
export interface CallConfig {
    baseUrl?: string | URL;
    headers?: Record<string, string>;
    fetch?: typeof fetch;
    timeout?: number;
    defaultOrigin?: string | URL;
    progress?: ProgressAPI;
    suppressError?: boolean;
    returnFields?: ReturnFieldsEnum[];
    credentials?: RequestCredentials;
    token?: Token;
    on?: OnStatus;
    retry?: RetryConfig;
}

/**
 * Information about the progress of a specific call.
 * @remarks
 * - `loaded`: Number of bytes loaded so far.
 * - `total`: Total number of bytes to load (if known).
 * - `percent`: Percentage of bytes loaded (0..1) or null if total is unknown.
 */
export interface ProgressInfo {
    loaded: number;
    total?: number;
    percent?: number | null;
}

export type ParseAs =
    | "response"
    | "json"
    | "text"
    | "blob"
    | "arrayBuffer"
    | "formData"
    | "stream"
;

/**
 * Options for individual calls. May override parts of {@link CallConfig}.
 * @remarks
 * - `method`: HTTP method for the request.
 * - `headers`: Headers for the request.
 * - `params`: Query parameters for the request.
 * - `json`: JSON body for the request. Sets the Content-Type to application/json.
 * - `body`: Body for the request. Can be a string, Blob, FormData, etc.
 * - `parseAs`: How to parse the response. Defaults to 'json'.
 * - `signal`: AbortSignal to cancel the request.
 * - `timeout`: Timeout for the request in milliseconds.
 * - `mapResponse`: Function to directly mutate the parsed response data (e.g. `.trim()` the response)
 * - `onProgress`: Callback for progress updates for this request. Provides {@link ProgressInfo}.
 * - `useProgressApi`: Whether to use the global ProgressAPI for this request.
 * - `suppressError`: Whether to suppress errors and return them in the CallResult.
 * - `returnFields`: Fields to return in the CallResult.
 * - `credentials`: Credentials mode for the request.
 * - `debug`: Whether to enable debug logging for this request. ( uses console.debug() with "[CALL] - " as prefix )
 * - `token`: Token for authentication. Added to the Authorization header as Bearer token.
 * - `on`: Handlers for different events during the request lifecycle. See {@link OnStatus}.
 * - `retry`: Retry policy for the request. See {@link RetryCall}.
 */
export interface RequestOptions<TBody = unknown, TResponse = unknown> {
    method?: HttpMethod;
    headers?: Record<string, string>;
    params?: Record<string, string | number | boolean | null | undefined>;
    json?: TBody;
    body?: BodyInit | null;
    parseAs?: ParseAs;
    signal?: AbortSignal;
    timeout?: number;
    mapResponse?: (data: any, res: Response) => TResponse;
    onProgress?: (info: ProgressInfo) => void;
    useProgressApi?: boolean;
    suppressError?: boolean;
    returnFields?: ReturnFieldsEnum[];
    credentials?: RequestCredentials;
    debug?: boolean;
    token?: Token;
    on?: OnStatus;
    retry?: RetryCall;
}

/**
 * Result of a call. Contains various fields based on the `returnFields` option.
 * @remarks
 * - `content`: Parsed response content.
 * - `status`: HTTP status code.
 * - `statusText`: HTTP status text.
 * - `headers`: Response headers.
 * - `url`: Final URL after redirects.
 * - `ok`: Whether the response was successful (status in the range 200-299).
 * - `redirected`: Whether the response was redirected.
 * - `method`: HTTP method used for the request.
 * - `error`: Error information if an error occurred (present when `suppressError` is true and Error would have been thrown).
 */
export interface CallResult<T = unknown> {
    content?: T;
    status?: number;
    statusText?: string;
    headers?: Headers;
    url?: string;
    ok?: boolean;
    redirected?: boolean;
    method?: HttpMethod;
    error?: {
        message: string;
        cause?: string;
    };
}

/**
 * Defines Methods of the call instance.
 * @remarks
 * - `request`: Generic request method.
 * - `get`: HTTP GET method.
 * - `post`: HTTP POST method.
 * - `put`: HTTP PUT method.
 * - `patch`: HTTP PATCH method.
 * - `delete`: HTTP DELETE method.
 * - `token`: Methods to manipulate the authentication token. Token can be `set`, `get` or `cleared`.
 */
export interface Call {
    request<TResponse = unknown, TBody = unknown>(
        url: string,
        opts?: RequestOptions<TBody, TResponse>,
    ): Promise<CallResult<TResponse>>

    get<TResponse = unknown>(
        url: string,
        opts?: Omit<RequestOptions<never, TResponse>, 'method' | 'body' | 'json'>,
    ): Promise<CallResult<TResponse>>

    post<TResponse = unknown, TBody = unknown>(
        url: string,
        opts?: RequestOptions<TBody, TResponse>,
    ): Promise<CallResult<TResponse>>

    put<TResponse = unknown, TBody = unknown>(
        url: string,
        opts?: RequestOptions<TBody, TResponse>
    ): Promise<CallResult<TResponse>>;

    patch<TResponse = unknown, TBody = unknown>(
        url: string,
        opts?: RequestOptions<TBody, TResponse>
    ): Promise<CallResult<TResponse>>;

    delete<TResponse = unknown>(
        url: string,
        opts?: Omit<RequestOptions<never, TResponse>, 'json' | 'body'>
    ): Promise<CallResult<TResponse>>;

    token: {
        set: (token?: string) => void;
        get: () => string | undefined;
        clear: () => void;
    }
}