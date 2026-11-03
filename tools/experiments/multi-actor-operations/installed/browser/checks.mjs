import { expect } from '@playwright/test';
export async function browserChecks(page, url, evidence) {
 const results=[];
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 const button=name=>page.getByRole('button',{name,exact:true});
 const field=name=>page.getByTestId(name);
 const propose=async()=>{await button('Propose via AG-UI').click();await expect(field('phase')).toHaveText('draft');};
 const review=async()=>{await button('Review').click();await expect(field('phase')).toHaveText('reviewed');};
 const apply=async()=>button('Apply reviewed').click();
 async function check(name,body){
  const before=errors.length;
  try{await page.goto(url);await expect(field('phase')).toHaveText('idle');await body();expect(errors.slice(before)).toEqual([]);results.push({name,outcome:'PASS'});}
  catch(error){await page.screenshot({path:`${evidence}/${results.length}-failure.png`,fullPage:true}).catch(()=>{});results.push({name,outcome:'FAIL',error:String(error),pageErrors:errors.slice(before)});}
 }
 await check('AG-UI draft needs review/apply; server receipt and native settlement remain separate',async()=>{
  await expect(button('Apply reviewed')).toBeDisabled();await propose();
  await expect(field('route')).toHaveText('west');await expect(field('server-route')).toHaveText('north');await expect(field('commits')).toHaveText('0');await expect(field('actor')).toHaveText('unknown');await expect(field('pending')).not.toBeEmpty();await expect(button('Apply reviewed')).toBeDisabled();
  await review();await expect(field('review')).toContainText('"capacity":0');await expect(field('commits')).toHaveText('0');await apply();
  await expect(field('phase')).toHaveText('succeeded');await expect(field('server-route')).toHaveText('west');await expect(field('commits')).toHaveText('1');await expect(field('pending')).toBeEmpty();await expect(button('Apply reviewed')).toBeDisabled();
  await page.screenshot({path:`${evidence}/accepted.png`,fullPage:true});
 });
 await check('rejecting a reviewed proposal preserves an independent note without server execution',async()=>{
  await propose();await review();await page.getByLabel('Independent note').fill('keep human note');await button('Reject proposal').click();await expect(field('phase')).toHaveText('rejected');await expect(field('route')).toHaveText('north');await expect(field('note')).toHaveText('keep human note');await expect(field('server-route')).toHaveText('north');await expect(field('commits')).toHaveText('0');await expect(field('pending')).toBeEmpty();
 });
 await check('stale authoritative input version rejects ABA after review and preserves note',async()=>{
  await propose();await review();await page.getByLabel('Independent note').fill('keep on conflict');await button('External capacity ABA').click();await expect(field('server-version')).toHaveText('2');await expect(field('capacity')).toHaveText('10');await expect(button('Apply reviewed')).toBeEnabled();await apply();await expect(field('phase')).toHaveText('failed');await expect(field('message')).toContainText('conflict');await expect(field('route')).toHaveText('north');await expect(field('note')).toHaveText('keep on conflict');await expect(field('commits')).toHaveText('2');await expect(field('pending')).toBeEmpty();
 });
 await check('definitive persistence error rolls back locally without a server commit',async()=>{
  await propose();await review();await button('Fail next persistence').click();await apply();await expect(field('phase')).toHaveText('failed');await expect(field('message')).toContainText('persistence');await expect(field('route')).toHaveText('north');await expect(field('server-route')).toHaveText('north');await expect(field('commits')).toHaveText('0');await expect(field('pending')).toBeEmpty();
 });
 await check('lost acknowledgment retains authority; disposal refuses; retry commits once',async()=>{
  await propose();await review();const pending=await field('pending').textContent();expect(pending).not.toBe('');await button('Lose next acknowledgment').click();await apply();await expect(field('phase')).toHaveText('uncertain');await expect(field('pending')).toHaveText(pending);await expect(field('commits')).toHaveText('1');await expect(field('server-route')).toHaveText('west');await button('Dispose session').click();await expect(field('phase')).toHaveText('uncertain');await expect(field('message')).toContainText('Resolve');await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 0');await button('Retry receipt').click();await expect(field('phase')).toHaveText('succeeded');await expect(field('commits')).toHaveText('1');await expect(field('pending')).toBeEmpty();
 });
 await check('disposing an unsent draft rejects it and destroys tree exactly once',async()=>{
  await propose();await button('Dispose session').click();await expect(field('phase')).toHaveText('disposed');await expect(field('pending')).toBeEmpty();await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');await expect(field('commits')).toHaveText('0');await expect(button('Propose via AG-UI')).toBeDisabled();await expect(button('Dispose session')).toBeDisabled();await expect(page.getByLabel('Independent note')).toHaveCount(0);
 });
 await check('settled session disposes without erasing accepted server state',async()=>{
  await propose();await review();await apply();await expect(field('phase')).toHaveText('succeeded');await button('Dispose session').click();await expect(field('phase')).toHaveText('disposed');await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');await expect(field('server-route')).toHaveText('west');await expect(field('commits')).toHaveText('1');
 });
 await check('terminal rejection retains local authority; overlap resolution enables local-only retry',async()=>{
  await propose();await review();await page.getByLabel('Independent note').fill('keep recovery note');
  const original=await field('pending').textContent();expect(original).not.toBe('');
  await button('Create overlapping route work').click();await expect(field('pending')).toHaveText(/^\d+,\d+$/);const both=await field('pending').textContent();expect(both.split(',')).toHaveLength(2);
  await button('Fail next persistence').click();await apply();
  await expect(field('phase')).toHaveText('local-pending');await expect(field('server-outcome')).toHaveText('rejected');await expect(field('local-outcome')).toHaveText('pending');
  await expect(field('pending')).toHaveText(both);await expect(field('route')).toHaveText('east');await expect(field('deliveries')).toHaveText('1');await expect(field('commits')).toHaveText('0');
  await expect(button('Retry receipt')).toBeDisabled();await expect(button('Apply reviewed')).toBeDisabled();
  await button('Retry local settlement').click();await expect(field('phase')).toHaveText('local-pending');await expect(field('pending')).toHaveText(both);await expect(field('deliveries')).toHaveText('1');
  await button('Dispose session').click();await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 0');await expect(field('message')).toContainText('responsibility retained');
  await button('Resolve overlapping route work').click();await expect(field('pending')).toHaveText(original);
  await button('Retry local settlement').click();await expect(field('phase')).toHaveText('failed');await expect(field('local-outcome')).toHaveText('rolled-back');await expect(field('server-outcome')).toHaveText('rejected');
  await expect(field('pending')).toBeEmpty();await expect(field('route')).toHaveText('north');await expect(field('note')).toHaveText('keep recovery note');await expect(field('deliveries')).toHaveText('1');await expect(field('commits')).toHaveText('0');
  await expect(button('Propose via AG-UI')).toBeEnabled();await expect(button('Retry local settlement')).toBeDisabled();
  await button('Dispose session').click();await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');
 });
 await check('post-terminal removal observer error is reported without retry or lost terminal outcome',async()=>{
  await button('Arm rollback observer failure').click();await expect(field('observer-armed')).toHaveText('true');
  await propose();await review();await button('Fail next persistence').click();await apply();
  await expect(field('phase')).toHaveText('failed');await expect(field('server-outcome')).toHaveText('rejected');await expect(field('local-outcome')).toHaveText('rolled-back');await expect(field('pending')).toBeEmpty();
  await expect(field('message')).toContainText('observer error after terminal rolled-back');await expect(field('message')).toContainText('adversarial removal observer');await expect(field('deliveries')).toHaveText('1');await expect(field('commits')).toHaveText('0');
  await expect(button('Retry local settlement')).toBeDisabled();await expect(button('Retry receipt')).toBeDisabled();await expect(button('Propose via AG-UI')).toBeEnabled();
  await button('Dispose session').click();await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');
 });
 await check('protocol and forged transport context cannot mint consent; missing server grant blocks application',async()=>{
  await propose();await review();await expect(field('grant-count')).toHaveText('0');
  await button('Try transport consent forgery').click();await expect(field('gate-check')).toContainText('Invalid dispatch arguments');await expect(field('gate-check')).toContainText('Reviewer unauthorized');
  await expect(field('grant-count')).toHaveText('0');await expect(field('commits')).toHaveText('0');await expect(field('phase')).toHaveText('reviewed');
  await button('Try apply without server grant').click();await expect(field('gate-check')).toContainText('Missing or mismatched server approval');await expect(field('commits')).toHaveText('0');await expect(field('server-route')).toHaveText('north');
  await apply();await expect(field('phase')).toHaveText('succeeded');await expect(field('commits')).toHaveText('1');await expect(field('grant-count')).toHaveText('0');
 });
 await check('uncertain command retains its capped grant and owner until receipt retry then releases capacity',async()=>{
  await propose();await review();await button('Lose next acknowledgment').click();await apply();await expect(field('phase')).toHaveText('uncertain');await expect(field('grant-count')).toHaveText('1');
  await button('Try second grant at capacity').click();await expect(field('gate-check')).toContainText('Approval capacity reached');await expect(field('grant-count')).toHaveText('1');
  await button('Dispose session').click();await expect(field('gate-disposed')).toHaveText('false');await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 0');await expect(field('grant-count')).toHaveText('1');
  await button('Retry receipt').click();await expect(field('phase')).toHaveText('succeeded');await expect(field('deliveries')).toHaveText('2');await expect(field('commits')).toHaveText('1');await expect(field('grant-count')).toHaveText('0');
  await propose();await review();await apply();await expect(field('phase')).toHaveText('succeeded');await expect(field('grant-count')).toHaveText('0');await expect(field('commits')).toHaveText('2');
  await button('Dispose session').click();await expect(field('gate-disposed')).toHaveText('true');await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');
 });
 await check('terminal receipt revokes grant while local recovery retains owner and never resends',async()=>{
  await propose();await review();await button('Create overlapping route work').click();await expect(field('pending')).toHaveText(/^\d+,\d+$/);
  await button('Fail next persistence').click();await apply();await expect(field('phase')).toHaveText('local-pending');await expect(field('grant-count')).toHaveText('0');await expect(field('server-outcome')).toHaveText('rejected');
  await button('Dispose session').click();await expect(field('gate-disposed')).toHaveText('false');await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 0');
  await button('Resolve overlapping route work').click();await button('Retry local settlement').click();await expect(field('phase')).toHaveText('failed');await expect(field('deliveries')).toHaveText('1');await expect(field('commits')).toHaveText('0');
  await button('Dispose session').click();await expect(field('gate-disposed')).toHaveText('true');await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');
 });
 await check('human and declared embedded proposals share review, authority and local settlement',async()=>{
  await page.getByLabel('Requested route',{exact:true}).fill('south');await button('Propose requested route').click();
  await expect(field('phase')).toHaveText('draft');await expect(field('route')).toHaveText('south');await expect(field('actor')).toHaveText('unknown');await expect(field('commits')).toHaveText('0');await expect(field('grant-count')).toHaveText('0');await expect(button('Apply reviewed')).toBeDisabled();
  await review();await expect(field('review')).toContainText('"route":"south"');await apply();await expect(field('phase')).toHaveText('succeeded');await expect(field('server-route')).toHaveText('south');await expect(field('local-outcome')).toHaveText('confirmed');await expect(field('pending')).toBeEmpty();
  await button('Start embedded producer').click();await expect(field('producer-status')).toHaveText('awaiting completion');await expect(field('pending')).toBeEmpty();await expect(field('grant-count')).toHaveText('0');await expect(field('commits')).toHaveText('1');await expect(button('Propose requested route')).toBeDisabled();
  await button('Complete embedded producer').click();await expect(field('phase')).toHaveText('draft');await expect(field('actor')).toHaveText('declared: deterministic-dispatch (not authenticated)');await expect(field('route')).toHaveText('west');await expect(field('server-route')).toHaveText('south');await expect(field('grant-count')).toHaveText('0');await expect(button('Apply reviewed')).toBeDisabled();
  await review();await expect(field('review')).toContainText('"route":"west"');await button('Lose next acknowledgment').click();await apply();await expect(field('phase')).toHaveText('uncertain');await expect(field('grant-count')).toHaveText('1');await expect(field('commits')).toHaveText('2');
  await button('Retry receipt').click();await expect(field('phase')).toHaveText('succeeded');await expect(field('commits')).toHaveText('2');await expect(field('deliveries')).toHaveText('3');await expect(field('pending')).toBeEmpty();await expect(field('grant-count')).toHaveText('0');await expect(field('local-outcome')).toHaveText('confirmed');
 });
 await check('delayed embedded completion keeps its observed versions and rejects changed input without losing a note',async()=>{
  await button('Start embedded producer').click();await expect(field('producer-status')).toHaveText('awaiting completion');
  const packet=JSON.parse(await field('producer-observation').textContent());expect(packet.values.capacity).toBe(10);expect(packet.versions.capacity).toBe(0);
  await button('External capacity to zero').click();await expect(field('server-version')).toHaveText('1');await expect(field('capacity')).toHaveText('0');await expect(field('pending')).toBeEmpty();
  await page.getByLabel('Independent note').fill('keep delayed note');await button('Complete embedded producer').click();await expect(field('phase')).toHaveText('draft');await expect(field('actor')).toHaveText('declared: deterministic-dispatch (not authenticated)');await expect(field('route')).toHaveText('west');
  await review();const reviewed=JSON.parse(await field('review').textContent());expect(reviewed.expected.capacity).toBe(packet.versions.capacity);expect(reviewed.patch.route).toBe(packet.values.capacity>=10?'west':'south');
  await apply();await expect(field('phase')).toHaveText('failed');await expect(field('server-outcome')).toHaveText('rejected');await expect(field('message')).toContainText('conflict');await expect(field('route')).toHaveText('north');await expect(field('server-route')).toHaveText('north');await expect(field('note')).toHaveText('keep delayed note');await expect(field('commits')).toHaveText('1');await expect(field('deliveries')).toHaveText('1');await expect(field('pending')).toBeEmpty();await expect(field('grant-count')).toHaveText('0');
  await button('Start embedded producer').click();await button('Complete embedded producer').click();await expect(field('phase')).toHaveText('draft');await expect(field('route')).toHaveText('south');await review();await apply();await expect(field('phase')).toHaveText('succeeded');await expect(field('server-route')).toHaveText('south');await expect(field('commits')).toHaveText('2');
 });
 await check('in-session disposal cancels a producer before proposal without creating late authority',async()=>{
  await button('Start embedded producer').click();await expect(field('producer-status')).toHaveText('awaiting completion');await expect(field('pending')).toBeEmpty();
  await button('Dispose session').click();await expect(field('phase')).toHaveText('disposed');await expect(field('producer-status')).toHaveText('cancelled before proposal');await expect(button('Complete embedded producer')).toBeDisabled();await expect(button('Start embedded producer')).toBeDisabled();await expect(field('destroyed')).toHaveText('Tree cleanup callbacks: 1');await expect(field('gate-disposed')).toHaveText('true');await expect(field('grant-count')).toHaveText('0');await expect(field('commits')).toHaveText('0');await expect(field('deliveries')).toHaveText('0');
 });
 return {results,pageErrors:errors};
}
