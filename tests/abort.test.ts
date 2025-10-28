import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCall } from '../src';

function makeAbortAwareFetchMock() {
    return vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal as AbortSignal | undefined;

            const abort = () => {
                signal?.removeEventListener('abort', abort);
                reject(new DOMException('Aborted', 'AbortError'));
            };

            if (signal?.aborted) {
                abort();
                return;
            }

            signal?.addEventListener('abort', abort);
        })
    })
}

describe('Timeout/Abort', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    })
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    })

    it('bricht nach config.timeout ab und wirft CallError mit AbortError als cause', async () => {
        const fetchMock = makeAbortAwareFetchMock();
        const call = createCall({ fetch: fetchMock, timeout: 100 });

        const p = call.get('https://api.test/slow');
        p.catch(() => {});

        await vi.advanceTimersByTimeAsync(100);

        await expect(p).rejects.toMatchObject({
            name: 'CallError',
            cause: expect.objectContaining({ name: 'AbortError' }),
        });
    });

    it('per-call timeout überschreibt config.timeout', async () => {
        const fetchMock = makeAbortAwareFetchMock();
        const call = createCall({ fetch: fetchMock, timeout: 1000 });

        const p = call.get('https://api.test/slow', { timeout: 50 });
        p.catch(() => {});

        await vi.advanceTimersByTimeAsync(50);

        await expect(p).rejects.toMatchObject({
            name: 'CallError',
            cause: expect.objectContaining({name: 'AbortError'}),
        });
    });

    it('respektiert ein eingehendes AbortSignal ohne Timer', async () => {
        const fetchMock = makeAbortAwareFetchMock();
        const call = createCall({ fetch: fetchMock });

        const ac = new AbortController();
        const p = call.get('https://api.test/slow', { signal: ac.signal });
        p.catch(() => {});

        ac.abort();

        await expect(p).rejects.toMatchObject({
            name: 'CallError',
            cause: expect.objectContaining({ name: 'AbortError' }),
        });
    });
});