import {createHash} from 'node:crypto';
export const evidenceHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

const canonical=value=>Array.isArray(value)?value.map(canonical):value && typeof value==='object'
 ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
// Nur neue Inputrevisionen werden kanonisch gehasht; bestehende Konfig-/Payload-IDs bleiben unverändert.
export const priceInputHash=value=>evidenceHash(canonical(value));
