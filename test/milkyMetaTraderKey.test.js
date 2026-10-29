import { afterEach, describe, expect, it, vi } from 'vitest';
import { readMilkyMetaTraderKey, saveMilkyMetaTraderKey, forgetMilkyMetaTraderKey } from '../src/milkyMetaTraderKey.js';

afterEach(()=>vi.unstubAllGlobals());
describe('MMT remembered access key',()=>{
  it('persists a key across reads and removes it explicitly',()=>{
    const data=new Map();
    vi.stubGlobal('localStorage',{
      getItem:key=>data.get(key)??null,
      setItem:(key,value)=>data.set(key,value),
      removeItem:key=>data.delete(key),
    });
    expect(readMilkyMetaTraderKey()).toBe('');
    expect(saveMilkyMetaTraderKey('test-key')).toBe(true);
    expect(readMilkyMetaTraderKey()).toBe('test-key');
    expect(forgetMilkyMetaTraderKey()).toBe(true);
    expect(readMilkyMetaTraderKey()).toBe('');
  });
  it('handles blocked browser storage without crashing or claiming success',()=>{
    const blocked=()=>{throw new Error('blocked');};
    vi.stubGlobal('localStorage',{getItem:blocked,setItem:blocked,removeItem:blocked});
    expect(readMilkyMetaTraderKey()).toBe('');
    expect(saveMilkyMetaTraderKey('test-key')).toBe(false);
    expect(forgetMilkyMetaTraderKey()).toBe(false);
  });
});
