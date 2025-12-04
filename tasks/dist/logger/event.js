import { v4 as uuidv4 } from 'uuid';
// This function is pulled directly from the d64 module:
// https://github.com/dominictarr/d64
// That module hasn't been updated in 8 years, and misuses the Buffer package.
// See issue here: https://github.com/google/eventid-js/issues/160
const chars = '.PYFGCRLAOEUIDHTNSQJKXBMWVZ_pyfgcrlaoeuidhtnsqjkxbmwvz1234567890'.split('').sort().join('');
function encode(data) {
    let s = '';
    const l = data.length;
    let hang = 0;
    for (let i = 0; i < l; i++) {
        const v = data[i];
        switch (i % 3) {
            case 0:
                s += chars[v >> 2];
                hang = (v & 3) << 4;
                break;
            case 1:
                s += chars[hang | (v >> 4)];
                hang = (v & 0xf) << 2;
                break;
            case 2:
                s += chars[hang | (v >> 6)];
                s += chars[v & 0x3f];
                hang = 0;
                break;
        }
    }
    if (l % 3)
        s += chars[hang];
    return s;
}
export class EventId {
    b;
    constructor() {
        this.b = new Uint8Array(24);
        uuidv4(undefined, this.b, 8);
    }
    new() {
        for (let i = 7; i >= 0; i--) {
            if (this.b[i] !== 255) {
                this.b[i]++;
                break;
            }
            this.b[i] = 0;
        }
        return encode(this.b);
    }
}
