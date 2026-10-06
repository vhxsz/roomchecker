import {test,expect,type Page} from '@playwright/test';

// UI-only fixtures; production Supabase is never contacted or mutated.
const dean={id:'00000000-0000-4000-8000-000000000001',role:'dean',full_name:'Dean Morgan',email:'dean@kingsway.college',student_code:'KWC-D'};
const student={id:'00000000-0000-4000-8000-000000000002',role:'student',full_name:'Alex Student',email:'alex@kingsway.college',student_code:'KWC-A',age:17,grade:'Grade 11',nationality:'Canadian'};
const checker={id:'00000000-0000-4000-8000-000000000003',role:'checker',full_name:'Jamie Checker',email:'checker@kingsway.college',student_code:'KWC-C'};
const floor={id:'f1',hall:'North Hall',floor_number:1,label:'First floor'};
const room={id:'r1',floor_id:'f1',room_number:'101',capacity:2,checker_id:checker.id,active:true};
const template={id:'t1',name:'Night Check',check_time:'22:00:00',days_of_week:[0,1,2,3,4,5,6],grace_minutes:20,active:true};

async function session(page:Page,role='dean'){
 const profile=role==='student'?student:role==='checker'?checker:dean;
 const user={id:profile.id,email:profile.email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'google'},identities:[{provider:'google',identity_data:{email:profile.email,email_verified:true}}],user_metadata:{},created_at:new Date().toISOString()};
 const payload={sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated',amr:[{method:'oauth'}]};
 const token=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.test';
 const value='base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'test-refresh',expires_at:payload.exp,expires_in:3600,token_type:'bearer',user})).toString('base64url');
 await page.context().addCookies([{name:'sb-roomchecker-test-auth-token',value,domain:'localhost',path:'/'}]);
 await page.route('https://roomchecker-test.supabase.co/**',async route=>{
  const url=route.request().url();
  await route.fulfill({json:url.includes('/auth/v1/user')?user:profile});
 });
 const data={viewerId:dean.id,profiles:[{...dean},{...student},{...checker}],floors:[floor],rooms:[{...room}],assignments:[{id:'a1',room_id:room.id,student_id:student.id,active:true}],templates:[{...template}],events:[],verifications:[]};
 await page.route('**/api/admin/bootstrap',route=>route.fulfill({json:data}));
 await page.route('**/api/residence/requests',route=>route.fulfill({json:{requests:[]}}));
 return data;
}

test('Dean promotes residents and assigns individual rooms or an entire floor',async({page})=>{
 const data=await session(page);
 const actions:Record<string,unknown>[]=[];
 await page.route('**/api/admin/manage',async route=>{const body=route.request().postDataJSON();actions.push(body);if(body.action==='set_role')data.profiles.find(p=>p.id===body.id)!.role=body.role;await route.fulfill({json:{data:{id:body.id}}});});
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/admin');
 await page.getByRole('button',{name:'Users & Roles',exact:true}).click();
 const row=page.getByRole('row').filter({hasText:'Alex Student'});
 await row.locator('select').selectOption('checker');
 await expect(row.locator('select')).toHaveValue('checker');
 await row.getByRole('button',{name:'Assign rooms'}).click();
 await page.getByRole('button',{name:'North Hall · First floor',exact:true}).click();
 await expect(page.locator('.room-check-grid input')).toBeChecked();
 await page.getByRole('button',{name:'Save assignments',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Assign checker rooms'})).toHaveCount(0);
 expect(actions[0]).toMatchObject({action:'set_role',id:student.id,role:'checker'});
 expect(actions[1]).toMatchObject({action:'set_checker_rooms',checkerId:student.id,roomIds:['r1']});
 await page.getByRole('button',{name:'Students',exact:true}).click();
 await expect(page.getByRole('row').filter({hasText:'Alex Student'})).toContainText('Grade 11');
});

test('Failed assignment stays visible in the modal and can be retried',async({page})=>{
 await session(page);
 await page.route('**/api/admin/manage',route=>route.fulfill({status:409,json:{error:'Select existing active rooms'}}));
 await page.goto('/admin');await page.getByRole('button',{name:'Users & Roles',exact:true}).click();
 await page.getByRole('row').filter({hasText:'Jamie Checker'}).getByRole('button',{name:'101',exact:true}).click();
 await page.getByRole('button',{name:'Save assignments'}).click();
 await expect(page.locator('.live-modal [role="alert"]')).toHaveText('Select existing active rooms');
 await expect(page.getByRole('button',{name:'Save assignments'})).toBeEnabled();
});

test('Dean edits a schedule and a room without creating duplicates',async({page})=>{
 await session(page);const actions:Record<string,unknown>[]=[];
 await page.route('**/api/admin/manage',async route=>{actions.push(route.request().postDataJSON());await route.fulfill({json:{data:{id:'t1'}}});});
 await page.goto('/admin');await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByTitle('Edit schedule').click();
 await page.getByLabel('Start time').fill('21:45');
 await page.getByRole('button',{name:'Save schedule',exact:true}).click();
 expect(actions[0]).toMatchObject({action:'save_schedule',id:'t1',time:'21:45'});
 await page.getByRole('button',{name:'Rooms',exact:true}).click();await page.getByTitle('Edit room', {exact:true}).click();
 await page.getByLabel('Capacity', {exact:true}).fill('3');await page.getByRole('button',{name:'Save room',exact:true}).click();
 expect(actions[1]).toMatchObject({action:'update_room',id:'r1',capacity:'3'});
});

test('Dean sees their own resident account, assigns a room and opens My QR',async({page})=>{
 await session(page);const actions:Record<string,unknown>[]=[];
 await page.route('**/api/admin/manage',async route=>{actions.push(route.request().postDataJSON());await route.fulfill({json:{data:{id:'a-dean'}}});});
 await page.goto('/admin');
 await expect(page.getByText('Accounts').locator('..')).toContainText('3');
 await page.getByRole('button',{name:'Students',exact:true}).click();
 const deanRow=page.getByRole('row').filter({hasText:'Dean Morgan (You)'});
 await expect(deanRow).toBeVisible();await deanRow.locator('select').selectOption('r1');
 await expect.poll(()=>actions.length).toBe(1);
 expect(actions[0]).toMatchObject({action:'assign_student',studentId:dean.id,roomId:'r1'});
 await page.route('**/api/student/qr',route=>route.fulfill({json:{token:'dean-test-qr',roomNumber:'101',roomId:'r1',expiresAt:Math.floor(Date.now()/1000)+30}}));
 await page.route('**/api/student/history',route=>route.fulfill({json:{records:[]}}));
 await page.getByRole('link',{name:'My QR'}).click();await expect(page).toHaveURL('/student');
 await expect(page.locator('canvas')).toBeVisible();await expect(page.getByRole('link',{name:'Dean dashboard'})).toBeVisible();
});

test('Maintenance requests submit and the Dean resolves them',async({page})=>{
 await session(page);let submitted:Record<string,unknown>;let resolved=false;
 await page.route('**/api/residence/requests',async route=>{
  if(route.request().method()==='POST'){submitted=route.request().postDataJSON();resolved=submitted.action==='update';await route.fulfill({json:{request:{id:'m1'}}});}
  else await route.fulfill({json:{requests:[{id:'m1',title:'Broken lamp',description:'The desk lamp does not turn on.',priority:'normal',status:resolved?'resolved':'open',resolution:resolved?'Replaced lamp':null,created_at:new Date().toISOString(),rooms:{room_number:'101'},profiles:{full_name:'Alex Student'}}]}});
 });
 await page.goto('/admin');await page.getByRole('button',{name:'Maintenance',exact:true}).click();
 await page.getByLabel('Issue', {exact:true}).fill('Broken door handle');
 await page.getByLabel('Description').fill('The door handle is loose and needs repair.');await page.getByRole('button',{name:'Submit request'}).click();
 await expect(page.getByLabel('Issue', {exact:true})).toHaveValue('');expect(submitted!).toMatchObject({roomId:'r1',title:'Broken door handle'});
 page.on('dialog',dialog=>dialog.accept('Replaced lamp'));
 await page.locator('.request-card select').selectOption('resolved');await expect(page.locator('.request-card')).toContainText('Replaced lamp');
});

test('Reports fetch full period data and download a CSV',async({page})=>{
 await session(page);
 await page.route('**/api/admin/reports?*',route=>route.fulfill({json:{records:[{id:'v1',event_id:'e1',student_id:student.id,room_id:room.id,method:'qr',status:'verified',verified_at:new Date().toISOString()}],events:[{id:'e1',template_id:'t1',scheduled_for:new Date().toISOString(),closed_at:new Date().toISOString()}]}}));
 await page.goto('/admin');await page.getByRole('button',{name:'Reports',exact:true}).click();await expect(page.getByRole('button',{name:'Export CSV'})).toBeEnabled();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();expect((await download).suggestedFilename()).toBe('room-check-7-day-report.csv');
});

test('Student sees rotating QR, personal attendance and maintenance form',async({page})=>{
 await session(page,'student');
 await page.route('**/api/student/qr',route=>route.fulfill({json:{token:'test-qr',roomNumber:'101',roomId:'r1',expiresAt:Math.floor(Date.now()/1000)+30}}));
 await page.route('**/api/student/history',route=>route.fulfill({json:{records:[{id:'v1',status:'photo_review',method:'photo',verified_at:new Date().toISOString(),check_events:{scheduled_for:new Date().toISOString(),check_templates:{name:'Night Check'}},rooms:{room_number:'101'}}]}}));
 await page.goto('/student');await expect(page.getByRole('heading',{name:'Good evening, Alex'})).toBeVisible();
 await expect(page.locator('canvas')).toBeVisible();await expect(page.getByText('photo review',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Report a room issue'})).toBeVisible();
});

test('Checker sees only their rooms and pending photos are not shown as verified',async({page})=>{
 await session(page,'checker');
 await page.route('**/api/checker/bootstrap',route=>route.fulfill({json:{rooms:[{...room,floors:floor}],assignments:[{id:'a1',student_id:student.id,room_id:'r1',profiles:student}],event:{id:'e1',scheduled_for:new Date().toISOString(),check_templates:template},verifications:[{id:'v1',event_id:'e1',student_id:student.id,status:'photo_review'}]}}));
 await page.goto('/checker');await expect(page.getByText('Photo awaiting Dean review')).toBeVisible();await expect(page.getByRole('button',{name:'No phone',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'My student QR'})).toBeVisible();
});

test('Dean opens photo evidence inside the site without popup blockers',async({page})=>{
 const data=await session(page);
 data.verifications.push({id:'v1',student_id:student.id,room_id:room.id,status:'photo_review',method:'photo',verified_at:new Date().toISOString()} as never);
 await page.route('**/api/admin/photo/v1',route=>route.fulfill({json:{url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII='}}));
 await page.goto('/admin');await page.getByRole('button',{name:'Live check',exact:true}).click();await page.getByRole('button',{name:'View photo'}).click();
 await expect(page.getByRole('img',{name:'Room check photo submitted for Dean review'})).toBeVisible();await page.getByTitle('Close photo').click();await expect(page.getByRole('heading',{name:'Photo evidence'})).toHaveCount(0);
});

test('School Google callback routes to the student dashboard instead of password setup',async({page})=>{
 await session(page,'student');
 const cookie=(await page.context().cookies()).find(c=>c.name==='sb-roomchecker-test-auth-token')!;
 const sessionData=JSON.parse(Buffer.from(cookie.value.slice(7),'base64url').toString());
 await page.route('**/api/student/qr',route=>route.fulfill({json:{token:'test-qr',roomNumber:'101',roomId:'r1',expiresAt:Math.floor(Date.now()/1000)+30}}));
 await page.route('**/api/student/history',route=>route.fulfill({json:{records:[]}}));
 await page.goto(`/auth/callback#access_token=${sessionData.access_token}&refresh_token=test-refresh&type=signup`);
 await expect(page).toHaveURL('/student');
 await expect(page.getByRole('heading',{name:'Good evening, Alex'})).toBeVisible();
});

test('Home offers only school Google authentication; old password pages redirect',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Continue with school Google'})).toBeVisible();
 await expect(page.locator('input[type="email"],input[type="password"]')).toHaveCount(0);
 for(const path of ['/register','/forgot-password','/reset-password']){await page.goto(path);await expect(page).toHaveURL('/');}
 await expect(page.getByRole('button',{name:'Student demo',exact:true})).toBeVisible();
});

test('Personal Google accounts are signed out and refused by the callback',async({page})=>{
 await session(page,'student');
 await page.route('https://roomchecker-test.supabase.co/auth/v1/user',route=>route.fulfill({json:{id:student.id,email:'alex@gmail.com',identities:[{provider:'google',identity_data:{email:'alex@gmail.com',email_verified:true}}],app_metadata:{provider:'google'},user_metadata:{}}}));
 await page.goto('/auth/callback');
 await expect(page.getByText('Use your @kingsway.college Google account to sign in.')).toBeVisible();
 await expect(page).toHaveURL('/auth/callback');
 expect((await page.context().cookies()).some(c=>c.name==='sb-roomchecker-test-auth-token')).toBe(false);
});

test('Mobile Dean can sign out and use the user management table',async({page})=>{
 await page.setViewportSize({width:390,height:844});await session(page);await page.goto('/admin');
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Users & Roles',exact:true}).click();await expect(page.getByRole('row').filter({hasText:'Alex Student'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/dean-mobile.png',fullPage:true});
});
test('Dean dashboard links, explicit assignments and readable schedule controls',async({page})=>{
 await session(page);
 const actions:Record<string,unknown>[]=[];
 await page.route('**/api/admin/manage',async route=>{actions.push(route.request().postDataJSON());await route.fulfill({json:{data:{id:'assignment'}}});});
 await page.goto('/admin');
 await page.getByRole('button',{name:'Assigned residents 1',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Room Assignments',exact:true})).toBeVisible();
 await page.getByRole('row').filter({hasText:'Dean Morgan'}).getByRole('button',{name:'Assign room',exact:true}).click();
 await page.getByLabel('Destination room').selectOption('r1');
 await page.getByRole('button',{name:'Save resident assignment'}).click();
 await expect.poll(()=>actions.length).toBe(1);
 expect(actions[0]).toMatchObject({action:'assign_student',studentId:dean.id,roomId:'r1'});
 await page.getByRole('button',{name:'Checker Coverage',exact:true}).click();
 await expect(page.getByRole('button',{name:'Assign checker rooms',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Occupancy',exact:true}).click();
 await expect(page.getByText('1 / 2 beds occupied')).toBeVisible();
 await page.getByRole('button',{name:'Live check',exact:true}).click();
 const schedule=page.getByLabel('Room check schedule');
 await expect(schedule).toHaveCSS('color','rgb(23, 35, 31)');
 await expect(schedule).toHaveCSS('background-color','rgb(255, 255, 255)');
 await expect(schedule.locator('option').first()).toHaveCSS('color','rgb(23, 35, 31)');
});

test('Bootstrap errors do not display misleading zero counts',async({page})=>{
 await session(page);
 await page.route('**/api/admin/bootstrap',route=>route.fulfill({status:500,json:{error:'Administrative data is temporarily unavailable'}}));
 await page.goto('/admin');
 await expect(page.getByRole('heading',{name:'Residence data could not be loaded'})).toBeVisible();
 await expect(page.locator('.live-stats')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Retry loading'})).toBeVisible();
});
