const { randomBytes } = require('node:crypto');
const id = prefix => prefix + '-' + randomBytes(6).toString('hex').toUpperCase();
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function text(value, label, max = 1800, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(`${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
function choice(value, allowed, label) { if (!allowed.includes(value)) fail(`Invalid ${label}.`); return value; }
function date(value, future = true) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail('Enter a valid date.');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  if (future && value < today) fail('Date cannot be in the past.');
  if (!future && value > today) fail('Item date cannot be in the future.');
  return value;
}
function time(value) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) fail('Enter a valid time.'); return value; }
function camel(row) {
  if (!row) return row;
  const result = {};
  for (const [key,value] of Object.entries(row)) result[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
  if (result.startTime) { result.start = result.startTime.slice(0,5); delete result.startTime; }
  if (result.endTime) { result.end = result.endTime.slice(0,5); delete result.endTime; }
  if (result.time) result.time = result.time.slice(0,5);
  delete result.passwordHash;
  return result;
}
async function one(db, sql, values = []) { const row = (await db.query(sql, values)).rows[0]; if (!row) fail('Record not found.',404); return row; }
async function notify(db, userId, title, body, type='info') {
  await db.query('INSERT INTO notifications(id,user_id,title,body,type) VALUES($1,$2,$3,$4,$5)', [id('N'),userId,title,body,type]);
}
async function notifyAdmins(db,title,body,type) {
  const {rows} = await db.query("SELECT id FROM users WHERE role='admin' AND active=true");
  for (const user of rows) await notify(db,user.id,title,body,type);
}
function csv(rows) { return rows.map(row => row.map(value => { let s=String(value??''); if (/^[=+@\-\t\r]/.test(s)) s="'"+s; return '"'+s.replaceAll('"','""')+'"'; }).join(',')).join('\r\n'); }
module.exports = { id,fail,text,choice,date,time,camel,one,notify,notifyAdmins,csv };
