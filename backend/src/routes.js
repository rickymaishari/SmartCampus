const router = require('express').Router();
const {pool,transaction} = require('./db');
const {requireAdmin} = require('./auth');
const {id,fail,text,choice,date,time,camel,one,notify,notifyAdmins,csv} = require('./helpers');
const categories=['Classroom','Maintenance','IT & Network','Infrastructure','Sanitation','Security','Other'];
const priorities=['Low','Medium','High'];
const statuses=['Open','In Progress','Resolved','Rejected'];

// This read endpoint supplies the existing dashboard without changing its layout.
// Sensitive records are filtered on the server, even if a user changes browser code.
router.get('/state',async(req,res)=>{
  const u=req.user, admin=u.role==='admin';
  const state=await transaction(async db=>{
    await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const rows=async(sql,params=[]) => (await db.query(sql,params)).rows.map(camel);
    const users=admin?await rows('SELECT * FROM users ORDER BY created_at'):await rows('SELECT id,name,role FROM users WHERE active=true');
    if(!admin) {const index=users.findIndex(x=>x.id===u.id);users[index]=camel(u);}
    const complaints=await rows('SELECT * FROM complaints WHERE $1 OR user_id=$2 OR assigned_user_id=$2 ORDER BY created_at DESC',[admin,u.id]);
    const history=await rows('SELECT h.* FROM complaint_updates h JOIN complaints c ON c.id=h.complaint_id WHERE $1 OR c.user_id=$2 OR c.assigned_user_id=$2 ORDER BY h.created_at,h.id',[admin,u.id]);
    complaints.forEach(c=>c.history=history.filter(h=>h.complaintId===c.id));
    const items=await rows('SELECT * FROM items ORDER BY date DESC');
    const claims=await rows('SELECT * FROM item_claims WHERE $1 OR user_id=$2',[admin,u.id]);
    items.forEach(i=>i.claims=claims.filter(c=>c.itemId===i.id).map(c=>({...c,date:c.createdAt})));
    const events=await rows('SELECT * FROM events ORDER BY date');
    const registrations=await rows('SELECT event_id,user_id FROM event_registrations');
    events.forEach(e=>e.attendees=registrations.filter(r=>r.eventId===e.id).map(r=>r.userId));
    return {users,complaints,items,events,rooms:await rows('SELECT * FROM rooms ORDER BY id'),
      bookings:await rows('SELECT * FROM bookings WHERE $1 OR user_id=$2 ORDER BY created_at DESC',[admin,u.id]),
      notices:await rows('SELECT * FROM notices ORDER BY date DESC'),
      notifications:await rows('SELECT * FROM notifications WHERE user_id=$1 ORDER BY date DESC',[u.id])};
  });
  res.json({user:camel(u),data:state});
});
router.patch('/profile',async(req,res)=>{
  const b=req.body;
  await pool.query('UPDATE users SET name=$1,department=$2,year=$3,phone=$4 WHERE id=$5',[
    text(b.name,'Name',80),text(b.department,'Department',60),text(b.year||'','Year',50,0),text(b.phone||'','Phone',18,0),req.user.id]);
  res.json({message:'Profile updated'});
});
router.patch('/users/:id',requireAdmin,async(req,res)=>{
  if(req.params.id===req.user.id) fail('You cannot change your own role or account status.');
  const user=await one(pool,'SELECT * FROM users WHERE id=$1',[req.params.id]);
  const role=req.body.role===undefined?user.role:choice(req.body.role,['student','faculty','admin'],'role');
  if(req.body.active!==undefined && typeof req.body.active!=='boolean') fail('Invalid account status.');
  const active=req.body.active===undefined?user.active:req.body.active;
  await transaction(async db=>{
    await db.query('UPDATE users SET role=$1,active=$2 WHERE id=$3',[role,active,user.id]);
    if(!active) await db.query("DELETE FROM sessions WHERE sess->>'userId'=$1",[user.id]);
  });
  res.json({message:'User updated'});
});
router.post('/complaints',async(req,res)=>{
  const b=req.body, complaintId=id('CMP');
  await transaction(async db=>{
    await db.query('INSERT INTO complaints(id,user_id,title,category,location,description,priority) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [complaintId,req.user.id,text(b.title,'Title',110),choice(b.category,categories,'category'),text(b.location,'Location',120),text(b.description,'Description',1800,5),choice(b.priority,priorities,'priority')]);
    await db.query("INSERT INTO complaint_updates(complaint_id,updated_by,status,note,assigned_to) VALUES($1,$2,'Open','Complaint submitted','Unassigned')",[complaintId,req.user.id]);
    await notify(db,req.user.id,'Complaint submitted',b.title,'complaint');
    await notifyAdmins(db,'New complaint received',b.title,'complaint');
  });
  res.status(201).json({id:complaintId,message:'Complaint submitted successfully'});
});
router.patch('/complaints/:id',async(req,res)=>{
  const b=req.body;
  await transaction(async db=>{
    const c=await one(db,'SELECT * FROM complaints WHERE id=$1 FOR UPDATE',[req.params.id]);
    const admin=req.user.role==='admin';
    if(!admin && !(req.user.role==='faculty' && c.assigned_user_id===req.user.id)) fail('You cannot update this complaint.',403);
    const status=choice(b.status,statuses,'status');
    const priority=admin?choice(b.priority,priorities,'priority'):c.priority;
    let assignedTo=c.assigned_to, assignedUser=c.assigned_user_id;
    if(admin) {
      assignedTo=text(b.assignedTo||'Unassigned','Assigned team',80);
      assignedUser=b.assignedUserId||null;
      if(assignedUser){const staff=await one(db,"SELECT * FROM users WHERE id=$1 AND active=true AND role IN ('faculty','admin')",[assignedUser]);assignedTo=staff.name;}
    }
    const note=text(b.note||'','Response',1800,0);
    await db.query('UPDATE complaints SET status=$1,priority=$2,assigned_to=$3,assigned_user_id=$4,updated_at=now() WHERE id=$5',[status,priority,assignedTo,assignedUser,c.id]);
    await db.query('INSERT INTO complaint_updates(complaint_id,updated_by,status,note,assigned_to) VALUES($1,$2,$3,$4,$5)',[c.id,req.user.id,status,note,assignedTo]);
    await notify(db,c.user_id,'Complaint updated',`${c.title}: ${status}. ${note}`,'complaint');
    if(assignedUser && assignedUser!==c.assigned_user_id) await notify(db,assignedUser,'Complaint assigned to you',c.title,'complaint');
  });
  res.json({message:'Complaint updated successfully'});
});
router.get('/rooms/:id/availability',async(req,res)=>{
  const day=date(req.query.date);await one(pool,'SELECT id FROM rooms WHERE id=$1',[req.params.id]);
  const {rows}=await pool.query("SELECT start_time,end_time,status FROM bookings WHERE room_id=$1 AND date=$2 AND status IN ('Pending','Approved') ORDER BY start_time",[req.params.id,day]);
  res.json({slots:rows.map(camel)});
});
router.post('/bookings',async(req,res)=>{
  if(req.user.role==='admin') fail('Admins review bookings. Use a student or faculty account to request a room.',403);
  const b=req.body, day=date(b.date), start=time(b.start), end=time(b.end), purpose=text(b.purpose,'Purpose',130);
  if(start>=end) fail('End time must be later than start time.');
  const bookingId=id('BKG');
  await transaction(async db=>{
    const room=await one(db,'SELECT * FROM rooms WHERE id=$1',[b.roomId]);
    await db.query('INSERT INTO bookings(id,room_id,user_id,date,start_time,end_time,purpose) VALUES($1,$2,$3,$4,$5,$6,$7)',[bookingId,room.id,req.user.id,day,start,end,purpose]);
    await notify(db,req.user.id,'Booking request received',room.name+' is awaiting approval.','booking');
    await notifyAdmins(db,'New booking request',req.user.name+' requested '+room.name,'booking');
  });
  res.status(201).json({id:bookingId,message:'Booking request submitted'});
});
router.patch('/bookings/:id',async(req,res)=>{
  await transaction(async db=>{
    const b=await one(db,'SELECT * FROM bookings WHERE id=$1 FOR UPDATE',[req.params.id]);
    const status=choice(req.body.status,['Approved','Rejected','Cancelled'],'booking status');
    if(status==='Cancelled'){if(b.user_id!==req.user.id) fail('This is not your booking.',403);}
    else if(req.user.role!=='admin') fail('Administrator access is required.',403);
    if(b.status!=='Pending') fail('Only pending bookings can be changed.',409);
    await db.query('UPDATE bookings SET status=$1 WHERE id=$2',[status,b.id]);
    await notify(db,b.user_id,'Booking '+status.toLowerCase(),'Your room request has been '+status.toLowerCase()+'.','booking');
  });res.json({message:'Booking updated'});
});
router.post('/items',async(req,res)=>{
  const b=req.body,itemId=id('LF'),category=choice(b.category,['Electronics','Documents','Personal Items','Stationery','Keys','Clothing','Other'],'category');
  const emoji={Electronics:'🎧',Documents:'📄','Personal Items':'🎒',Stationery:'📒',Keys:'🔑',Clothing:'👕',Other:'📦'}[category];
  await pool.query('INSERT INTO items(id,user_id,type,title,category,location,description,date,emoji) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [itemId,req.user.id,choice(b.type,['Lost','Found'],'item type'),text(b.title,'Title',95),category,text(b.location,'Location',120),text(b.description,'Description',1800,5),date(b.date,false),emoji]);
  res.status(201).json({id:itemId,message:'Item report published'});
});
router.patch('/items/:id/close',async(req,res)=>{
  await transaction(async db=>{
    const item=await one(db,'SELECT * FROM items WHERE id=$1 FOR UPDATE',[req.params.id]);
    if(item.user_id!==req.user.id && req.user.role!=='admin') fail('You cannot close this report.',403);
    await db.query("UPDATE items SET status='Closed' WHERE id=$1",[item.id]);
    await db.query("UPDATE item_claims SET status='Rejected' WHERE item_id=$1 AND status='Pending'",[item.id]);
  });res.json({message:'Item report marked resolved'});
});
router.post('/items/:id/claims',async(req,res)=>{
  const proof=text(req.body.proof,'Ownership details',1800,5),claimId=id('CL');
  await transaction(async db=>{
    const item=await one(db,'SELECT * FROM items WHERE id=$1 FOR UPDATE',[req.params.id]);
    if(item.user_id===req.user.id) fail('You cannot claim your own report.');
    if(item.status!=='Active') fail('This report is already closed.',409);
    await db.query('INSERT INTO item_claims(id,item_id,user_id,proof) VALUES($1,$2,$3,$4)',[claimId,item.id,req.user.id,proof]);
    await notifyAdmins(db,'Item response needs review',req.user.name+' responded to '+item.title,'lost');
  });res.status(201).json({id:claimId,message:'Response sent for review'});
});
router.patch('/claims/:id',requireAdmin,async(req,res)=>{
  const status=choice(req.body.status,['Approved','Rejected'],'claim status');
  await transaction(async db=>{
    const initial=await one(db,'SELECT item_id FROM item_claims WHERE id=$1',[req.params.id]);
    const item=await one(db,'SELECT * FROM items WHERE id=$1 FOR UPDATE',[initial.item_id]);
    const claim=await one(db,'SELECT * FROM item_claims WHERE id=$1 FOR UPDATE',[req.params.id]);
    if(claim.status!=='Pending' || item.status!=='Active') fail('This response has already been handled.',409);
    await db.query('UPDATE item_claims SET status=$1 WHERE id=$2',[status,claim.id]);
    if(status==='Approved') {
      await db.query("UPDATE items SET status='Closed' WHERE id=$1",[item.id]);
      const others=await db.query("UPDATE item_claims SET status='Rejected' WHERE item_id=$1 AND status='Pending' RETURNING user_id",[item.id]);
      for(const c of others.rows) await notify(db,c.user_id,'Item claim closed','Another claim for '+item.title+' was approved.','lost');
    }
    await notify(db,claim.user_id,'Item response '+status.toLowerCase(),item.title,'lost');
    await notify(db,item.user_id,'Item update','An administrator reviewed a response to '+item.title,'lost');
  });res.json({message:'Claim reviewed'});
});
router.post('/events',requireAdmin,async(req,res)=>{
  const b=req.body,capacity=Number(b.capacity),eventId=id('EV');
  if(!Number.isInteger(capacity)||capacity<1||capacity>10000) fail('Capacity must be between 1 and 10000.');
  const category=choice(b.category,['Technology','Culture','Workshop','Sports','Career','Other'],'category');
  const looks={Technology:['💡','blue'],Culture:['🎭','pink'],Workshop:['🎨','purple'],Sports:['🏅','orange'],Career:['🚀','green'],Other:['🎪','blue']}[category];
  await pool.query('INSERT INTO events(id,title,category,date,time,location,description,capacity,emoji,color) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [eventId,text(b.title,'Title',100),category,date(b.date),time(b.time),text(b.location,'Venue',90),text(b.description,'Description',1800,5),capacity,...looks]);
  res.status(201).json({id:eventId,message:'Event published'});
});
router.post('/events/:id/register',async(req,res)=>{
  if(req.user.role!=='student') fail('Only students can register for events.',403);
  await transaction(async db=>{
    // Lock the event while counting seats so two students cannot take the last seat.
    const event=await one(db,'SELECT * FROM events WHERE id=$1 FOR UPDATE',[req.params.id]);
    date(event.date);
    const count=Number((await db.query('SELECT count(*) FROM event_registrations WHERE event_id=$1',[event.id])).rows[0].count);
    if(count>=event.capacity) fail('This event is full.',409);
    await db.query('INSERT INTO event_registrations(event_id,user_id) VALUES($1,$2)',[event.id,req.user.id]);
    await notify(db,req.user.id,'Registration confirmed',event.title,'event');
  });res.status(201).json({message:'Event registration confirmed'});
});
router.delete('/events/:id/register',async(req,res)=>{
  await transaction(async db=>{
    const event=await one(db,'SELECT * FROM events WHERE id=$1 FOR UPDATE',[req.params.id]);
    const result=await db.query('DELETE FROM event_registrations WHERE event_id=$1 AND user_id=$2',[event.id,req.user.id]);
    if(!result.rowCount) fail('You are not registered for this event.',404);
    await notify(db,req.user.id,'Registration cancelled',event.title,'event');
  });res.json({message:'Event registration cancelled'});
});
router.get('/events/:id/participants.csv',requireAdmin,async(req,res)=>{
  await one(pool,'SELECT id FROM events WHERE id=$1',[req.params.id]);
  const {rows}=await pool.query('SELECT u.name,u.email,u.department,r.created_at FROM event_registrations r JOIN users u ON u.id=r.user_id WHERE r.event_id=$1 ORDER BY u.name',[req.params.id]);
  res.attachment('event-participants.csv').send(csv([['Name','Email','Department','Registered at'],...rows.map(r=>[r.name,r.email,r.department,r.created_at.toISOString()])]));
});
router.post('/notices',requireAdmin,async(req,res)=>{
  const b=req.body,noticeId=id('NT'),title=text(b.title,'Title',140);
  await transaction(async db=>{
    await db.query('INSERT INTO notices(id,title,category,body,pinned) VALUES($1,$2,$3,$4,$5)',[noticeId,title,choice(b.category,['Academic','Administrative','Events','Maintenance'],'category'),text(b.body,'Announcement',1800,5),b.pinned===true||b.pinned==='on']);
    const users=(await db.query('SELECT id FROM users WHERE active=true AND id<>$1',[req.user.id])).rows;
    for(const user of users) await notify(db,user.id,'New campus notice',title,'info');
  });res.status(201).json({id:noticeId,message:'Notice published'});
});
router.delete('/notices/:id',requireAdmin,async(req,res)=>{const r=await pool.query('DELETE FROM notices WHERE id=$1',[req.params.id]);if(!r.rowCount)fail('Notice not found.',404);res.json({message:'Notice deleted'});});
router.patch('/notifications/read-all',async(req,res)=>{await pool.query('UPDATE notifications SET read=true WHERE user_id=$1',[req.user.id]);res.json({message:'All notifications marked as read'});});
router.patch('/notifications/:id/read',async(req,res)=>{const r=await pool.query('UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);if(!r.rowCount)fail('Notification not found.',404);res.json({message:'Notification read'});});
router.get('/reports.csv',requireAdmin,async(req,res)=>{
  const {rows}=await pool.query("SELECT 'Complaint' AS type,c.id,c.title,u.name,c.status,c.created_at::text AS date FROM complaints c JOIN users u ON u.id=c.user_id UNION ALL SELECT 'Booking',b.id,r.name,u.name,b.status,b.date::text FROM bookings b JOIN users u ON u.id=b.user_id JOIN rooms r ON r.id=b.room_id UNION ALL SELECT 'Item',i.id,i.title,u.name,i.status,i.date::text FROM items i JOIN users u ON u.id=i.user_id");
  res.attachment('campusflow-report.csv').send(csv([['Type','ID','Title / Room','Owner','Status','Date'],...rows.map(r=>[r.type,r.id,r.title,r.name,r.status,r.date])]));
});
module.exports=router;
