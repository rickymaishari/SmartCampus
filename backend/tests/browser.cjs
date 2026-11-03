// Uses installed Microsoft Edge in headless mode; no real user data is changed.
const {chromium}=require('playwright');
const {Client}=require('pg');
const {spawn,execFileSync}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const assert=require('node:assert/strict');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const database='campusflow_ui_test_'+Date.now(),port=3198;
const env={...process.env,PGDATABASE:database,PORT:String(port)};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let server,browser;
const output=path.join(__dirname,'../test-results');
async function main(){
  fs.mkdirSync(output,{recursive:true});
  execFileSync(process.execPath,[path.join(__dirname,'../scripts/setup.js')],{env,stdio:'pipe'});
  server=spawn(process.execPath,[path.join(__dirname,'../src/server.js')],{env,stdio:'pipe'});
  for(let i=0;i<50;i++){try{if((await fetch(`http://localhost:${port}/api/health`)).ok)break;}catch{}await delay(200);}
  browser=await chromium.launch({channel:'msedge',headless:true});
  const studentContext=await browser.newContext({viewport:{width:1440,height:1000}});
  const adminContext=await browser.newContext({viewport:{width:1440,height:1000}});
  const student=await studentContext.newPage(),admin=await adminContext.newPage();
  const errors=[];student.on('pageerror',e=>errors.push(e.message));admin.on('pageerror',e=>errors.push(e.message));
  await student.goto(`http://localhost:${port}`);await student.locator('#login-form').waitFor();
  await student.screenshot({path:path.join(output,'01-login.png'),fullPage:true,animations:'disabled'});
  await student.locator('[data-auth-tab="register"]').click();
  await student.locator('#register-form [name="name"]').fill('Faculty Demo Student');
  await student.locator('#register-form [name="email"]').fill('ui.student@campus.edu');
  await student.locator('#register-form [name="department"]').fill('Computer Science');
  await student.locator('#register-form [name="password"]').fill('DemoStudent123!');
  await student.locator('#register-form [name="confirm"]').fill('DemoStudent123!');
  await student.locator('#register-form button[type="submit"]').click();
  await student.locator('.sidebar').waitFor();
  await student.locator('.sidebar [data-page="complaints"]').click();
  await student.locator('[data-action="complaint-new"]').click();
  await student.locator('#complaint-form [name="title"]').fill('Projector not working in Conference Room');
  await student.locator('#complaint-form [name="location"]').fill('Conference Room');
  await student.locator('#complaint-form [name="description"]').fill('The projector does not power on during presentations.');
  await student.locator('#complaint-form button[type="submit"]').click();
  await student.locator('.modal-dialog').waitFor({state:'hidden'});
  await student.getByRole('button',{name:'Projector not working in Conference Room',exact:true}).waitFor();
  await admin.goto(`http://localhost:${port}`);await admin.locator('[data-demo="admin"]').click();await admin.locator('.sidebar').waitFor();
  await admin.locator('.sidebar [data-page="admin"]').click();
  await admin.locator('[data-admin-tab="users"]').click();await admin.getByText('ui.student@campus.edu',{exact:true}).waitFor();
  await admin.locator('[data-admin-tab="complaints"]').click();
  await admin.getByRole('button',{name:'Projector not working in Conference Room',exact:true}).click();
  await admin.locator('.modal-dialog [data-action="complaint-manage"]').click();
  await admin.locator('#complaint-update-form [name="status"]').selectOption('Resolved');
  await admin.locator('#complaint-update-form [name="note"]').fill('Power cable replaced. Projector tested and working.');
  await admin.locator('#complaint-update-form button[type="submit"]').click();await admin.locator('.modal-dialog').waitFor({state:'hidden'});
  await student.reload();await student.locator('.sidebar').waitFor();await student.locator('.sidebar [data-page="complaints"]').click();
  await student.getByRole('button',{name:'Projector not working in Conference Room',exact:true}).click();
  await student.getByText('Power cable replaced. Projector tested and working.',{exact:true}).waitFor();
  await student.screenshot({path:path.join(output,'02-complaint-history.png'),fullPage:true,animations:'disabled'});
  await student.locator('.modal-heading [data-action="modal-close"]').click();
  await student.locator('.sidebar [data-page="bookings"]').click();
  await student.locator('[data-action="book-room"][data-id="RM-107"]').click();
  await student.locator('#booking-form [name="date"]').fill('2099-03-10');
  await student.locator('#booking-form [name="purpose"]').fill('Backend project demonstration');
  await student.locator('#booking-form button[type="submit"]').click();await student.locator('.modal-dialog').waitFor({state:'hidden'});
  await student.getByText('Backend project demonstration',{exact:true}).waitFor();
  await admin.reload();await admin.locator('.sidebar').waitFor();await admin.locator('.sidebar [data-page="bookings"]').click();
  await admin.locator('tr').filter({hasText:'Backend project demonstration'}).locator('[data-action="booking-approve"]').click();
  await admin.locator('tr').filter({hasText:'Backend project demonstration'}).getByText('Approved',{exact:true}).waitFor();
  await student.reload();await student.locator('.sidebar').waitFor();await student.locator('.sidebar [data-page="bookings"]').click();
  await student.locator('tr').filter({hasText:'Backend project demonstration'}).getByText('Approved',{exact:true}).waitFor();
  await student.screenshot({path:path.join(output,'03-booking-approved.png'),fullPage:true,animations:'disabled'});
  await student.locator('[data-action="book-room"][data-id="RM-107"]').click();await student.locator('#booking-form [name="date"]').fill('2099-03-10');
  await student.locator('#booking-form [name="purpose"]').fill('Conflicting booking');await student.locator('#booking-form button[type="submit"]').click();
  await student.locator('.toast.error').filter({hasText:'already booked'}).waitFor();
  await student.locator('.modal-heading [data-action="modal-close"]').click();
  for(const page of ['lostfound','events','notices','notifications','profile']){await student.locator(`.sidebar .nav-link[data-page="${page}"]`).click();assert.ok(await student.locator('main').isVisible());}
  await student.setViewportSize({width:390,height:844});await student.reload();await student.locator('.app-shell').waitFor();
  await student.screenshot({path:path.join(output,'04-mobile-dashboard.png'),fullPage:true,animations:'disabled'});
  const overflow=await student.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false,'Mobile page overflows');
  assert.deepEqual(errors,[],'Browser errors');
  console.log('PASS: registration, admin user list, complaint update/history, booking approval, conflict feedback, all student pages, mobile layout.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(server){server.kill();await delay(500);}
  const db=new Client({database:'postgres'});await db.connect();try{await db.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[database]);await db.query(`DROP DATABASE IF EXISTS "${database}"`);}finally{await db.end();}
});
