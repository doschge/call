import { createCall } from '../src';

async function main() {
    const call = createCall({
        returnFields: ['status'],
        suppressError: true,
        retry: {
            onStatus: {
                500: {
                    attempts: 1,
                }
            }
        },
        on: {
            once: true,
        }
    });

    const res = await call.get('https://httpbin.org/status/500', {
        debug: true,
        on: {
            500:
            () => console.log('### Received 500 status code, retrying...'),

        }
    });
}
main().catch(console.error);