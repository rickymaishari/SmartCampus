const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const { pool, transaction } = require('./db');
const { id, fail, text, camel, notifyAdmins } = require('./helpers');
const router = express.Router();
const limiter = rateLimit({ windowMs: 15*60*1000, limit: 80, standardHeaders: true, legacyHeaders: false, message: {error:'Too many sign-in attempts. Try again later.'} });
async function loginSession(req,userId) {
  await new Promise((resolve,reject)=>req.session.regenerate(error=>error?reject(error):resolve()));
  req.session.userId=userId;
  await new Promise((resolve,reject)=>req.session.save(error=>error?reject(error):resolve()));
}
router.post('/register', limiter, async (req,res)=>{
  const b=req.body, name=text(b.name,'Name',80), department=text(b.department,'Department',60);
  const email=text(b.email,'Email',254).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
  if(typeof b.password!=='string' || b.password.length<8 || Buffer.byteLength(b.password)>72) fail('Password must have at least 8 characters and at most 72 bytes.');
  if(b.confirm!==undefined && b.confirm!==b.password) fail('Passwords do not match.');
  const hash=await bcrypt.hash(b.password,12);
  const user=await transaction(async db=>{
    const result=await db.query('INSERT INTO users(id,name,email,password_hash,department) VALUES($1,$2,$3,$4,$5) RETURNING *',[id('u'),name,email,hash,department]);
    await notifyAdmins(db,'New student registered',name+' joined CampusFlow.','info');
    return result.rows[0];
  });
  await loginSession(req,user.id);
  res.status(201).json({user:camel(user)});
});
router.post('/login', limiter, async(req,res)=>{
  const email=text(req.body.email,'Email',254).toLowerCase();
  const password=req.body.password;
  if(typeof password!=='string' || password.length>1000) fail('Invalid email or password.',401);
  const user=(await pool.query('SELECT * FROM users WHERE email=$1',[email])).rows[0];
  if(!user || !user.active || !await bcrypt.compare(password,user.password_hash)) fail('Invalid email or password, or account is inactive.',401);
  await loginSession(req,user.id); res.json({user:camel(user)});
});
router.post('/logout',async(req,res)=>{
  await new Promise((resolve,reject)=>req.session.destroy(error=>error?reject(error):resolve()));
  res.clearCookie('campusflow.sid'); res.json({message:'Signed out successfully'});
});
async function requireUser(req,res,next) {
  const user=(await pool.query('SELECT * FROM users WHERE id=$1 AND active=true',[req.session.userId||''])).rows[0];
  if(!user) fail('Please sign in to continue.',401);
  req.user=user; next();
}
function requireAdmin(req,res,next) { if(req.user.role!=='admin') fail('Administrator access is required.',403); next(); }
module.exports={router,requireUser,requireAdmin};
