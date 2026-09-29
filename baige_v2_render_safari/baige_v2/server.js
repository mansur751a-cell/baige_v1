import express from 'express';
import http from 'http';
import {WebSocketServer} from 'ws';
import QRCode from 'qrcode';
import crypto from 'crypto';
const app=express(), server=http.createServer(app), wss=new WebSocketServer({server});
const PORT=process.env.PORT||8765; app.use(express.static('public'));
app.get('/health',(_,r)=>r.json({ok:true,game:'BAIGE v2'}));
app.get('/qr',async(req,res)=>{try{res.type('text/plain').send(await QRCode.toDataURL(`${req.protocol}://${req.get('host')}/phone`,{margin:1,width:700}))}catch(e){res.status(500).send('QR error')}});
const players=new Map(),screens=new Set(); let race={state:'lobby',winner:null};
const send=(ws,m)=>ws.readyState===1&&ws.send(JSON.stringify(m)); const snap=()=>[...players.values()].map(({ws,...p})=>p); const broadcast=m=>{for(const ws of [...screens,...players.values()].map(x=>x.ws||x))send(ws,m)};
wss.on('connection',ws=>{let role=null,id=null;send(ws,{type:'hello',race,players:snap()});ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
if(m.type==='screen'){role='screen';screens.add(ws);send(ws,{type:'state',race,players:snap()});return}
if(m.type==='join'){const name=String(m.name||'').trim().slice(0,24);if(!name)return send(ws,{type:'error',message:'Введите имя'});if(race.state!=='lobby')return send(ws,{type:'error',message:'Гонка уже идёт'});id=crypto.randomUUID();players.set(id,{id,name,lane:players.size,progress:0,speed:0,finished:false,ws});role='player';send(ws,{type:'joined',id,name,lane:players.get(id).lane});broadcast({type:'players',players:snap()});return}
if(m.type==='shake'&&role==='player'&&id){const p=players.get(id);if(!p||p.finished||race.state!=='running')return;const intensity=Math.max(0,Math.min(1,Number(m.intensity)||0));p.speed=Math.min(1.8,p.speed+0.025+intensity*0.14);return}
if(m.type==='start'&&role==='screen'){if(race.state!=='lobby'||!players.size)return;race={state:'running',winner:null};for(const p of players.values()){p.progress=0;p.speed=0;p.finished=false}broadcast({type:'race',race,players:snap()});return}
if(m.type==='reset'&&role==='screen'){for(const p of players.values())send(p.ws,{type:'resetPhone'});players.clear();race={state:'lobby',winner:null};broadcast({type:'race',race,players:[]})}
});ws.on('close',()=>{screens.delete(ws);if(id){players.delete(id);broadcast({type:'players',players:snap()})}})});
setInterval(()=>{if(race.state!=='running')return;let win=null;for(const p of players.values()){if(p.finished)continue;p.progress+=p.speed;p.speed*=.955;if(p.progress>=100){p.progress=100;p.finished=true;if(!win)win=p}}if(win){race.state='finished';race.winner={id:win.id,name:win.name,lane:win.lane};broadcast({type:'finish',winner:race.winner,players:snap()})}else broadcast({type:'tick',players:snap()})},80);
server.listen(PORT,()=>console.log('BAIGE v2 on '+PORT));
