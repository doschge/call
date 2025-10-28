import {
    Call,
    CallConfig,
    RequestOptions,
    CallResult,
    Token,
    RetryCall,
    ParseAs,
    OnStatus
} from "./core/types.js";
import {CallError} from "./core/errors.js";
import {buildUrl} from "./core/url.js";
import {
    allowAndDelayFromDecision,
    codeToName, computeDelay,
    decisionFromStatus, fallbackParse,
    filterFields, parseWithReader,
    pickSpecial,
    pickStatusHandler,
} from "./core/helper.js";

/**
 * Default values
 */
const DEFAULT_METHOD = 'GET';
const DEFAULT_BACKOFF_BASE = 250;
const DEFAULT_MAX_DELAY = 30_000;
const DEFAULT_RESPECT_RETRY_AFTER_HEADER = true;
const DEFAULT_RETRY_METHODS = ['GET', 'OPTIONS', 'HEAD'];

/**
 * Factory function to create a call instance. See: {@link CallConfig}
 * @param {CallConfig} [config={}] - Configuration options for the call instance. You can configure the following options:

 * @returns {Call} - The created call instance
 */
export function createCall(config: CallConfig = {}): Call {
    /**
     * Define the fetch implementation to use.
     * @throws {Error} If no fetch implementation is available
     */
    const fetchImplementation = config.fetch ?? globalThis.fetch;
    if (!fetchImplementation) throw new Error('No fetch available. Provide config.fetch or use an environment with global fetch.');

    /**
     * Holds the config-given token, if typeof string.
     */
    let internalToken: string | undefined = typeof config.token === 'string' ? config.token : undefined;

    /**
     * Invokes an HTTP request using the configured fetch implementation.
     * 
     * @param url - The URL to request.
     * @param opts - Request options. See: {@link RequestOptions}
     */
    async function request<TResponse = unknown, TBody = unknown>(
        url: string,
        opts: RequestOptions<TBody, TResponse> = {}
    ): Promise<CallResult<TResponse>> {

        /**
         * Picks the call-specific method or defaults to global `DEFAULT_METHOD`. ("GET")
         */
        const method = opts.method ?? DEFAULT_METHOD;

        /**
         * Builds the headers for the request. Call-specific headers extend/override config-level headers.
         */
        const headers = new Headers(config.headers ?? {});
        if (opts.headers) {
            for (const [k, v] of Object.entries(opts.headers)) headers.set(k, v);
        }

        if (!headers.has('authorization')) {
            /**
             * If the token isn't overridden in the authorization header, resolve it from call-specific or config-level token.
             * @remarks flow:
             * 1. call-specific token (function or string)
             * 2. if callToken is provided: typeof function -> resolve it, else use as string
             * 3. internalToken (from config if string)
             * 4. if configToken is function -> resolve it, else use as string
             * 5. if no token found: returns undefined
             */
            const resolveToken = async (): Promise<string | undefined> => {
                const callToken = opts.token as Token | undefined;
                if (callToken !== undefined) return typeof callToken === 'function' ? await callToken() : callToken;
                if (internalToken !== undefined) return internalToken;
                if (config.token !== undefined) return typeof config.token === 'function' ? await config.token() : config.token;
                return undefined;
            }

            /**
             * Resolve the token and set the authorization header if a token is found.
             */
            try {
                const t = await resolveToken();
                if (t) headers.set('authorization', `Bearer ${t}`);
            } catch (err) {
                if (opts?.debug) console.debug('[CALL] - token resolve error:', err);
            }
        }

        /**
         * Use `buildUrl` to construct the final URL with baseUrl, params and defaultOrigin, also provides string representation.
         */
        const finalUrl = buildUrl(config.baseUrl, url, opts.params, config.defaultOrigin)
        const finalUrlString = finalUrl.toString();
        if (opts?.debug) console.debug('[CALL] - finalUrl:', finalUrlString);

        /**
         * Initialize the request body.
         * If json is provided in {@link RequestOptions}, set content-type header to application/json and stringify the json object.
         * Otherwise, use the body provided in {@link RequestOptions}.
         * Json takes precedence over body.
         */
        let body: BodyInit | undefined;
        if (opts.json !== undefined) {
            if (!headers.has('content-type')) headers.set('content-type', 'application/json');
            body = JSON.stringify(opts.json);
        } else if (opts.body !== undefined && opts.body !== null) {
            body = opts.body;
        }

        /**
         * Get timeout from call-specific or config-level options.
         * Call-specific timeout overrides config-level timeout.
         */
        const timeout = opts.timeout ?? config.timeout;
        /**
         * Determines if a timeout is set (number > 0).
         */
        const hasTimeout = typeof timeout === 'number' && timeout > 0;

        /**
         * Setup AbortController and timeout handling if a timeout is specified.
         */
        let controller: AbortController | undefined;

        /**
         * Get the incoming signal from call-specific options.
         */
        const incomingSignal = opts.signal;
        if (hasTimeout) {
            controller = new AbortController();
            if (incomingSignal) {
                if (incomingSignal.aborted) controller.abort();
                else incomingSignal.addEventListener('abort', () => controller?.abort(), {once: true});
            }
        }

        /**
         * Determines whether to suppress errors based on call-specific or config-level options.
         * Call-specific option overrides config-level option.
         */
        const suppress = opts.suppressError ?? config.suppressError ?? false;

        /** Call-specific event handlers for special events (network-error, parsing-error, HTTP-statuscodes, wildcards). */
        const localOn = (opts.on ?? {}) as OnStatus;
        /** Config-level event handlers for special events (network-error, parsing-error, HTTP-statuscodes, wildcards). */
        const globalOn = (config.on ?? {}) as OnStatus;
        /** Effective event handler trigger option */
        const effectiveOnce = localOn.once ?? globalOn.once ?? false;

        /** Clone of headers */
        const baseHeaders = new Headers(headers);
        /** Clone of body */
        const baseBody = body;
        /** Start time for the call, used for retry-policies */
        const startedAt = Date.now();

        /** Holds config-level retry-policy */
        const configRetry = config.retry ?? {};
        /** Holds call-specific retry-policy */
        const callRetry: RetryCall | undefined = opts.retry;

        /** Checks whether `callRetry` is just a boolean (false) or the detailed Object (See: {@link RetryCall}) (true) */
        const callRetryHasWrapper = !!callRetry && typeof callRetry === 'object' && 'decision' in callRetry;
        /** Extracts call-specific retry-decision using `callRetryHasWrapper` */
        const callDecision: boolean | undefined = callRetryHasWrapper ? (callRetry as any).decision : (callRetry as boolean | undefined);

        /** Start-value for custom-backoff strategies using config-level `backoffBase` or `DEFAULT_BACKOFF_BASE` */
        const backoffBase = configRetry.backoffBase ?? DEFAULT_BACKOFF_BASE;
        /** Value for maximum delay between retries using config-level `maxDelay` or `DEFAULT_MAX_DELAY` */
        const configMaxDelay = configRetry.maxDelay ?? DEFAULT_MAX_DELAY;
        /** Determines whether to respect the `Retry-After`-Header from the response.
         * 1. Uses call-specific `respectRetryAfterHeader` when as detailed Object (See: {@link RetryCall}).
         * 2. Otherwise, uses config-level `respectRetryAfterHeader`.
         * 3. Defaults to `DEFAULT_RESPECT_RETRY_AFTER_HEADER`.
         */
        const respectRetryAfterHeader = (callRetryHasWrapper && typeof callRetry.respectRetryAfterHeader === 'boolean')
            ? callRetry.respectRetryAfterHeader
            : (configRetry.respectRetryAfterHeader ?? DEFAULT_RESPECT_RETRY_AFTER_HEADER);
        /** Value for the maximum delay between retries.
         * 1. Uses call-specific `maxDelay` when as detailed Object (See: {@link RetryCall}).
         * 2. Otherwise, uses `configMaxDelay` (See: {@link configMaxDelay}).
         */
        const maxDelay = (callRetryHasWrapper && typeof callRetry.maxDelay === 'number')
            ? callRetry.maxDelay
            : configMaxDelay;
        /** Value for the maximum overall time for all retries and delays.
         * 1. Uses call-specific `maxOverallTime` when as detailed Object (See: {@link RetryCall}).
         * 2. Otherwise, uses config-level `maxOverallTime`.
         * 3. Defaults to `undefined` (no overall time limit).
         */
        const maxOverallTime = (callRetryHasWrapper && typeof callRetry.maxOverallTime === 'number')
            ? callRetry.maxOverallTime
            : (configRetry.maxOverallTime ?? undefined);
        /** Holds methods to apply the retry-policy to. Uses config-level `methods`, defaults to `DEFAULT_RETRY_METHODS`. */
        const retryMethods = configRetry.methods ?? DEFAULT_RETRY_METHODS;
        /** Determines whether `method` (See: {@link method}) is in retryMethods (See: {@link retryMethods}). */
        const methodAllowed = retryMethods.includes(method.toUpperCase());

        /** Determines whether the body is an instance of ReadableStream. */
        const isStreamBody =
            typeof ReadableStream !== 'undefined' && baseBody instanceof ReadableStream;
        /** If body is ReadableStream, body is not replayable. */
        const canReplayBody = !isStreamBody;

        /** Counter for number of attempts (0-based). */
        let attempt = 0;

        /** Main Loop for retries. */
        while (true) {
            /** Determines whether the call is within the budget of `maxOverallTime`. If `maxOverallTime` is set, it shouldn't be exceeded be the time since start. Checked at the start of the call. */
            const withinBudget = !maxOverallTime || (Date.now() - startedAt) < maxOverallTime;

            /** Determines whether a current timeout exists. */
            const hasTimeout = typeof timeout === 'number' && timeout > 0;
            /** Initializes an `AbortController`. */
            let controller: AbortController | undefined;
            /** Initializes an identifier for the timeout. */
            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            /** Gets the incoming signal from call-specific options. */
            const incomingSignal = opts.signal;
            /** When timeout is set, `setTimeout` and abort on expiration. Additionally, when ìncomingSignal is set, abort or listen for abort. */
            if (hasTimeout) {
                controller = new AbortController();
                if (incomingSignal) {
                    if (incomingSignal.aborted) controller.abort();
                    else incomingSignal.addEventListener('abort', () => controller?.abort(), {once: true});
                }
                timeoutId = setTimeout(() => controller?.abort(), timeout as number);
            }

            /** Use either the `controller` or the `incomingSignal` for the fetch. */
            const signalToUse = controller?.signal ?? incomingSignal;

            /** Clone of `baseHeaders`. */
            const headers = new Headers(baseHeaders);
            /** Clone of `baseBody`. */
            const body = baseBody;

            /** Initialize the response. */
            let res: Response | undefined;
            /** Initialize the parsed data from the response. */
            let data: any;

            /** Initialize the progressAPI */
            let progressAPI: any = undefined;
            /** Determines call-specific whether the `ProgressAPI` should be used. */
            let useProgressApi = !!opts.useProgressApi;
            /** True, if `ProgressAPI` or call-specific `progress` is in use */
            let wantsProgress = !!opts.onProgress || useProgressApi;

            /** Main fetch-call + parsing */
            try {
                /** Main fetch-call */
                try {
                    res = await fetchImplementation(finalUrlString, {
                        method,
                        headers,
                        body,
                        signal: signalToUse,
                        credentials: opts.credentials ?? config.credentials,
                    });
                } catch (err) {
                    /** --- NetworkError --- */

                    if (timeoutId) clearTimeout(timeoutId);

                    /** Decision based on config-level networkErrorRetry-policy overridden by call-specific retry-policy. */
                    const decision = callDecision ?? configRetry.onNetworkError;
                    /** Get allow and delay from `decision`. */
                    const {allow, delay} = allowAndDelayFromDecision(decision, attempt);
                    /** True if the method is allowed, the body is replayable and the request doesn't exceed the `maxOverallTime`. */
                    const within = methodAllowed && canReplayBody && withinBudget;
                    /** Merge of within and allow */
                    const willRetryNext = within && allow

                    /** Execute special `network-error` onHandler. */
                    try {
                        const h = pickSpecial('network-error', localOn, globalOn);
                        if (h && (!effectiveOnce || !willRetryNext)) await h({url: finalUrlString, method, error: err});
                    } catch {}

                    /** If all criteria are met, wait the calculated delay, increase the attempt-count and rerun the loop. */
                    if (willRetryNext) {
                        const d = computeDelay({ attempt, maxDelay, respectRetryAfterHeader, backoffBase, response: res, delay })
                        if (d > 0) await new Promise(r => setTimeout(r, d));
                        attempt++;
                        continue;
                    }

                    /** If errors are suppressed, return a CallResult with ok: false and error details. */
                    if (suppress) {
                        return filterFields({
                            content: undefined as unknown as TResponse,
                            status: 0,
                            statusText: 'Network/Abort error',
                            headers: new Headers(),
                            url: finalUrlString,
                            ok: false,
                            redirected: false,
                            method,
                            error: {message: 'Network/Abort error', cause: err as any},
                        }, opts, config);
                    }
                    /** Otherwise, throw a CallError with details about the network error. */
                    throw new CallError('Network/Abort error', {
                        url: finalUrlString,
                        method,
                        cause: err,
                    });
                }
                /** --- Fetch succeeded --- */
                if (opts?.debug) console.debug(`[CALL] - fetch response (attempt ${attempt}):`, res);

                /** Uses call-specific `parseAs`. */
                const explicitParse = opts.parseAs;
                /** Gets `content-type`-header from response. */
                const contentType = res.headers.get('content-type') || '';
                /** If `contentType` is `application/json` default to "json", otherwise default to "text" */
                const defaultParse: ParseAs = contentType.includes('application/json') ? 'json' : 'text';
                /** Uses `explicitParse` or `defaultParse`. */
                const parseAs = explicitParse ?? defaultParse;

                /** False if neither call-specific or  */
                wantsProgress = !!opts.onProgress || !!opts.useProgressApi;
                progressAPI = config.progress;
                useProgressApi = !!opts.useProgressApi;

                if (opts?.debug) console.debug('[CALL] - progressAPI:', progressAPI);

                try {
                    data =
                        wantsProgress && parseAs !== 'response' && parseAs !== 'stream'
                            ? await parseWithReader(res, parseAs, opts, useProgressApi, progressAPI)
                            : await fallbackParse(res, parseAs);
                    if (opts?.debug) console.debug('[CALL] - parsed data:', data);
                } catch (err) {
                    if (timeoutId) clearTimeout(timeoutId);

                    /** Decision based on config-level parsingErrorRetry-policy overridden by call-specific retry-policy. */
                    const decision = callDecision ?? configRetry.onParsingError;
                    /** Get allow and delay from `decision`. */
                    const {allow, delay} = allowAndDelayFromDecision(decision, attempt);
                    /** True if the method is allowed, the body is replayable and the request doesn't exceed the `maxOverallTime`. */
                    const within = methodAllowed && canReplayBody && withinBudget;
                    /** Merge of within and allow */
                    const willRetryNext = within && allow

                    try {
                        const h = pickSpecial('parsing-error', localOn, globalOn);
                        if (h && (!effectiveOnce || !willRetryNext)) await h({url: finalUrlString, method, response: res, error: err});
                    } catch {}

                    /** If all criteria are met, wait the calculated delay, increase the attempt-count and rerun the loop. */
                    if (willRetryNext) {
                        const d = computeDelay({
                            attempt,
                            delay,
                            maxDelay,
                            respectRetryAfterHeader,
                            backoffBase,
                            response: res,
                        })
                        if (d > 0) await new Promise(r => setTimeout(r, d));
                        attempt++;
                        continue;
                    }

                    /** If errors are suppressed, return a CallResult with ok: false and error details. */
                    if (suppress) {
                        return filterFields({
                            content: undefined as unknown as TResponse,
                            status: res?.status ?? 0,
                            statusText: res?.statusText || 'Response parse error',
                            headers: res?.headers ?? new Headers(),
                            url: finalUrlString,
                            ok: false,
                            redirected: res?.redirected ?? false,
                            method,
                            error: {message: 'Response parse error', cause: err},
                        }, opts, config);
                    }

                    /** Otherwise, throw a CallError with details about the parsing error. */
                    throw new CallError('Response parse error', {
                        url: finalUrlString,
                        method,
                        response: res,
                        cause: err,
                    });
                }

                const s = res.status;
                const handler = pickStatusHandler(s, localOn, globalOn, codeToName);

                if (res.ok) {
                    try {
                        if (handler) {
                            await handler({
                                status: s,
                                url: finalUrlString,
                                method,
                                response: res,
                                data,
                                headers: res.headers,
                            });
                        }
                    } catch (err) {
                        if (opts?.debug) console.debug('[CALL] - onHandler error:', err);
                    }

                    if (timeoutId) clearTimeout(timeoutId);
                    const content: TResponse = opts.mapResponse ? opts.mapResponse(data, res) : data;
                    return filterFields({
                        content,
                        status: res.status,
                        statusText: res.statusText,
                        headers: res.headers,
                        url: finalUrlString,
                        ok: res.ok,
                        redirected: res.redirected,
                        method,
                    }, opts, config);
                }

                /** Decision based on config-level statusRetry-policy overridden by call-specific retry-policy. */
                const decision = callDecision ?? decisionFromStatus(res.status, configRetry);
                /** Get allow and delay from `decision`. */
                const {allow, delay} = allowAndDelayFromDecision(decision, attempt);
                /** True if the method is allowed, the body is replayable and the request doesn't exceed the `maxOverallTime`. */
                const within = methodAllowed && canReplayBody && withinBudget;
                /** Merge of within and allow */
                const willRetryNext = within && allow

                try {
                    if (handler && (!effectiveOnce || !willRetryNext)) {
                        await handler({
                            status: s,
                            url: finalUrlString,
                            method,
                            response: res,
                            data,
                            headers: res.headers,
                        })
                    }
                } catch (err) {
                    if (opts?.debug) console.debug('[CALL] - onHandler error:', err);
                }

                if (willRetryNext) {
                    const d = computeDelay({
                        attempt,
                        response: res,
                        delay,
                        maxDelay,
                        respectRetryAfterHeader,
                        backoffBase,
                    })
                    if (d > 0) await new Promise(r => setTimeout(r, d));
                    attempt++;
                    continue;
                }

                const message = `Request failed with ${res.status}${res.statusText ? ' ' + res.statusText : ''}`;
                if (suppress) {
                    if (timeoutId) clearTimeout(timeoutId);
                    const code =
                        data && typeof data === 'object' && true && 'code' in data
                            ? String((data as any).code)
                            : undefined;

                    const content = (opts.mapResponse ? opts.mapResponse(data, res) : data) as TResponse;

                    return filterFields({
                        content,
                        status: res.status,
                        statusText: res.statusText,
                        headers: res.headers,
                        url: finalUrlString,
                        ok: false,
                        redirected: res.redirected,
                        method,
                        error: {message, cause: code},
                    }, opts, config);
                }

                if (timeoutId) clearTimeout(timeoutId);

                throw new CallError(message, {
                    status: res.status,
                    url,
                    method,
                    data,
                    response: res,
                });
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
        }
    }

    return {
        request,
        get: (url, opts) => request(url, {...(opts as any), method: 'GET'}),
        post: (url, opts) => request(url, {...(opts as any), method: 'POST'}),
        put: (url, opts) => request(url, {...(opts as any), method: 'PUT'}),
        patch: (url, opts) => request(url, {...(opts as any), method: 'PATCH'}),
        delete: (url, opts) => request(url, {...(opts as any), method: 'DELETE'}),

        token: {
            set: (t?: string) => { internalToken = t },
            get: () => internalToken,
            clear: () => { internalToken = undefined },
        }
    }
}

export type {Call, CallConfig, RequestOptions, CallResult} from './core/types';
export {CallError};