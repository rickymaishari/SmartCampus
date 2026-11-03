// npm test creates its own temporary PostgreSQL database and removes it afterwards.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const path=require('node:path');
const {Client}=require('pg');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const database='campusflow_test_'+Date.now(),port=3197;
const env={...process.env,PGDATABASE:database,PORT:String(port)};
let server,db,student,other,admin,faculty,complaint,booking,event,item,claim;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function browser(){return {cookie:''};}
async function request(client,url,method='GET',body){
  const r=await fetch(`http://localhost:${port}/api${url}`,{method,headers:{'Content-Type':'application/json',Cookie:client.cookie},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const cookies=r.headers.getSetCookie();if(cookies.length)client.cookie=cookies.map(c=>c.split(';')[0]).join('; ');
  const data=(r.headers.get('content-type')||'').includes('json')?await r.json():await r.text();
  return {status:r.status,data};
}
async function ok(client,url,method='GET',body,status=200){const r=await request(client,url,method,body);assert.equal(r.status,status,JSON.stringify(r.data));return r.data;}
before(async()=>{
  execFileSync(process.execPath,[path.join(__dirname,'../scripts/setup.js')],{env,stdio:'pipe'});
  db=new Client({database});await db.connect();
  server=spawn(process.execPath,[path.join(__dirname,'../src/server.js')],{env,stdio:'pipe'});
  let logs='';server.stderr.on('data',b=>logs+=b);
  let ready=false;for(let i=0;i<60;i++){try{await ok(browser(),'/health');ready=true;break;}catch{await delay(150);}}
  assert.ok(ready,'Server did not start: '+logs);
  admin=browser();faculty=browser();student=browser();other=browser();
  await ok(admin,'/auth/login','POST',{email:'admin@campus.edu',password:'Demo@123'});
  await ok(faculty,'/auth/login','POST',{email:'faculty@campus.edu',password:'Demo@123'});
});
after(async()=>{
  if(server){server.kill();await delay(500);}
  if(db)await db.end();
  const cleanup=new Client({database:'postgres'});await cleanup.connect();
  try{await cleanup.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[database]);await cleanup.query(`DROP DATABASE IF EXISTS "${database}"`);}finally{await cleanup.end();}
});
test('Complete campus workflows, permissions and concurrent requests',async t=>{
  await t.test('registration persists hashed password and ignores requested admin role',async()=>{
    const result=await ok(student,'/auth/register','POST',{name:'Test Student',email:'test.student@campus.edu',department:'Computer Science',password:'TestPass123!',confirm:'TestPass123!',role:'admin'},201);
    assert.equal(result.user.role,'student');assert.equal(result.user.passwordHash,undefined);
    const row=(await db.query('SELECT * FROM users WHERE email=$1',['test.student@campus.edu'])).rows[0];assert.ok(row.password_hash.startsWith('$2'));assert.notEqual(row.password_hash,'TestPass123!');
    await ok(other,'/auth/register','POST',{name:'Other Student',email:'other.student@campus.edu',department:'IT',password:'TestPass123!'},201);
    assert.equal((await request(browser(),'/auth/login','POST',{email:'test.student@campus.edu',password:'wrong'})).status,401);
    assert.equal((await request(browser(),'/auth/register','POST',{name:'Duplicate',email:'TEST.STUDENT@campus.edu',department:'IT',password:'TestPass123!'})).status,409);
    const state=await ok(admin,'/state');assert.ok(state.data.users.some(u=>u.email==='test.student@campus.edu'));
  });
  await t.test('complaint submission, admin assignment, faculty resolution and history persist',async()=>{
    complaint=(await ok(student,'/complaints','POST',{title:'Projector needs repair',category:'Classroom',location:'Room 204',description:'The projector does not switch on.',priority:'High',userId:'u-admin'},201)).id;
    assert.equal((await request(other,'/complaints/'+complaint,'PATCH',{status:'Resolved',priority:'Low'})).status,403);
    await ok(admin,'/complaints/'+complaint,'PATCH',{status:'In Progress',priority:'High',assignedTo:'IT Team',assignedUserId:'u-faculty',note:'Assigned to faculty for review'});
    const f=await ok(faculty,'/state');assert.ok(f.data.complaints.some(c=>c.id===complaint));
    await ok(faculty,'/complaints/'+complaint,'PATCH',{status:'Resolved',note:'Projector cable replaced successfully'});
    const s=await ok(student,'/state'),c=s.data.complaints.find(c=>c.id===complaint);assert.equal(c.status,'Resolved');assert.equal(c.history.length,3);
    assert.ok(s.data.notifications.some(n=>n.title==='Complaint updated'));
    assert.equal((await ok(other,'/state')).data.complaints.some(c=>c.id===complaint),false);
    assert.equal((await db.query('SELECT status FROM complaints WHERE id=$1',[complaint])).rows[0].status,'Resolved');
  });
  await t.test('conference booking, conflict rejection, approval, ownership and database exclusion',async()=>{
    const data={roomId:'RM-107',date:'2099-01-20',start:'10:00',end:'11:00',purpose:'Final project presentation'};
    booking=(await ok(student,'/bookings','POST',data,201)).id;
    assert.equal((await request(other,'/bookings','POST',data)).status,409);
    assert.equal((await request(student,'/bookings/'+booking,'PATCH',{status:'Approved'})).status,403);
    assert.equal((await request(other,'/bookings/'+booking,'PATCH',{status:'Cancelled'})).status,403);
    await ok(admin,'/bookings/'+booking,'PATCH',{status:'Approved'});
    assert.equal((await db.query('SELECT status FROM bookings WHERE id=$1',[booking])).rows[0].status,'Approved');
    assert.equal((await ok(other,'/rooms/RM-107/availability?date=2099-01-20')).slots.length,1);
    assert.equal((await ok(other,'/state')).data.bookings.some(b=>b.id===booking),false);
    const concurrent=await Promise.all([request(student,'/bookings','POST',{...data,date:'2099-01-21'}),request(other,'/bookings','POST',{...data,date:'2099-01-21'})]);
    assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
    await assert.rejects(db.query("INSERT INTO bookings(id,room_id,user_id,date,start_time,end_time,purpose) VALUES('direct-overlap','RM-107','u-student','2099-01-20','10:30','11:30','Direct SQL conflict')"),e=>e.code==='23P01');
    const adjacent=await ok(student,'/bookings','POST',{...data,start:'11:00',end:'12:00'},201);
    await ok(student,'/bookings/'+adjacent.id,'PATCH',{status:'Cancelled'});
    await ok(other,'/bookings','POST',{...data,start:'11:00',end:'12:00'},201);
    assert.equal((await request(student,'/bookings','POST',{...data,date:'2020-01-01'})).status,400);
  });
  await t.test('event creation and final seat are protected from concurrent registration',async()=>{
    const data={title:'Backend Demonstration',category:'Technology',date:'2099-02-01',time:'10:00',location:'Auditorium',capacity:1,description:'A demonstration of database transactions.'};
    assert.equal((await request(student,'/events','POST',data)).status,403);
    event=(await ok(admin,'/events','POST',data,201)).id;
    assert.equal((await request(faculty,'/events/'+event+'/register','POST',{})).status,403);
    const results=await Promise.all([request(student,'/events/'+event+'/register','POST',{}),request(other,'/events/'+event+'/register','POST',{})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    assert.equal(Number((await db.query('SELECT count(*) FROM event_registrations WHERE event_id=$1',[event])).rows[0].count),1);
    const winner=results[0].status===201?student:other;
    assert.equal((await request(winner,'/events/'+event+'/register','POST',{})).status,409);
    const csv=await ok(admin,'/events/'+event+'/participants.csv');assert.ok(csv.includes('Department'));
    await ok(winner,'/events/'+event+'/register','DELETE',{});
    await ok(winner,'/events/'+event+'/register','POST',{},201);
  });
  await t.test('lost and found claims, notices, profile and notifications',async()=>{
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
    item=(await ok(student,'/items','POST',{type:'Found',title:'Blue backpack',category:'Personal Items',location:'Library',date:day,description:'A blue backpack with a name tag.'},201)).id;
    claim=(await ok(other,'/items/'+item+'/claims','POST',{proof:'My initials are written inside the front pocket.'},201)).id;
    assert.equal((await request(other,'/items/'+item+'/claims','POST',{proof:'Another response'})).status,409);
    assert.equal((await request(student,'/claims/'+claim,'PATCH',{status:'Approved'})).status,403);
    await ok(admin,'/claims/'+claim,'PATCH',{status:'Approved'});
    assert.equal((await db.query('SELECT status FROM items WHERE id=$1',[item])).rows[0].status,'Closed');
    const notice=await ok(admin,'/notices','POST',{title:'Project demonstration',category:'Academic',body:'Presentations will take place tomorrow.',pinned:true},201);
    assert.ok((await ok(student,'/state')).data.notices.some(n=>n.id===notice.id));
    await ok(student,'/notifications/read-all','PATCH',{});
    assert.equal((await ok(student,'/state')).data.notifications.some(n=>!n.read),false);
    await ok(student,'/profile','PATCH',{name:'Updated Student',department:'CSE',year:'Third Year',phone:'9876543210'});
    assert.equal((await ok(student,'/state')).user.name,'Updated Student');
    await ok(admin,'/notices/'+notice.id,'DELETE',{});
    assert.ok((await ok(admin,'/reports.csv')).includes('Projector needs repair'));
  });
  await t.test('role management, deactivation and logout enforce access',async()=>{
    const user=(await ok(other,'/state')).user;
    assert.equal((await request(student,'/users/'+user.id,'PATCH',{role:'admin'})).status,403);
    await ok(admin,'/users/'+user.id,'PATCH',{role:'faculty'});
    assert.equal((await ok(other,'/state')).user.role,'faculty');
    await ok(admin,'/users/'+user.id,'PATCH',{active:false});
    assert.equal((await request(other,'/state')).status,401);
    await ok(student,'/auth/logout','POST',{});
    assert.equal((await request(student,'/state')).status,401);
    await ok(student,'/auth/login','POST',{email:'test.student@campus.edu',password:'TestPass123!'});
    assert.ok((await ok(student,'/state')).data.complaints.some(c=>c.id===complaint));
    const state=await ok(student,'/state');assert.ok(!JSON.stringify(state).includes('passwordHash'));assert.ok(!JSON.stringify(state).includes('password_hash'));
  });
});
