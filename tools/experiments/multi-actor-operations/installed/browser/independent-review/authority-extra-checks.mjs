import { expect } from '@playwright/test';
export async function browserChecks(page,url,evidence){
 const results=[],errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 const button=name=>page.getByRole('button',{name,exact:true}),field=name=>page.getByTestId(name);
 async function reviewed(){await button('Propose via AG-UI').click();await expect(field('phase')).toHaveText('draft');await button('Review').click();await expect(field('phase')).toHaveText('reviewed');await expect(button('Apply reviewed')).toBeEnabled();}
 async function check(name,body){const start=errors.length;try{await page.goto(url);await expect(field('phase')).toHaveText('idle');await body();expect(errors.slice(start)).toEqual([]);results.push({name,outcome:'PASS'});}catch(e){results.push({name,outcome:'FAIL',error:String(e),pageErrors:errors.slice(start),dom:await page.locator('body').innerText()});await page.screenshot({path:`${evidence}/extra-${results.length}.png`});}}
 await check('lost rejection receipt retains grant, then revokes before local-only overlap recovery',async()=>{
  await reviewed();await button('Create overlapping route work').click();await expect(field('pending')).toHaveText(/^\d+,\d+$/);
  await button('Fail next persistence').click();await button('Lose next acknowledgment').click();await button('Apply reviewed').click();
  await expect(field('phase')).toHaveText('uncertain');await expect(field('grant-count')).toHaveText('1');await expect(field('commits')).toHaveText('0');
  await button('Retry receipt').click();await expect(field('phase')).toHaveText('local-pending');await expect(field('server-outcome')).toHaveText('rejected');await expect(field('grant-count')).toHaveText('0');
  await button('Resolve overlapping route work').click();await button('Retry local settlement').click();await expect(field('phase')).toHaveText('failed');await expect(field('deliveries')).toHaveText('2');await expect(field('commits')).toHaveText('0');await expect(field('pending')).toBeEmpty();
  await button('Dispose session').click();await expect(field('gate-disposed')).toHaveText('true');await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');
 });
 await check('unsent reject retains overlap recovery without minting grant or delivering',async()=>{
  await reviewed();await button('Create overlapping route work').click();await expect(field('pending')).toHaveText(/^\d+,\d+$/);await button('Reject proposal').click();
  await expect(field('phase')).toHaveText('local-pending');await expect(field('server-outcome')).toHaveText('none');await expect(field('grant-count')).toHaveText('0');await expect(field('deliveries')).toHaveText('0');
  await button('Resolve overlapping route work').click();await button('Retry local settlement').click();await expect(field('phase')).toHaveText('rejected');await expect(field('pending')).toBeEmpty();await expect(field('route')).toHaveText('north');
  await reviewed();await button('Apply reviewed').click();await expect(field('phase')).toHaveText('succeeded');await expect(field('commits')).toHaveText('1');await expect(field('deliveries')).toHaveText('1');
 });
 await check('same-turn duplicate apply mints one usable grant and commits once',async()=>{
  await reviewed();await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Apply reviewed');b.click();b.click();});
  await expect(field('phase')).toHaveText('succeeded');await expect(field('deliveries')).toHaveText('1');await expect(field('commits')).toHaveText('1');await expect(field('grant-count')).toHaveText('0');
 });
 await check('concurrent capacity ABA rejects bound observation and releases grant',async()=>{
  await reviewed();await page.evaluate(()=>{const click=name=>[...document.querySelectorAll('button')].find(b=>b.textContent===name).click();click('External capacity ABA');click('Apply reviewed');});
  await expect(field('server-version')).toHaveText('2');await expect(field('phase')).toHaveText('failed');await expect(field('server-outcome')).toHaveText('rejected');await expect(field('grant-count')).toHaveText('0');await expect(field('commits')).toHaveText('2');await expect(field('route')).toHaveText('north');await expect(field('pending')).toBeEmpty();
 });
 await check('accepted proposal does not erase later local work or allow its disposal',async()=>{
  await reviewed();await button('Create overlapping route work').click();await expect(field('pending')).toHaveText(/^\d+,\d+$/);await button('Apply reviewed').click();
  await expect(field('phase')).toHaveText('succeeded');await expect(field('server-outcome')).toHaveText('applied');await expect(field('local-outcome')).toHaveText('confirmed');await expect(field('route')).toHaveText('east');await expect(field('server-route')).toHaveText('west');await expect(field('pending')).toHaveText(/^\d+$/);await expect(field('grant-count')).toHaveText('0');
  await button('Dispose session').click();await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 0');await button('Resolve overlapping route work').click();await expect(field('route')).toHaveText('west');await expect(field('pending')).toBeEmpty();await button('Dispose session').click();await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');
 });
 return {results,pageErrors:errors,consoleErrors};
}
