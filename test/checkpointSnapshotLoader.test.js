import {expect,it,vi} from 'vitest';
import {createCheckpointSnapshotLoader} from '../src/checkpointSnapshotLoader.js';
it('reads only the opened original snapshot once and keeps candidate and entry reads separate',async()=>{
  const repository={getSetupSnapshot:vi.fn(async()=>({id:'candidate',checklistHistory:{entries:[]}})),getSnapshot:vi.fn(async()=>({id:'entry'}))};
  const load=createCheckpointSnapshotLoader(repository),s={id:'candidate',runId:'run',entry:null};
  expect(repository.getSetupSnapshot).not.toHaveBeenCalled();
  await Promise.all([load(s),load(s)]);
  expect(repository.getSetupSnapshot).toHaveBeenCalledExactlyOnceWith('run','candidate');
  await load({...s});expect(repository.getSetupSnapshot).toHaveBeenCalledTimes(2);
  await load({id:'entry',runId:'run',entry:{}});expect(repository.getSnapshot).toHaveBeenCalledExactlyOnceWith('run','entry');
});
it('exposes a genuine read failure and allows an explicit retry',async()=>{
  const repository={getSetupSnapshot:vi.fn().mockRejectedValueOnce(new Error('Read failed')).mockResolvedValue({id:'candidate'})};
  const load=createCheckpointSnapshotLoader(repository),s={id:'candidate',runId:'run'};
  await expect(load(s)).rejects.toThrow('Read failed');await expect(load(s)).resolves.toEqual({id:'candidate'});
});
