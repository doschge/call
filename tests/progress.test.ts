import { describe, it, expect, vi } from 'vitest';
import { createCall } from '../src';

function streamFromChunks(chunks: string[]) {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            const enc = new TextEncoder();
            for (const c of chunks) controller.enqueue(enc.encode(c));
            controller.close();
        }
    });
}

function totalBytes(chunks: string[]) {
    const enc = new TextEncoder();
    return chunks.reduce((acc, c) => acc + enc.encode(c).byteLength, 0);
}

describe('Reader/Streaming + Progress', () => {
    it('streamt Text mit Content-Length, ruft Progress-API und onProgress auf', async () => {
        const chunks = ['hello ', 'world'];
        const body = streamFromChunks(chunks);
        const content = 'hello world';
        const res = new Response(body, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain',
                'Content-Length': String(new TextEncoder().encode(content).byteLength),
            },
        });

        const fetchMock = vi.fn().mockResolvedValue(res);
        const start = vi.fn();
        const set = vi.fn();
        const done = vi.fn();
        const onProgress = vi.fn();

        const call = createCall({
            fetch: fetchMock,
            progress: { start, set, done },
        });
        const data = await call.get<string>('https://api.test/stream-text', {
            parseAs: 'text',
            useProgressApi: true,
            onProgress
        });

        expect(data.content).toBe(content);
        expect(start).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledTimes(chunks.length);
        expect(done).toHaveBeenCalledTimes(1);

        const loadedCalls = onProgress.mock.calls.map((c) => c[0].loaded);
        expect(loadedCalls).toEqual([6, 11]);

        const percents = onProgress.mock.calls.map((c) => c[0].percent);
        expect(percents[0]).toBeGreaterThan(0.5);
        expect(percents[0]).toBeLessThan(0.6);
        expect(percents[1]).toBe(1);
    });

    it('streamt blob korrekt und übernimmt content-type', async () => {
        const chunks = ['hello', ' ', 'blob'];
        const body = streamFromChunks(chunks);
        const res = new Response(body, {
            status: 200,
            headers: {
                'Content-Type': 'application/custom-blob',
                'Content-Length': String(totalBytes(chunks)),
            },
        });

        const fetchMock = vi.fn().mockResolvedValue(res);
        const call = createCall({ fetch: fetchMock });
        const b = await call.get<Blob>('https://api.test/blob', {
            parseAs: 'blob',
            useProgressApi: true,
        });

        expect(b.content).toBeInstanceOf(Blob);
        expect(b.content!.type).toBe('application/custom-blob');
        expect(await b.content!.text()).toBe('hello blob');
    });

    it('steamt JSON und parst korrekt über TextDecoder', async () => {
        const chunks = ['{"a":1', ',"b":2}'];
        const body = streamFromChunks(chunks);
        const res = new Response(body, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': String(totalBytes(chunks)),
            },
        });

        const fetchMock = vi.fn().mockResolvedValue(res);
        const call = createCall({ fetch: fetchMock });
        const obj = await call.get<{ a: number; b: number }>('https://api.test/json', {
            parseAs: 'json',
            useProgressApi: true,
        });

        expect(obj.content).toEqual({ a: 1, b: 2 });
    });

    it('wirft CallError("Response parse error") bei ungültigem JSON im Stream und beendet Progress', async () => {
        const chunks = ["invalid", "-json"];
        const body = streamFromChunks(chunks);
        const res = new Response(body, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': String(totalBytes(chunks)),
            },
        });

        const fetchMock = vi.fn().mockResolvedValue(res);
        const start = vi.fn();
        const set = vi.fn();
        const done = vi.fn();

        const call = createCall({ fetch: fetchMock, progress: { start, set, done } });
        const p = call.get('http://api.test/bad-json', { parseAs: 'json', useProgressApi: true });

        await expect(p).rejects.toMatchObject({
            name: 'CallError',
            message: 'Response parse error',
        });

        expect(start).toHaveBeenCalledTimes(1);
        expect(done).toHaveBeenCalledTimes(1);
    });

    it('nutzt bei parseAs=response/stream KEIN integriertes Progress, selbst wenn useProgressApi=true', async () => {
        const res = new Response('ok', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });
        const fetchMock = vi.fn().mockResolvedValue(res);
        const start = vi.fn();
        const set = vi.fn();
        const done = vi.fn();

        const call = createCall({ fetch: fetchMock, progress: { start, set, done } });
        const outRes = await call.get<Response>('http://api.test/resp', { parseAs: 'response', useProgressApi: true });

        expect(outRes.content).toBe(res);
        expect(start).not.toHaveBeenCalled();
        expect(set).not.toHaveBeenCalled();
        expect(done).not.toHaveBeenCalled();

        const outStream = await call.get<ReadableStream<Uint8Array>>('http://api.test/stream', { parseAs: 'stream', useProgressApi: true });

        expect(outStream.content).toBe(res.body);
        expect(start).not.toHaveBeenCalled();
        expect(set).not.toHaveBeenCalled();
        expect(done).not.toHaveBeenCalled();
    });

    it('löst onProgress aus, ohne die integrierte Progress-API zu nutzen (useProgressApi=false)', async () => {
        const chunks = ['part1', 'part2'];
        const body = streamFromChunks(chunks);
        const res = new Response(body, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain',
                'Content-Length': String(totalBytes(chunks)),
            },
        });

        const fetchMock = vi.fn().mockResolvedValue(res);
        const start = vi.fn();
        const set = vi.fn();
        const done = vi.fn();
        const onProgress = vi.fn();

        const call = createCall({ fetch: fetchMock, progress: { start, set, done } });
        const data = await call.get<string>('http://api.test/text', { parseAs: 'text', onProgress });

        expect(data.content).toBe('part1part2');
        expect(onProgress).toHaveBeenCalled();
        expect(start).not.toHaveBeenCalled();
        expect(set).not.toHaveBeenCalled();
        expect(done).not.toHaveBeenCalled();
    });

    it('ruft Progress.done auch im HTTP-Fehlerfall auf (z.B. 404 mit Body)', async () => {
        const chunks = ['err', 'or'];
        const body = streamFromChunks(chunks);
        const res = new Response(body, {
            status: 404,
            headers: {
                'Content-Type': 'text/plain',
                'Content-Length': String(totalBytes(chunks)),
            },
        });

        const fetchMock = vi.fn().mockResolvedValue(res);
        const start = vi.fn();
        const set = vi.fn();
        const done = vi.fn();

        const call = createCall({ fetch: fetchMock, progress: { start, set, done } });
        const p = call.get('http://api.test/404', { parseAs: 'text', useProgressApi: true });

        await expect(p).rejects.toMatchObject({
            name: 'CallError',
            status: 404,
        });
        expect(start).toHaveBeenCalledTimes(1);
        expect(done).toHaveBeenCalledTimes(1);
    })
})