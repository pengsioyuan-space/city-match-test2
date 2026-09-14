'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const PORT = Number(process.env.PORT || 8787);
const APP_SECRET = process.env.APP_SECRET || 'local-development-only-change-me';
const ADMIN_KEY = process.env.ADMIN_KEY || 'local-admin-change-me';
const MAX_BODY = 64 * 1024;
const rateMap = new Map();
fs.mkdirSync(DATA_DIR, { recursive: true });

function dbFile(name) { return path.join(DATA_DIR, `${name}.json`); }
function readDb(name) { try { return JSON.parse(fs.readFileSync(dbFile(name), 'utf8')); } catch { return []; } }
function writeDb(name, value) {
  const target = dbFile(name); const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2)); fs.renameSync(temp, target);
}
function id(prefix) { return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`; }
function json(res, status, data) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Admin-Key','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS'});
  res.end(JSON.stringify(data));
}
function corsPreflight(res) {
  res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Admin-Key','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS','Access-Control-Max-Age':'86400'});
  res.end();
}
function body(req) { return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>MAX_BODY){reject(new Error('BODY_TOO_LARGE'));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(new Error('INVALID_JSON'));}});req.on('error',reject);}); }
function normalizeEmail(v) { return String(v||'').trim().toLowerCase(); }
function hashPassword(password, salt=crypto.randomBytes(16).toString('hex')) { return {salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}; }
function safeEqual(a,b){const x=Buffer.from(String(a));const y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function sign(payload) { const data=Buffer.from(JSON.stringify(payload)).toString('base64url'); const sig=crypto.createHmac('sha256',APP_SECRET).update(data).digest('base64url'); return `${data}.${sig}`; }
function verifyToken(req) {
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,''); const [data,sig]=token.split('.');
  if(!data||!sig||!safeEqual(sig,crypto.createHmac('sha256',APP_SECRET).update(data).digest('base64url'))) return null;
  try{const p=JSON.parse(Buffer.from(data,'base64url').toString());return p.exp>Date.now()?p:null;}catch{return null;}
}
function isAdmin(req){return safeEqual(req.headers['x-admin-key']||'',ADMIN_KEY);}
function limited(req){const ip=req.socket.remoteAddress||'local';const now=Date.now();const v=rateMap.get(ip)||{at:now,count:0};if(now-v.at>60000){v.at=now;v.count=0;}v.count++;rateMap.set(ip,v);return v.count>100;}
function publicUser(u){return {id:u.id,email:u.email,nickname:u.nickname,createdAt:u.createdAt};}
function publicCode(c){return {id:c.id,code:c.code,note:c.note||'',uses:Number(c.uses||0),maxUses:Number(c.maxUses||1),expiresAt:c.expiresAt||null,disabled:!!c.disabled,createdAt:c.createdAt};}

async function api(req,res,url){
  if(limited(req)) return json(res,429,{error:'请求过于频繁'});
  if(req.method==='GET'&&url.pathname==='/api/health') return json(res,200,{ok:true,service:'city-match-api'});
  if(req.method==='POST'&&url.pathname==='/api/auth/register'){
    const x=await body(req),email=normalizeEmail(x.email),password=String(x.password||'');
    if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8) return json(res,400,{error:'邮箱格式不正确，密码至少 8 位'});
    const users=readDb('users'); if(users.some(u=>u.email===email)) return json(res,409,{error:'该邮箱已注册'});
    const pass=hashPassword(password); const user={id:id('usr'),email,nickname:String(x.nickname||'城市探索者').slice(0,30),...pass,createdAt:new Date().toISOString()};
    users.push(user);writeDb('users',users);return json(res,201,{user:publicUser(user),token:sign({sub:user.id,exp:Date.now()+7*864e5})});
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/login'){
    const x=await body(req),users=readDb('users'),user=users.find(u=>u.email===normalizeEmail(x.email));
    if(!user) return json(res,401,{error:'邮箱或密码错误'});const pass=hashPassword(String(x.password||''),user.salt);
    if(!safeEqual(pass.hash,user.hash)) return json(res,401,{error:'邮箱或密码错误'});
    return json(res,200,{user:publicUser(user),token:sign({sub:user.id,exp:Date.now()+7*864e5})});
  }
  if(req.method==='GET'&&url.pathname==='/api/me'){
    const auth=verifyToken(req);if(!auth)return json(res,401,{error:'请先登录'});const user=readDb('users').find(u=>u.id===auth.sub);return user?json(res,200,{user:publicUser(user)}):json(res,404,{error:'用户不存在'});
  }
  if(req.method==='PATCH'&&url.pathname==='/api/me'){
    const auth=verifyToken(req);if(!auth)return json(res,401,{error:'请先登录'});const x=await body(req),users=readDb('users'),user=users.find(u=>u.id===auth.sub);if(!user)return json(res,404,{error:'用户不存在'});user.nickname=String(x.nickname||user.nickname).trim().slice(0,30)||user.nickname;writeDb('users',users);return json(res,200,{user:publicUser(user)});
  }
  if(req.method==='GET'&&url.pathname==='/api/access-codes'){
    if(!isAdmin(req)) return json(res,403,{error:'无管理权限'});return json(res,200,readDb('codes').slice(-200).reverse().map(publicCode));
  }
  if(req.method==='POST'&&url.pathname==='/api/access-codes'){
    if(!isAdmin(req)) return json(res,403,{error:'无管理权限'});const x=await body(req),codes=readDb('codes');const code=String(x.code||crypto.randomBytes(5).toString('hex')).toUpperCase();
    if(codes.some(c=>c.code===code)) return json(res,409,{error:'访问码已存在'});const row={id:id('code'),code,note:String(x.note||'').slice(0,40),uses:0,maxUses:Number(x.maxUses||1),expiresAt:x.expiresAt||null,disabled:false,createdAt:new Date().toISOString()};codes.push(row);writeDb('codes',codes);return json(res,201,publicCode(row));
  }
  if(req.method==='PATCH'&&/^\/api\/access-codes\/[^/]+$/.test(url.pathname)){
    if(!isAdmin(req)) return json(res,403,{error:'无管理权限'});const codeId=url.pathname.split('/')[3],x=await body(req),codes=readDb('codes'),row=codes.find(c=>c.id===codeId);if(!row)return json(res,404,{error:'访问码不存在'});if(typeof x.disabled==='boolean')row.disabled=x.disabled;if(typeof x.note==='string')row.note=x.note.slice(0,40);writeDb('codes',codes);return json(res,200,publicCode(row));
  }
  if(req.method==='POST'&&url.pathname==='/api/access-codes/redeem'){
    const x=await body(req),codes=readDb('codes'),row=codes.find(c=>c.code===String(x.code||'').trim().toUpperCase());
    if(!row||row.disabled||row.uses>=row.maxUses||(row.expiresAt&&Date.parse(row.expiresAt)<Date.now())) return json(res,400,{error:'访问码无效或已过期'});row.uses++;writeDb('codes',codes);return json(res,200,{ok:true,accessToken:sign({scope:'quiz',codeId:row.id,exp:Date.now()+24*3600e3})});
  }
  if(req.method==='POST'&&url.pathname==='/api/orders'){
    const auth=verifyToken(req);if(!auth)return json(res,401,{error:'请先登录'});const x=await body(req);const orders=readDb('orders');const row={id:id('ord'),userId:auth.sub,product:'city-match',amount:Number(x.amount||0),currency:'CNY',status:'pending',createdAt:new Date().toISOString()};orders.push(row);writeDb('orders',orders);return json(res,201,row);
  }
  if(req.method==='POST'&&/^\/api\/orders\/[^/]+\/confirm$/.test(url.pathname)){
    if(!isAdmin(req)) return json(res,403,{error:'无管理权限'});const orderId=url.pathname.split('/')[3],orders=readDb('orders'),row=orders.find(o=>o.id===orderId);if(!row)return json(res,404,{error:'订单不存在'});row.status='paid';row.paidAt=new Date().toISOString();writeDb('orders',orders);return json(res,200,row);
  }
  if(req.method==='GET'&&url.pathname==='/api/orders'){
    const auth=verifyToken(req);if(!auth)return json(res,401,{error:'请先登录'});return json(res,200,readDb('orders').filter(o=>o.userId===auth.sub));
  }
  if(req.method==='POST'&&url.pathname==='/api/reports'){
    const x=await body(req);if(!Array.isArray(x.topCities)||!x.answers)return json(res,400,{error:'报告数据不完整'});const auth=verifyToken(req),reports=readDb('reports');const row={id:id('rpt'),userId:auth?.sub||null,topCities:x.topCities.slice(0,3),dimensionAnalysis:x.dimensionAnalysis||[],answers:x.answers,createdAt:new Date().toISOString()};reports.push(row);writeDb('reports',reports);return json(res,201,{id:row.id,createdAt:row.createdAt});
  }
  if(req.method==='GET'&&url.pathname==='/api/reports'){
    const auth=verifyToken(req);if(!auth)return json(res,401,{error:'请先登录'});return json(res,200,readDb('reports').filter(r=>r.userId===auth.sub).map(r=>({id:r.id,topCities:r.topCities,createdAt:r.createdAt})));
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/reports/')){const report=readDb('reports').find(r=>r.id===url.pathname.split('/')[3]);return report?json(res,200,report):json(res,404,{error:'报告不存在'});}
  return json(res,404,{error:'接口不存在'});
}

function staticFile(req,res,url){
  const wanted=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));const file=path.resolve(ROOT,wanted);
  if(!file.startsWith(ROOT)||file.includes(`${path.sep}server${path.sep}`)) return json(res,403,{error:'禁止访问'});
  fs.readFile(file,(err,data)=>{if(err)return json(res,404,{error:'页面不存在'});const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(data);});
}
const server=http.createServer(async(req,res)=>{try{if(req.method==='OPTIONS')return corsPreflight(res);const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/'))await api(req,res,url);else staticFile(req,res,url);}catch(e){json(res,e.message==='BODY_TOO_LARGE'?413:400,{error:e.message==='INVALID_JSON'?'请求格式错误':'请求失败'});}});
server.listen(PORT,()=>console.log(`City Match running at http://localhost:${PORT}`));
