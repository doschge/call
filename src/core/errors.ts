import type { HttpMethod } from "./types.js";

export class CallError extends Error {
    status?: number;
    code?: string;
    data?: unknown;
    url?: string;
    method?: HttpMethod;
    response?: Response;
    cause?: unknown;

    constructor(message: string, init: Partial<CallError> = {}) {
        super(message);
        Object.assign(this, init);
        this.name = 'CallError';
    }
}

