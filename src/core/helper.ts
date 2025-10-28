import {
    CallConfig,
    HttpStatusWildcard,
    ParseAs,
    ProgressAPI,
    RetryConfig,
    ReturnFieldsEnum,
    StatusCodeByName
} from "./types.js";
import {RequestOptions} from "./types.js";

/**
 * Decides how to handle 'network-error' and 'parsing-error' cases.
 *
 * @param key - is either 'network-error' or 'parsing-error'
 * @param local - call-specific handler map
 * @param global - config-level handler map
 */
export const pickSpecial = <T extends 'network-error' | 'parsing-error'>(
    key: T,
    local: Record<string | number, any>,
    global: Record<string | number, any>,
) => (typeof local[key] === 'function' ? local[key] : global[key]);

/**
 * Uses given HTTP-statuscode to create the corresponding wildcard.
 *
 * @param status - HTTP-statuscode
 */
export const statusToWildcard = (status: number): HttpStatusWildcard =>
    `${Math.floor(status / 100)}xx` as HttpStatusWildcard;

/**
 * Uses given HTTP-statuscode to pick the handler-function to be used.
 * @remarks Hierarchy:
 * 1. call-specific statuscode / status-name
 * 2. config-level statuscode / status-name
 * 3. call-specific wildcard (e.g. 4xx, 5xx)
 * 4. config-level wildcard (e.g. 4xx, 5xx)
 *
 * @param status - HTTP-statuscode
 * @param local - call-specific handler map
 * @param global - config-level handler map
 * @param codeToName - HTTP-statuscode to status-name map
 *
 * @returns The picked handler-**function** or **undefined** if none found
 */
export const pickStatusHandler = (
    status: number,
    local: Record<string | number, any>,
    global: Record<string | number, any>,
    codeToName: Record<number, string>,
) => {
    const name = codeToName[status] as string | undefined;

    const h1 = (local[status] ?? (name ? local[name] : undefined));
    if (typeof h1 === 'function') return h1;

    const h2 = (global[status] ?? (name ? global[name] : undefined));
    if (typeof h2 === 'function') return h2;

    const wildcard = statusToWildcard(status);

    const h3 = local[wildcard];
    if (typeof h3 === 'function') return h3;

    const h4 = global[wildcard];
    if (typeof h4 === 'function') return h4;

    return undefined;
}

/**
 * Uses the call-specific or config-level `returnFields` to filter the given object.
 * Call-specific options override config-level options.
 *
 * @param obj - Object to be filtered
 * @param opts - Call-specific options
 * @param config - Config-level options
 */
export const filterFields = <TResponse = unknown, TBody = unknown>(obj: Record<string, any>, opts: RequestOptions<TBody, TResponse>, config: CallConfig) => {
    const fieldsToReturn = opts.returnFields?.length
        ? opts.returnFields
        : config.returnFields;
    if (!fieldsToReturn) return obj;

    if (opts?.debug) console.debug('[CALL] - fieldsToReturn:', fieldsToReturn);

    return Object.fromEntries(
        Object.entries(obj)
            .filter(([k]) => fieldsToReturn.includes(k as ReturnFieldsEnum))
    );
};

/**
 * Creates a mapping from status code numbers to their corresponding names.
 */
export const codeToName = (() => {
    const m: Record<number, keyof typeof StatusCodeByName> = {};
    for (const k of Object.keys(StatusCodeByName) as Array<keyof typeof StatusCodeByName>) {
        m[StatusCodeByName[k]] = k;
    }
    return m;
})();

/**
 *
 *
 * @param status - HTTP-statuscode.
 * @param configRetry - Config-level retry configuration (See: {@link RetryConfig}).
 */
export const decisionFromStatus = (status: number, configRetry: RetryConfig ) => {
    const map = configRetry.onStatus as Record<string | number, any> | undefined;
    if (!map) return undefined;

    const decisionNumber = map[status];
    if (decisionNumber !== undefined) return decisionNumber;

    const name = codeToName[status];
    const decisionName = map[name];
    if (name && decisionName !== undefined) return decisionName;

    const wildcard = statusToWildcard(status);
    return map[wildcard];
}

/**
 *
 * @param decision
 * @param attempt
 */
export const allowAndDelayFromDecision = (
    decision: any,
    attempt: number,
): { allow: boolean; delay?: number } => {
    if (typeof decision === 'boolean') return {allow: decision && attempt < 1}
    if (decision && typeof decision === 'object') {
        const max = Math.max(0, (decision.attempts | 0));
        if (attempt < max) {
            if (typeof decision.delay === 'number') return {allow: true, delay: decision.delay};
            if (typeof decision.delay === 'function') {
                const v = Number(decision.delay(attempt));
                if (Number.isFinite(v) && v >= 0) return {allow: true, delay: v};
            }
            return {allow: true};
        }
    }
    return {allow: false};
}

/**
 * Calculates the delay before the next retry attempt.
 * @remarks flow:
 * 1. If an explicit delay is provided, use it (0 < delay < maxDelay).
 * 2. If `respectRetryAfterHeader` is true, the response is provided, and it contains a valid 'Retry-After' header, use that value (0 < delay < maxDelay).
 * 3. Otherwise, calculate an exponential backoff delay with jitter: random(0, backoffBase * 2^attempt) (capped at maxDelay).
 *
 * @param attempt - Current attempt number (0-based).
 * @param maxDelay - Maximum delay in milliseconds.
 * @param respectRetryAfterHeader - Whether to respect the 'Retry-After' header.
 * @param backoffBase - Base value for exponential backoff calculation.
 * @param response - Optional Response object from the last attempt.
 * @param delay - Optional explicit delay value.
 *
 * @returns {number} Calculated delay in milliseconds.
 */
export const computeDelay = ({
    attempt,
    maxDelay,
    respectRetryAfterHeader,
    backoffBase,
    response,
    delay,
}: {
    attempt: number,
    maxDelay: number,
    respectRetryAfterHeader: boolean,
    backoffBase: number,
    response?: Response,
    delay: number | undefined,
}): number => {
    if (typeof delay === 'number') return Math.max(0, Math.min(maxDelay, delay));
    if (respectRetryAfterHeader && response) {
        const ra = response.headers.get('retry-after');
        if (ra) {
            const ms = /^\d+$/.test(ra) ? Number(ra) * 1000 : Math.max(0, Date.parse(ra) - Date.now());
            if (Number.isFinite(ms)) return Math.min(maxDelay, ms);
        }
    }
    const ms = Math.floor(Math.random() * (backoffBase * Math.pow(2, attempt)));
    return Math.min(maxDelay, ms);
}

/**
 * Parses the response based on the desired type. Defaults to text if no type is specified.
 *
 * @param res - Response object from fetch
 * @param parseAs - Desired parsing type
 */
export const fallbackParse = async (res: Response, parseAs: ParseAs | undefined) => {
    switch (parseAs) {
        case 'json': {
            const t = await res!.text();
            return t ? JSON.parse(t) : undefined;
        }
        case 'text':
            return await res!.text();
        case 'blob':
            return await res!.blob();
        case 'arrayBuffer':
            return await res!.arrayBuffer();
        case 'formData':
            return await res!.formData();
        case 'response':
            return res!;
        case 'stream':
            return res!.body
        default:
            return await res!.text();
    }
}

/**
 *
 * @param res - Response object from fetch.
 * @param parseAs - Desired parsing type.
 * @param opts - Call-specific options.
 * @param useProgressApi - Determines call-specific whether the `ProgressAPI` should be used (see: {@link ProgressAPI}).
 * @param progressAPI - Config-level `ProgressAPI` (see: {@link ProgressAPI}).
 */
export const parseWithReader = async (
    res: Response,
    parseAs: ParseAs | undefined,
    opts: RequestOptions,
    useProgressApi: boolean,
    progressAPI?: ProgressAPI,
) => {
    const rs = res!.body;
    if (!rs) {
        return await fallbackParse(res!, parseAs);
    }

    const totalHeader = res!.headers.get('content-length');
    const total = totalHeader ? Number(totalHeader) : undefined;

    if (useProgressApi) {
        progressAPI?.start?.();
        if (!total) progressAPI?.set?.(null);
    }

    const reader = rs.getReader();
    let loaded = 0;

    try {
        if (parseAs === 'arrayBuffer') {
            const chunks: Uint8Array[] = [];
            for (; ;) {
                const {done, value} = await reader.read();
                if (done) break;
                if (value) {
                    chunks.push(value);
                    loaded += value.byteLength;
                    const percent = total ? Math.min(1, loaded / total) : null;
                    opts.onProgress?.({loaded, total, percent});
                    if (useProgressApi) progressAPI?.set?.(percent ?? null);
                }
            }

            if (opts?.debug) console.debug('[CALL] - reader (arrayBuffer):', {
                chunks,
                loaded,
                progressAPI,
            });

            const size = chunks.reduce((acc, c) => acc + c.byteLength, 0);
            const out = new Uint8Array(size);
            let offset = 0;
            for (const c of chunks) {
                out.set(c, offset);
                offset += c.byteLength;
            }
            return out.buffer;
        }
        if (parseAs === 'blob') {
            const parts: BlobPart[] = [];
            for (; ;) {
                const {done, value} = await reader.read();
                if (done) break;
                if (value) {
                    parts.push(value);
                    loaded += value.byteLength;
                    const percent = total ? Math.min(1, loaded / total) : null;
                    opts.onProgress?.({loaded, total, percent});
                    if (useProgressApi) progressAPI?.set?.(percent ?? null);
                }
            }

            if (opts?.debug) console.debug('[CALL] - reader (blob):', {
                parts,
                loaded,
                progressAPI,
            });

            const type = res!.headers.get('content-type') ?? undefined;
            return new Blob(parts, type ? {type} : {});
        }

        const decoder = new TextDecoder();
        let textAcc = '';
        for (; ;) {
            const {done, value} = await reader.read();
            if (done) break;
            if (value) {
                textAcc += decoder.decode(value, {stream: true});
                loaded += value.byteLength;
                const percent = total ? Math.min(1, loaded / total) : null;
                opts.onProgress?.({loaded, total, percent});
                if (useProgressApi) progressAPI?.set?.(percent ?? null);
            }
        }
        textAcc += decoder.decode();

        if (parseAs === 'json') {
            return textAcc ? JSON.parse(textAcc) : undefined;
        }

        return textAcc;
    } finally {
        if (useProgressApi && progressAPI && typeof progressAPI.done === 'function') {
            progressAPI.done();
        }
    }
}