import { describe, vi, it, expect } from "vitest";
import { createCall } from "../src";
import {returnFields, ReturnFieldsEnum} from "../src/core/types";

const fetchMockSuccess = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
);

const fetchMockFailure = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: 'Bad request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
    })
)

describe('Rückgabe-Felder', () => {
    it('enthält alle Felder (ohne error), wenn returnFields: undefined', async () => {
        const c = createCall({ fetch: fetchMockSuccess, suppressError: false });
        const res = await c.get('https://api.test/fields1');
        expect(Object.keys(res).sort())
            .toEqual(Array.from(returnFields).filter((f) => f !== 'error').sort());
    });

    it('enthält alle Felder (mit error), wenn returnFields: undefined', async () => {
        const c = createCall({ fetch: fetchMockFailure, suppressError: true });
        const res = await c.get('https://api.test/fields1');
        expect(Object.keys(res).sort()).toEqual(Array.from(returnFields).sort());
    });

    it('enthält alle Felder außer content, wenn returnFields in config ["content"]', async () => {
        const selectedFields: ReturnFieldsEnum[] = ['content'];
        const c = createCall({ fetch: fetchMockFailure, suppressError: true, returnFields: selectedFields });
        const res = await c.get('https://api.test/fields1');
        expect(Object.keys(res).sort()).toEqual(selectedFields.sort());
    });

    it('enthält alle Felder außer content, wenn returnFields in opts ["content"]', async () => {
        const selectedFields: ReturnFieldsEnum[] = ['content'];
        const c = createCall({ fetch: fetchMockFailure, suppressError: true });
        const res = await c.get('https://api.test/fields1', { returnFields: selectedFields });
        expect(Object.keys(res).sort()).toEqual(selectedFields.sort());
    });

    it('returnFields in opts überschreibt config', async () => {
        const selectedFields: ReturnFieldsEnum[] = ['content'];
        const c = createCall({ fetch: fetchMockFailure, suppressError: true, returnFields: ['headers', 'method'] });
        const res = await c.get('https://api.test/fields1', { returnFields: selectedFields });
        expect(Object.keys(res).sort()).toEqual(selectedFields.sort());
    });
})