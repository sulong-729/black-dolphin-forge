import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { KitError } from '../contracts/errors.js';
export class Cursors {
    private secret = randomBytes(32);
    sign(value: unknown) { const text = Buffer.from(JSON.stringify(value)).toString('base64url'); return text + '.' + createHmac('sha256', this.secret).update(text).digest('base64url'); }
    read(cursor: string): any { try {
        const [text, sig, ...rest] = cursor.split('.');
        if (rest.length || !text || !sig)
            throw Error();
        const expected = createHmac('sha256', this.secret).update(text).digest();
        const actual = Buffer.from(sig, 'base64url');
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
            throw Error();
        return JSON.parse(Buffer.from(text, 'base64url').toString());
    }
    catch {
        throw new KitError('CURSOR_MISMATCH', 'Invalid or foreign cursor');
    } }
}
