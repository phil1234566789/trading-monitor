import {it,expect} from 'vitest';
import {createSSRApp,h} from 'vue';
import {renderToString} from '@vue/server-renderer';
import {createMemoryHistory,createRouter,RouterLink} from 'vue-router';
import ActionButton from '../src/components/ui/ActionButton.vue';
it('retains default and explicit submit button types',async()=>{
 expect(await renderToString(createSSRApp(()=>h(ActionButton,null,()=> 'Go')))).toContain('type="button"');
 expect(await renderToString(createSSRApp(()=>h(ActionButton,{type:'submit'},()=> 'Go')))).toContain('type="submit"');
});
it('reuses button styling on one safe new-tab router link',async()=>{
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{render:()=>null}}]});
 await router.push('/');
 const app=createSSRApp(()=>h(ActionButton,{as:RouterLink,to:{path:'/',query:{journalTrade:156,instrument:'EURUSD'}},target:'_blank',rel:'noopener noreferrer'},()=> 'DR #131'));
 app.use(router);const html=await renderToString(app);
 expect(html).toContain('<a');expect(html).toContain('ui-action-btn');expect(html).toContain('target="_blank"');expect(html).toContain('rel="noopener noreferrer"');expect(html).toContain('journalTrade=156');expect(html).not.toContain('<button');expect(html).not.toContain('type="button"');
});
