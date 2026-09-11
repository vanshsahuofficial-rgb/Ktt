import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
const app=express(); app.use(cors()); app.use(express.json({limit:'8mb'}));
const PORT=Number(process.env.PORT||8787);
const DATA=path.join(process.cwd(),'server','data.json');
const UP=path.join(process.cwd(),'server','uploads'); fs.mkdirSync(UP,{recursive:true});
const upload=multer({dest:UP,limits:{fileSize:6*1024*1024}});
type DB={users:any[],products:any[],enquiries:any[],orders:any[],sessions:any[]};
const seed:DB={users:[{id:'u-artisan',name:'Ramesh Kumar',email:'artisan@craftora.demo',passwordHash:'',role:'artisan',phone:'+91 90000 12345',bio:'Traditional artisan creating bamboo and terracotta crafts.'},{id:'u-buyer',name:'Priya Sharma',email:'buyer@craftora.demo',passwordHash:'',role:'buyer'}],products:[],enquiries:[],orders:[],sessions:[]};
function read():DB{if(!fs.existsSync(DATA)){fs.writeFileSync(DATA,JSON.stringify(seed,null,2));}return JSON.parse(fs.readFileSync(DATA,'utf8'));}
function write(db:DB){fs.writeFileSync(DATA,JSON.stringify(db,null,2));}
function id(prefix:string){return prefix+'_'+crypto.randomBytes(7).toString('hex')}
function hash(p:string){return crypto.createHash('sha256').update(p).digest('hex')}
function token(){return crypto.randomBytes(24).toString('hex')}
function auth(req:any,res:any,next:any){const t=req.headers.authorization?.replace('Bearer ',''); const db=read(); const s=db.sessions.find(x=>x.token===t); if(!s)return res.status(401).json({error:'Please login'}); const u=db.users.find(x=>x.id===s.userId); if(!u)return res.status(401).json({error:'Session expired'}); req.user=u; next()}

app.get('/api/health',(_,res)=>res.json({ok:true,gemini:!!process.env.GEMINI_API_KEY}));
app.post('/api/auth/signup',(req,res)=>{const {name,email,password,role}=req.body; if(!name||!email||!password||!['artisan','buyer'].includes(role))return res.status(400).json({error:'Name, email, password and role are required'}); const db=read(); if(db.users.some(u=>u.email.toLowerCase()===email.toLowerCase()))return res.status(409).json({error:'Email already registered'}); const u={id:id('u'),name,email:email.toLowerCase(),passwordHash:hash(password),role}; db.users.push(u); const t=token(); db.sessions.push({token:t,userId:u.id}); write(db); res.json({token:t,user:{id:u.id,name:u.name,email:u.email,role:u.role}})});
app.post('/api/auth/login',(req,res)=>{const {email,password}=req.body; const db=read(); const u=db.users.find(x=>x.email===String(email).toLowerCase()); if(!u||u.passwordHash!==hash(password))return res.status(401).json({error:'Invalid email or password'}); const t=token(); db.sessions.push({token:t,userId:u.id}); write(db); res.json({token:t,user:{id:u.id,name:u.name,email:u.email,role:u.role}})});
app.get('/api/me',auth,(req:any,res)=>res.json({user:{id:req.user.id,name:req.user.name,email:req.user.email,role:req.user.role}}));
app.post('/api/logout',auth,(req:any,res)=>{const db=read(); const t=req.headers.authorization?.replace('Bearer ',''); db.sessions=db.sessions.filter(s=>s.token!==t); write(db); res.json({ok:true})});

app.get('/api/products',(req,res)=>{const db=read(); let ps=db.products.filter(p=>p.published); const q=String(req.query.q||'').toLowerCase(); const c=String(req.query.category||''); if(q)ps=ps.filter(p=>JSON.stringify(p).toLowerCase().includes(q)); if(c&&c!=='All')ps=ps.filter(p=>p.category===c); res.json({products:ps.map(p=>({...p,artisan:db.users.find(u=>u.id===p.artisanId)?.name||'Craftora Artisan'}))})});
app.get('/api/products/mine',auth,(req:any,res)=>{const db=read(); res.json({products:db.products.filter(p=>p.artisanId===req.user.id)})});
app.post('/api/products',auth,(req:any,res)=>{if(req.user.role!=='artisan')return res.status(403).json({error:'Artisan access required'}); const body=req.body; const p={id:id('p'),artisanId:req.user.id,productName:body.productName||'Untitled Craft',category:body.category||'Handicrafts',description:body.description||'',materials:body.materials||'',tags:body.tags||[],suggestedPrice:Number(body.suggestedPrice||0),price:Number(body.price||body.suggestedPrice||0),image:body.image||'/assets/basket.jpg',published:!!body.published,createdAt:new Date().toISOString()}; const db=read(); db.products.unshift(p); write(db); res.json({product:p})});
app.patch('/api/products/:id',auth,(req:any,res)=>{const db=read(); const p=db.products.find(x=>x.id===req.params.id&&x.artisanId===req.user.id); if(!p)return res.status(404).json({error:'Product not found'}); Object.assign(p,req.body); write(db); res.json({product:p})});

app.get('/api/enquiries',auth,(req:any,res)=>{const db=read(); const list=db.enquiries.filter(e=>e.artisanId===req.user.id||e.buyerId===req.user.id); res.json({enquiries:list.map(e=>({...e,product:db.products.find(p=>p.id===e.productId)}))})});
app.post('/api/enquiries',auth,(req:any,res)=>{const db=read(); const p=db.products.find(x=>x.id===req.body.productId); if(!p)return res.status(404).json({error:'Product not found'}); const e={id:id('e'),productId:p.id,artisanId:p.artisanId,buyerId:req.user.id,message:req.body.message||'I am interested in this craft.',status:'Pending',createdAt:new Date().toISOString()}; db.enquiries.unshift(e); write(db); res.json({enquiry:e})});
app.patch('/api/enquiries/:id',auth,(req:any,res)=>{const db=read(); const e=db.enquiries.find(x=>x.id===req.params.id&&x.artisanId===req.user.id); if(!e)return res.status(404).json({error:'Enquiry not found'}); e.status=req.body.status; write(db); res.json({enquiry:e})});
app.get('/api/orders',auth,(req:any,res)=>{const db=read(); res.json({orders:db.orders.filter(o=>o.artisanId===req.user.id||o.buyerId===req.user.id).map(o=>({...o,product:db.products.find(p=>p.id===o.productId)}))})});
app.post('/api/orders',auth,(req:any,res)=>{const db=read(); const p=db.products.find(x=>x.id===req.body.productId); if(!p)return res.status(404).json({error:'Product not found'}); const o={id:id('o'),productId:p.id,artisanId:p.artisanId,buyerId:req.user.id,quantity:Number(req.body.quantity||1),total:Number(p.price||p.suggestedPrice||0)*Number(req.body.quantity||1),status:'Pending',createdAt:new Date().toISOString()}; db.orders.unshift(o); write(db); res.json({order:o})});
app.patch('/api/orders/:id',auth,(req:any,res)=>{const db=read(); const o=db.orders.find(x=>x.id===req.params.id&&x.artisanId===req.user.id); if(!o)return res.status(404).json({error:'Order not found'}); o.status=req.body.status; write(db); res.json({order:o})});

app.post('/api/ai/catalog',auth,upload.single('image'),async(req:any,res)=>{const text=String(req.body.description||''); const lang=String(req.body.language||'Hindi');
 if(!process.env.GEMINI_API_KEY){const name=text.match(/basket|tokri|basket/i)?'Handwoven Bamboo Basket':text.match(/pot|matka|ghada/i)?'Handcrafted Terracotta Matka':'Handcrafted Artisan Treasure'; const category=name.includes('Basket')?'Home Decor':name.includes('Matka')?'Pottery & Ceramics':'Handicrafts'; const materials=name.includes('Basket')?'Bamboo, natural fibre':'Clay, natural pigments'; return res.json({mode:'demo',catalog:{productName:name,category,description:`A thoughtfully handcrafted ${category.toLowerCase()} piece made by an Indian artisan. Designed to bring traditional craft character into contemporary spaces.`,materials,tags:['handmade','Indian craft','artisan-made','sustainable'],suggestedPrice:category==='Pottery & Ceramics'?899:1299,english:`Professional catalog generated in demo mode from ${lang} input.` ,hindi:'यह उत्पाद स्थानीय कारीगर द्वारा पारंपरिक तकनीक से हाथ से बनाया गया है।'}})}
 try{const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY}); const parts:any[]=[{text:`You are Craftora AI, an expert Indian handicraft cataloger. Understand the artisan's input language (${lang}) and return ONLY valid JSON with keys productName, category, description, materials, tags, suggestedPrice, english, hindi. Make the English and Hindi descriptions polished but faithful; do not invent highly specific facts not supported by the image/text. Artisan input: ${text}`}]; if(req.file){parts.push({inlineData:{mimeType:req.file.mimetype,data:fs.readFileSync(req.file.path).toString('base64')}})} const r=await ai.models.generateContent({model:'gemini-2.5-flash',contents:[{role:'user',parts}]}); const raw=r.text?.replace(/```json|```/g,'').trim()||'{}'; const catalog=JSON.parse(raw); res.json({mode:'gemini',catalog})}catch(err){console.error(err); res.status(502).json({error:'Gemini analysis failed. Retry or use demo mode.'})}finally{if(req.file)fs.unlink(req.file.path,()=>{})}}
);

app.post('/api/upload',auth,upload.single('image'),(req:any,res)=>{if(!req.file)return res.status(400).json({error:'Image required'}); const ext=path.extname(req.file.originalname)||'.jpg'; const final=`${id('img')}${ext}`; fs.renameSync(req.file.path,path.join(UP,final)); res.json({url:`/uploads/${final}`})});
app.use('/uploads',express.static(UP));
app.use(express.static(path.join(process.cwd(),'dist')));
app.get(/.*/,(_,res)=>res.sendFile(path.join(process.cwd(),'dist','index.html')));
app.listen(PORT,()=>console.log(`Craftora API running on http://localhost:${PORT}`));
