import { describe, it, expect } from "vitest";
import { createCall } from "../src";
import {ProgressInfo} from "../src/core/types";

const runNet = !!process.env.RUN_NET_TESTS;
const TIMEOUT = 30000;

const HOST = process.env.NET_HOST ?? 'https://httpbin.org';

(runNet ? describe : describe.skip)('Integration: Streaming/Progress', () => {
    const call = createCall();

    it('bytes: Content-Length vorhanden -> percent berechenbar', async () => {
        const bytesUrl = `${HOST}/bytes/1048576`;

        const headRes = await call.request<Response>(bytesUrl, {
            method: 'HEAD',
            parseAs: 'response',
            headers: { 'Accept-Encoding': 'identity' },
        });
        const totalHeader = headRes.headers!.get('content-length');
        expect(totalHeader).toBeTruthy();

        const expectedTotal = Number(totalHeader!);
        expect(expectedTotal).toBeGreaterThan(0);

        let last: ProgressInfo | null = null
        const ab = await call.get<ArrayBuffer>(bytesUrl, {
            parseAs: 'arrayBuffer',
            headers: { 'Accept-Encoding': 'identity' },
            onProgress: (info: ProgressInfo) => {last = info;},
        });

        expect(last).toBeTruthy();
        expect(last!.total).toBe(expectedTotal);
        expect(last!.percent).toBe(1);

        expect((ab.content as ArrayBuffer).byteLength).toBe(expectedTotal);
    }, TIMEOUT)

    it('stream-bytes:  indeterminierte Progress (percent=null) bei chunked', async () => {
        const candidates = [
            'https://httpbin.org/stream-bytes/300000?chunk_size=65536',
            'https://httpbingo.org/stream-bytes?n=300000&chunk_size=65536',
        ];

        let sawNull = false;
        let ok = false;

        for (const url of candidates) {
            try {
                await call.get<string>(url, {
                    parseAs: 'text',
                    onProgress: ({ percent }) => {
                        if (percent === null) sawNull = true;
                    },
                });
                ok = true;
                break;
            } catch (err: any) {
                if (err?.status === 404) continue;
                throw err;
            }
        }

        expect(ok).toBe(true);
        expect(sawNull).toBe(true);
    });
});