// Optional local/deployment web server for FX Tools with official Mojang skin lookup.
// Run with Node 18+: node serve.mjs   (then visit http://localhost:8765)
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=dirname(fileURLToPath(import.meta.url)),PORT=Number(process.env.PORT||8765);
const types={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain'};
const cache=new Map();
async function jsonFrom(url){const r=await fetch(url,{signal:AbortSignal.timeout(9000)});if(r.status===404)return null;if(!r.ok)throw Error('Mojang status '+r.status);return r.json()}
async function skin(name){let cached=cache.get(name.toLowerCase());if(cached&&Date.now()-cached.time<60000)return cached;
 const user=await jsonFrom('https://api.minecraftservices.com/minecraft/profile/lookup/name/'+encodeURIComponent(name));if(!user?.id)return null;
 const profile=await jsonFrom('https://sessionserver.mojang.com/session/minecraft/profile/'+encodeURIComponent(user.id));
 const textures=profile?.properties?.find(p=>p.name==='textures')?.value;if(!textures)throw Error('No hay textura de skin');
 const info=JSON.parse(Buffer.from(textures,'base64').toString('utf8'));
 const url=info?.textures?.SKIN?.url;if(!url||!/^https:\/\/textures\.minecraft\.net\//i.test(url))throw Error('URL de textura no válida');
 const response=await fetch(url,{signal:AbortSignal.timeout(9000)});if(!response.ok)throw Error('Textura no disponible');
 const data=Buffer.from(await response.arrayBuffer());if(data.length>1024*1024||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('PNG inválido');
 const model=info?.textures?.SKIN?.metadata?.model==='slim'?'slim':'classic';cached={data,model,time:Date.now()};cache.set(name.toLowerCase(),cached);return cached;
}
createServer(async (req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/skin'){
  const name=url.searchParams.get('name')||'';if(!/^[a-zA-Z0-9_]{1,16}$/.test(name)){res.writeHead(400);res.end('Invalid username');return}
  const result=await skin(name);if(!result){res.writeHead(404);res.end('Player not found');return}
  res.writeHead(200,{'Content-Type':'image/png','Content-Length':result.data.length,'X-Minecraft-Model':result.model,'Cache-Control':'no-store'});res.end(result.data);return;
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
 let target=resolve(ROOT,'.'+decodeURIComponent(url.pathname));if(url.pathname==='/'||url.pathname.endsWith('/'))target=resolve(target,'index.html');
 if(!(target===ROOT||target.startsWith(ROOT+sep))){res.writeHead(403);res.end();return}
 let file;try{file=await readFile(target)}catch{res.writeHead(404);res.end('Not found');return}
 res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Content-Length':file.length});if(req.method==='HEAD'){res.end();return}res.end(file);
 }catch(e){console.error('Request error:',e.message);res.writeHead(503,{'Content-Type':'text/plain'});res.end('Service unavailable')}}).listen(PORT,()=>console.log(`FX Tools http://localhost:${PORT}/`));
