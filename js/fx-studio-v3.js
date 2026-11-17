/* FX Tools / Studio v3.7: read-only chat dock, browser-source support, compact direct mode.
   Does not ask for credentials or impersonate connected services. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const sourceKey='studio.unifiedChatURL';
 const liveKey='studio.directMode';
 const frame=$('unified-chat-frame'),empty=$('chat-empty'),connectBtn=$('chat-connect');
 const trigger=$('chat-settings-trigger'),modal=$('modal-chat'),urlInput=$('chat-source-url');
 const openBtn=$('chat-open-link'),status=$('chat-connection-label');
 const toggle=$('toggle-live-mode');
 const frameUrl=()=>FXStorage.get(sourceKey,'')||'';
 // No arbitrary protocols or credentials; users may supply a trusted hosted browser dock.
 function normalizeURL(raw){
   const value=String(raw||'').trim();if(!value)return '';
   let u;try{u=new URL(value)}catch{throw Error('Introduce una URL válida.')} 
   const loopback=['localhost','127.0.0.1','[::1]'].includes(u.hostname);
   if(u.protocol!=='https:'&&!(loopback&&u.protocol==='http:'))throw Error('Utiliza una URL HTTPS, o HTTP local.');
   if(u.username||u.password)throw Error('No incluyas usuario ni contraseña en el enlace.');
   return u.href;
 }
 function renderSource(){
   const url=frameUrl();const connected=!!url;
   empty.hidden=connected;frame.hidden=!connected;openBtn.hidden=!connected;
   status.innerHTML=connected?'<span class="chat-pending-dot"></span> Fuente configurada':'<span class="chat-offline-dot"></span> Sin conectar';
   // Source configured is not a confirmed live connection; iframe restrictions may apply.
   if(connected&&frame.src!==url)frame.src=url;
   if(!connected&&frame.getAttribute('src')!=='about:blank')frame.src='about:blank';
 }
 function close(){modal.classList.remove('open');}
 function open(){urlInput.value=frameUrl();modal.classList.add('open');urlInput.focus();}
 trigger.addEventListener('click',open);connectBtn.addEventListener('click',open);
 $('chat-save-source').addEventListener('click',()=>{
   try{
     const url=normalizeURL(urlInput.value);
     if(!url)throw Error('Pega un enlace o elige Desconectar.');
     FXStorage.set(sourceKey,url);close();renderSource();FXUI.toast('Fuente guardada','El chat intentará abrirse en este panel.');
   }catch(e){FXUI.toast('Enlace no válido',e.message)}
 });
 $('chat-remove-source').addEventListener('click',()=>{
   FXStorage.remove(sourceKey);close();renderSource();FXUI.toast('Chat desconectado','Puedes vincular otra fuente cuando quieras.');
 });
 openBtn.addEventListener('click',()=>{const url=frameUrl();if(url)window.open(url,'_blank','noopener,noreferrer')});
 const modes=[...document.querySelectorAll('[data-chat-tab]')];
 function setTab(name){
   modes.forEach(btn=>{const active=btn.dataset.chatTab===name;btn.classList.toggle('is-active',active);btn.setAttribute('aria-selected',active?'true':'false')});
   for(const id of ['messages','activity']){const el=$('chat-'+id);const on=id===name;el.hidden=!on;el.classList.toggle('is-active',on)}
 }
 modes.forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.chatTab)));
 function setLiveMode(active,save){
   document.body.classList.toggle('fx-direct-mode',!!active);
   toggle.setAttribute('aria-pressed',active?'true':'false');
   toggle.querySelector('span').textContent=active?'Volver al estudio':'Modo directo';
   if(active)setTab('messages');
   if(save)FXStorage.set(liveKey,!!active);
 }
 toggle.addEventListener('click',()=>setLiveMode(!document.body.classList.contains('fx-direct-mode'),true));
 if(new URLSearchParams(location.search).get('modo')==='directo')setLiveMode(true,false);
 else setLiveMode(FXStorage.get(liveKey,false),false);
 renderSource();
})();
