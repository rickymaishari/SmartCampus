const express = require('express');
const path = require('node:path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const {pool} = require('./db');
const auth = require('./auth');
const app = express();
if(!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length<32) throw new Error('Set SESSION_SECRET in backend/.env (at least 32 characters).');
app.disable('x-powered-by');
app.use(express.json({limit:'32kb'}));
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','same-origin');
  // Same-origin JSON requests plus SameSite cookies protect write operations.
  if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
    if(req.get('sec-fetch-site')==='cross-site') return res.status(403).json({error:'Cross-site request blocked.'});
    const origin=req.get('origin');
    if(origin && origin!==`${req.protocol}://${req.get('host')}`) return res.status(403).json({error:'Request origin is not allowed.'});
    if(!req.is('application/json')) return res.status(415).json({error:'Send JSON data.'});
  }
  next();
});
app.use(session({name:'campusflow.sid',store:new PgSession({pool,tableName:'sessions'}),secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000}}));
app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
app.get('/api/health',async(req,res)=>{await pool.query('SELECT 1');res.json({status:'ok',database:'connected'});});
app.use('/api/auth',auth.router);
app.use('/api',auth.requireUser,require('./routes'));
app.use('/api',(req,res)=>res.status(404).json({error:'API endpoint not found.'}));
app.use(express.static(path.join(__dirname,'../../frontend')));
app.use((error,req,res,next)=>{
  let status=error.status||500, message=error.status?error.message:'Server error. Please try again.';
  if(error.code==='23505'){status=409;message='This email, registration or claim already exists.';}
  if(error.code==='23P01'){status=409;message='This room is already booked or requested for the selected time. Choose another slot.';}
  if(['23503','23514','22007','22008','22P02'].includes(error.code)){status=400;message='Invalid data or referenced record.';}
  if(status>=500) console.error('Request failed:',error.code||error.message);
  res.status(status).json({error:message});
});
const server=app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`CampusFlow: http://localhost:${process.env.PORT||3000}`));
function shutdown(){server.close(()=>pool.end().then(()=>process.exit(0)));}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
