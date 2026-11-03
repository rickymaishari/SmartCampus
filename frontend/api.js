// API integration. app.js contains the original views; this file handles server calls.
let busy=false;
function connection(message=''){const el=$('#connection-status');if(el)el.textContent=message;}
async function api(path,method='GET',body){
  const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok){const error=new Error(result.error||'Request failed.');error.status=response.status;throw error;}
  return result;
}
async function refreshData(){const result=await api('/state');db=result.data;session=result.user.id;}
async function run(work){
  if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');connection('Saving…');
  try{await work();connection();}
  catch(error){
    if(error.status===401 && session){session='';ui.modal=null;loginScreen();}
    toast(error.message||'Unable to connect. Check that the server is running.','error');connection('Changes were not completed. Please try again.');
  }finally{busy=false;document.body.removeAttribute('aria-busy');}
}
async function mutate(path,method,body,close=true){
  const result=await api(path,method,body);
  // A write succeeded even if a subsequent refresh fails: never report it as unsaved.
  try{await refreshData();}catch(error){toast('Saved successfully. Refresh the page to load the latest records.','error');return;}
  if(close)ui.modal=null;render(true);toast(result.message||'Saved successfully');
}
async function handleLogin(form){await run(async()=>{await api('/auth/login','POST',Object.fromEntries(new FormData(form)));await refreshData();ui.page='overview';resetFilters();render();toast('Welcome back, '+current().name.split(' ')[0]+'!');});}
async function handleRegister(form){await run(async()=>{await api('/auth/register','POST',Object.fromEntries(new FormData(form)));await refreshData();ui.page='overview';resetFilters();render();toast('Account created successfully');});}
function canManageComplaint(c){return admin()||(current()?.role==='faculty'&&c.assignedUserId===session);}
function complaintHistory(c){return `<h4 class="detail-section-title">Status history</h4><div class="complaint-history">${(c.history||[]).map(h=>`<div class="history-entry">${badge(h.status)}<p>${clean(h.note||'Status updated')}</p><small>${clean(actor(h.updatedBy))} · ${new Date(h.createdAt).toLocaleString('en-IN')} · ${clean(h.assignedTo)}</small></div>`).join('')||'No updates yet.'}</div>`;}
function assignmentField(c){if(!admin())return '';return `<label class="field">Assign to faculty member<select name="assignedUserId"><option value="">Use team name above</option>${db.users.filter(u=>u.active!==false&&['faculty','admin'].includes(u.role)).map(u=>`<option value="${u.id}" ${c.assignedUserId===u.id?'selected':''}>${clean(u.name)}</option>`).join('')}</select></label>`;}
let availabilityRequest=0;
async function checkAvailability(){
  const form=$('#booking-form');if(!form)return;const room=form.elements.roomId.value,day=form.elements.date.value,request=++availabilityRequest;
  try{const {slots}=await api(`/rooms/${encodeURIComponent(room)}/availability?date=${encodeURIComponent(day)}`);const el=$('#availability-info');if(!el||request!==availabilityRequest)return;
    const start=form.elements.start.value,end=form.elements.end.value;
    const conflict=slots.some(s=>start<s.end&&end>s.start);
    el.textContent=(conflict?'Selected time is unavailable. Choose another slot.':start>=end?'End time must be later than start time.':'Selected time is available to request.')+(slots.length?'\nReserved / pending slots: '+slots.map(s=>`${s.start}–${s.end} (${s.status})`).join(', '):' No reservations on this date.');
  }catch(error){const el=$('#availability-info');if(el&&request===availabilityRequest)el.textContent=error.message;}
}
async function formHandler(form){
  const b=Object.fromEntries(new FormData(form));
  const routes={
    'complaint-form':['/complaints','POST'], 'complaint-update-form':['/complaints/'+b.id,'PATCH'],
    'item-form':['/items','POST'], 'claim-form':['/items/'+b.itemId+'/claims','POST'],
    'event-form':['/events','POST'], 'booking-form':['/bookings','POST'],
    'notice-form':['/notices','POST'], 'profile-form':['/profile','PATCH']
  };
  const route=routes[form.getAttribute('id')];if(route)await run(()=>mutate(route[0],route[1],b));
}
async function handleAction(action,el){
  const obj=el.dataset.id;
  if(action==='drawer-open'||action==='drawer-close'){ui.drawer=action==='drawer-open';render(true);return;}
  if(action==='theme'){ui.dark=!ui.dark;localStorage.setItem(THEME,ui.dark?'dark':'light');render(true);return;}
  if(action==='modal-close'||action==='modal-close-bg'){closeModal();return;}
  if(['complaint-new','item-new','event-new','notice-new','complaint-view','complaint-manage','item-view','claim-new','notice-view','book-room','event-view'].includes(action)){openModal(action,obj);return;}
  if(action==='export'){window.location.href='/api/reports.csv';return;}
  if(action==='refresh'){await start();return;}
  if(action==='logout'){await run(async()=>{await api('/auth/logout','POST',{});session='';ui.modal=null;ui.tab='signin';loginScreen();toast('Signed out successfully');});return;}
  let route,body={};
  if(action==='event-register'){const event=db.events.find(e=>e.id===obj);route=['/events/'+obj+'/register',event.attendees.includes(session)?'DELETE':'POST'];}
  if(action==='booking-cancel'){if(!confirm('Cancel this pending booking request?'))return;route=['/bookings/'+obj,'PATCH'];body.status='Cancelled';}
  if(action==='booking-approve'||action==='booking-reject'){route=['/bookings/'+obj,'PATCH'];body.status=action==='booking-approve'?'Approved':'Rejected';}
  if(action==='item-close')route=['/items/'+obj+'/close','PATCH'];
  if(action==='claim-approve'||action==='claim-reject'){route=['/claims/'+el.dataset.claim,'PATCH'];body.status=action==='claim-approve'?'Approved':'Rejected';}
  if(action==='notice-delete'){if(!confirm('Delete this campus notice?'))return;route=['/notices/'+obj,'DELETE'];}
  if(action==='notification-read')route=['/notifications/'+obj+'/read','PATCH'];
  if(action==='notifications-read')route=['/notifications/read-all','PATCH'];
  if(action==='user-toggle'){const u=db.users.find(u=>u.id===obj);route=['/users/'+obj,'PATCH'];body.active=u.active===false;}
  if(route)await run(()=>mutate(route[0],route[1],body,action==='item-close'));
}
document.addEventListener('click',e=>{
  const target=e.target.closest('[data-action],[data-page],[data-status],[data-admin-tab],[data-demo],[data-auth-tab]');if(!target||busy)return;
  if(target.dataset.action==='modal-close-bg'&&e.target!==target)return;
  if(target.dataset.page){changePage(target.dataset.page);return;}
  if(target.dataset.demo){const form=$('#login-form');if(form){form.elements.email.value=target.dataset.demo+'@campus.edu';form.elements.password.value='Demo@123';handleLogin(form);}return;}
  if(target.dataset.authTab){ui.tab=target.dataset.authTab;loginScreen();return;}
  if(target.dataset.status){ui.status=target.dataset.status;render(true);return;}
  if(target.dataset.adminTab){ui.status=target.dataset.adminTab;render(true);return;}
  if(target.dataset.action)handleAction(target.dataset.action,target);
});
document.addEventListener('submit',e=>{e.preventDefault();if(busy)return;if(e.target.id==='login-form')handleLogin(e.target);else if(e.target.id==='register-form')handleRegister(e.target);else formHandler(e.target);});
document.addEventListener('input',e=>{const input=e.target;if(input.dataset.filter==='search'){ui.search=input.value;const pos=input.selectionStart;render(true);const next=$('[data-filter="search"]');next?.focus();next?.setSelectionRange(pos,pos);}});
document.addEventListener('change',e=>{
  if(e.target.dataset.filter==='status'){ui.status=e.target.value;render(true);}
  if(e.target.dataset.userRole)run(()=>mutate('/users/'+e.target.dataset.userRole,'PATCH',{role:e.target.value},false));
  if(e.target.closest('#booking-form'))checkAvailability();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.modal&&!busy)closeModal();});
async function start(){connection('Connecting…');try{await refreshData();render();connection();}catch(error){session='';loginScreen();connection(error.status===401?'':'Cannot reach the campus server. Start the backend and use http://localhost:3000.');}}
// Check for other users' updates, but never replace a form while someone is typing.
setInterval(async()=>{
  if(!session||busy||document.hidden||ui.modal||ui.page==='profile'||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  busy=true;
  try{await refreshData();render(true);connection();}catch(error){if(error.status===401){session='';loginScreen();}else connection('Connection interrupted. Reconnecting…');}finally{busy=false;}
},8000);
start();
