const fs=require('node:fs');
const path=require('node:path');
const bcrypt=require('bcryptjs');
const {Client}=require('pg');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
async function setup(){
  const database=process.env.PGDATABASE||'smart_campus_2';
  if(!/^[a-z][a-z0-9_]*$/.test(database)) throw new Error('Use a lowercase database name with letters, numbers and underscores.');
  const admin=new Client({database:'postgres'});await admin.connect();
  try{if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount)await admin.query(`CREATE DATABASE "${database}"`);}finally{await admin.end();}
  const db=new Client({database});await db.connect();
  try{
    await db.query('BEGIN');
    await db.query(fs.readFileSync(path.join(__dirname,'../database/schema.sql'),'utf8'));
    // Reuse the original demonstration records, preserving the UI's sample content.
    await db.query('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    if((await db.query("SELECT 1 FROM app_settings WHERE key='seed_version'")).rowCount){
      await db.query('COMMIT');console.log(`Database ${database} is ready. Existing data was preserved.`);return;
    }
    const seed=require('../database/seed-data')();
    const hash=await bcrypt.hash('Demo@123',12);
    const insert=async(table,data)=>{
      const columns=Object.keys(data);const values=Object.values(data);
      await db.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING`,values);
    };
    for(const u of seed.users)await insert('users',{id:u.id,name:u.name,email:u.email,password_hash:hash,role:u.role,department:u.department,year:u.year,phone:u.phone,demo:true});
    for(const r of seed.rooms)await insert('rooms',r);
    await insert('rooms',{id:'RM-107',name:'Conference Room',building:'Administration Block · Floor 1',type:'Meeting Room',capacity:25,equipment:'Projector, Video Conferencing, Whiteboard, AC',emoji:'🏢'});
    for(const c of seed.complaints){
      await insert('complaints',{id:c.id,user_id:c.userId,title:c.title,category:c.category,location:c.location,description:c.description,priority:c.priority,status:c.status,assigned_to:c.assignedTo,created_at:c.createdAt,updated_at:c.updatedAt});
      await db.query('INSERT INTO complaint_updates(complaint_id,updated_by,status,note,assigned_to) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM complaint_updates WHERE complaint_id=$1)',[c.id,c.userId,c.status,'Initial sample record',c.assignedTo]);
    }
    for(const i of seed.items){const {userId,claims,...rest}=i;await insert('items',{...rest,user_id:userId});}
    for(const e of seed.events){const {attendees,...rest}=e;await insert('events',rest);for(const uid of attendees.filter(x=>x==='u-student'))await insert('event_registrations',{event_id:e.id,user_id:uid});}
    for(const b of seed.bookings)await insert('bookings',{id:b.id,room_id:b.roomId,user_id:b.userId,date:b.date,start_time:b.start,end_time:b.end,purpose:b.purpose,status:b.status,created_at:b.createdAt});
    for(const n of seed.notices)await insert('notices',n);
    for(const n of seed.notifications){const {userId,...rest}=n;await insert('notifications',{...rest,user_id:userId});}
    await db.query("INSERT INTO app_settings(key,value) VALUES('seed_version','1')");
    await db.query('COMMIT');console.log(`Database ${database} is ready. Existing data was preserved.`);
  }catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
}
setup().catch(e=>{console.error('Database setup failed:',e.message);process.exitCode=1;});
