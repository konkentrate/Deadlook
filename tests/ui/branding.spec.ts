import {test,expect} from '@playwright/test';
test('eye corners and internal negative spaces are actually transparent',async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({json:{data:[],stale:false,fetchedAt:new Date().toISOString()}}));
 await page.goto('/');
 const pixels=await page.evaluate(async()=>{
  const img=new Image();img.src='/deadlook-eye.svg';await img.decode();
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0,96,96);
  const at=(x:number,y:number)=>Array.from(ctx.getImageData(x,y,1,1).data);
  return {corner:at(0,0),center:at(48,48),pupilGap:at(58,48),iris:at(53,49)};
 });
 expect(pixels.corner[3]).toBe(0);expect(pixels.center[3]).toBe(0);expect(pixels.pupilGap[3]).toBe(0);
 expect(pixels.iris).toEqual([105,231,153,255]);
});
test('all screens share the outlined brand and mobile sizing keeps the wordmark intact',async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({json:{data:[],stale:false,fetchedAt:new Date().toISOString()}}));
 for(const path of ['/','/builds.html','/analysis.html']){
  await page.goto(path);
  const brand=page.getByRole('link',{name:'Deadlook home',exact:true});
  await expect(brand.locator('.dl-brand-wordmark')).toHaveAttribute('src','/deadlook-wordmark.svg');
  expect(await brand.locator('img').evaluateAll(images=>images.every(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth>0))).toBe(true);
  await page.setViewportSize({width:375,height:812});
  const size=await brand.locator('.dl-brand-wordmark').boundingBox();
  expect(size!.width).toBeGreaterThan(100);expect(size!.height).toBeLessThan(30);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.screenshot({path:'/tmp/deadlook-brand-mobile.png'});
 await page.setViewportSize({width:1280,height:800});
 await page.locator('.navbar').screenshot({path:'/tmp/deadlook-brand-header.png'});
});
