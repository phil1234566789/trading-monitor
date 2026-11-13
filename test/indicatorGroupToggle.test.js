import {expect,it} from 'vitest';
import {ref} from 'vue';
import {toggleIndicatorGroup} from '../src/indicatorGroupToggle.js';
it('restores an old persisted snapshot without enabling a newly appended DOB toggle',()=>{
  const refs=[ref(false),ref(false),ref(false)],saved=ref([true,false]);
  expect(toggleIndicatorGroup(refs,saved)).toBe(true);expect(refs.map(r=>r.value)).toEqual([true,false,false]);expect(saved.value).toBe(null);
});
it('preserves mixed visibility including DOB through hide, reload and restore',()=>{
  const refs=[ref(true),ref(false),ref(true)],saved=ref(null);toggleIndicatorGroup(refs,saved);
  expect(refs.map(r=>r.value)).toEqual([false,false,false]);const reloaded=ref(JSON.parse(JSON.stringify(saved.value)));
  toggleIndicatorGroup(refs,reloaded);expect(refs.map(r=>r.value)).toEqual([true,false,true]);
});
it('leaves the existing caller fallback responsible for factory defaults',()=>{
  const refs=[ref(false)],saved=ref(null);expect(toggleIndicatorGroup(refs,saved)).toBe(false);expect(refs[0].value).toBe(false);
});
