import {expect,it,vi} from 'vitest';
vi.mock('../src/chartColors.js',()=>({cssColor:()=> '#00ff00'}));
import {LiquidityLinePrimitive} from '../src/liquidity.js';
it('extends the TP hit area to the current pane edge after resize without changing ordinary liquidity lines',()=>{
 let width=900;
 const scale={width:()=>width,timeToCoordinate:t=>t/10},series={priceToCoordinate:()=>80};
 const line=new LiquidityLinePrimitive({price:2010,pivotTime:100,endTime:200},{extendToRight:true},[{time:100},{time:200}]);
 line.attached({chart:{timeScale:()=>scale},series,requestUpdate:()=>{}});line.updateAllViews();
 expect(line.distanceTo(899,80)).toBe(0);
 width=400;line.updateAllViews();expect(line.distanceTo(450,80)).toBe(50);
 const ordinary=new LiquidityLinePrimitive({price:2010,pivotTime:100,endTime:200},{},[{time:100},{time:200}]);
 ordinary.attached({chart:{timeScale:()=>scale},series,requestUpdate:()=>{}});ordinary.updateAllViews();
 expect(ordinary.distanceTo(30,80)).toBe(10);
});
