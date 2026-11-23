/* FX Tools · Museo v4.12
   Entrada: el título central del encabezado se desvanece mientras el lomo
   lleva el nombre de la sala. La página real lo muestra al terminar el giro.
   Salida: conserva intacto el relevo de título hacia Museo de la v4.10.
   Sin imágenes nuevas ni cambios en Cobblemon Tracker. */
(()=>{'use strict';
  // La vista previa de la otra cara no debe modificar estado ni iniciar otra navegación.
  // Las salas cargadas dentro del libro son solo una vista previa visual.
  // No duplicar su título encima del nombre del lomo durante el giro 3D.
  if(window.self!==window.top){
    if(new URLSearchParams(location.search).has('fx_book_origin'))
      document.body.classList.add('fx-museum-preview');
    return;
  }
  const PREFIX='fx.museum.book.';
  const LAST=PREFIX+'last.v44',ENTRY=PREFIX+'entry.v44',RETURN=PREFIX+'return.v44',COB_RETURN=PREFIX+'cobblemon.v44';
  const books={
    campeones:{name:'Campeones',cls:'fx-book-champions'},
    arbol:{name:'Árbol del club',cls:'fx-book-club'},
    leyendas:{name:'Leyendas',cls:'fx-book-legends'},
    cobblemon:{name:'Cobblemon Tracker',cls:'fx-book-archive'}
  };
  const previews={
    campeones:'<span class="fx-book-animation fx-book-medal" aria-hidden="true"><span class="fx-book-medal-rotor"><span class="fx-book-medal-face front"></span><span class="fx-book-medal-face back"></span><span class="fx-book-medal-edge"></span></span></span>',
    arbol:'<span class="fx-book-animation fx-book-tree" aria-hidden="true"><span class="fx-tree-branch trunk"></span><span class="fx-tree-branch left"></span><span class="fx-tree-branch right"></span><span class="fx-tree-node root"></span><span class="fx-tree-node child one"></span><span class="fx-tree-node child two"></span><span class="fx-tree-node child three"></span></span>',
    leyendas:'<span class="fx-book-animation fx-book-cards" aria-hidden="true"><span class="fx-book-cards-track"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></span></span>'
  };
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onLibrary=!!document.getElementById('museumBooksMain');
  const libraryUrl=new URL('index.html',new URL('./',location.href));
  const get=k=>{try{return JSON.parse(sessionStorage.getItem(k))}catch{return null}};
  const put=(k,data)=>{try{sessionStorage.setItem(k,JSON.stringify(data))}catch{}};
  const del=k=>{try{sessionStorage.removeItem(k)}catch{}};
  const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}};
  const viewport=()=>({left:0,top:0,width:innerWidth,height:innerHeight});
  const fallbackRect=()=>({left:innerWidth*.07,top:innerHeight*.11,width:innerWidth*.86,height:innerHeight*.78});
  const clickOK=e=>!e.defaultPrevented&&e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=t=>t*t*(3-2*t);
  let busy=false;

  const roomId=()=>{
    if(/campeones\.html$/.test(location.pathname))return 'campeones';
    if(/leyendas\.html$/.test(location.pathname))return 'leyendas';
    if(/miembros\.html$/.test(location.pathname))return 'arbol';
    return get(LAST)?.id||'campeones';
  };
  function completeMedals(root){
    root.querySelectorAll('.fx-book-medal-edge').forEach(edge=>{
      if(edge.dataset.facets)return;
      edge.dataset.facets='1';
      const f=document.createDocumentFragment();
      for(let i=0;i<40;i++){
        const rib=document.createElement('i');rib.className='fx-book-medal-rib';
        rib.style.setProperty('--rib-angle',i*9+'deg');f.appendChild(rib);
      }
      edge.appendChild(f);
    });
  }
  function makeBook(id,source){
    if(source){
      const el=source.cloneNode(true);
      el.removeAttribute('href');el.removeAttribute('id');el.removeAttribute('tabindex');el.removeAttribute('aria-label');
      el.classList.remove('fx-book-is-restacking','fx-preview-active');el.style.visibility='';
      completeMedals(el);return el;
    }
    const data=books[id]||books.campeones;
    const el=document.createElement('div');
    el.className='fx-museum-book '+data.cls;el.dataset.book=id;
    const spine=document.createElement('span');spine.className='fx-book-spine';
    const title=document.createElement('span');title.className='fx-book-title';title.textContent=data.name;
    if(id==='cobblemon')spine.appendChild(title);
    else{
      const a=document.createElement('span'),b=document.createElement('span');
      a.innerHTML=previews[id].replace('fx-book-animation ','fx-book-animation fx-book-animation-left ');
      b.innerHTML=previews[id];spine.append(a.firstElementChild,title,b.firstElementChild);
    }
    el.appendChild(spine);completeMedals(el);return el;
  }
  function layoutSnapshot(){
    const rects={};
    document.querySelectorAll('.fx-museum-book[data-book]').forEach(book=>rects[book.dataset.book]=rect(book));
    return rects;
  }
  function scaledRect(r,last){
    if(!r||!last?.viewport)return null;
    const x=innerWidth/last.viewport.width,y=innerHeight/last.viewport.height;
    if(Math.abs(x-1)>.12||Math.abs(y-1)>.12)return null;
    return {left:r.left*x,top:r.top*y,width:r.width*x,height:r.height*y};
  }
  // File URL pages may have separate sessionStorage origins. Carry the selected
  // book's rectangle in the destination URL so the return can target its real
  // place even if stored state is unavailable. This contains only layout data.
  function encodeBookOrigin(box,scroll){
    const values=[box.left,box.top,box.width,box.height,innerWidth,innerHeight,scroll];
    return values.map(x=>Math.round(x)).join(',');
  }
  function decodeBookOrigin(){
    const raw=new URLSearchParams(location.search).get('fx_book_origin');
    if(!raw)return null;
    const values=raw.split(',').map(Number);
    if(values.length!==7||!values.every(Number.isFinite))return null;
    const [left,top,width,height,vw,vh,scrollY]=values;
    if(width<=0||height<=0||vw<=0||vh<=0||width>vw*2||height>vh*2)return null;
    return {rect:{left,top,width,height},viewport:{width:vw,height:vh},scrollY:Math.max(0,scrollY)};
  }
  // When file:// isolates storage between pages, rebuild the *other* books
  // from the selected book's known position. All books share height/12px gap;
  // this avoids an empty background while the selected book is closing.
  function approximateSnapshot(origin,selected){
    if(!origin)return null;
    const order=Object.keys(books),at=order.indexOf(selected),rects={};
    for(let i=0;i<order.length;i++){
      rects[order[i]]={...origin.rect,top:origin.rect.top+(i-at)*(origin.rect.height+12)};
    }
    return {rects,viewport:origin.viewport,scrollY:origin.scrollY};
  }
  function returnBackdrop(last,selected){
    const bg=document.createElement('div');bg.className='fx-museum-return-backdrop';bg.setAttribute('aria-hidden','true');
    for(const id of Object.keys(books)){
      if(id===selected)continue;
      const box=scaledRect(last?.rects?.[id],last);if(!box)continue;
      const book=makeBook(id);book.classList.add('fx-museum-return-book');
      Object.assign(book.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'});
      bg.appendChild(book);
    }
    document.body.appendChild(bg);requestAnimationFrame(()=>bg.classList.add('is-visible'));return bg;
  }

  /* La pieza tiene DOS caras físicas en CSS. La posterior contiene la sala
     existente cargada desde su HTML real, nunca una imagen o pantalla inventada.
     Al regresar, se utiliza un clon visual de la sala que ya está abierta. */
  function createTransition(id,from,{source=null,destinationURL=null,roomContent=false}={}){
    const wrap=document.createElement('div');wrap.className='fx-museum-transition fx47-transition';
    wrap.setAttribute('aria-hidden','true');
    const holder=document.createElement('div');holder.className='fx-museum-transition-piece fx47-piece';
    Object.assign(holder.style,{left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px'});
    const flip=document.createElement('div');flip.className='fx47-flip';
    const outer=document.createElement('div');outer.className='fx47-face fx47-face-spine';
    const book=makeBook(id,source);book.classList.add('fx-museum-transition-book');outer.appendChild(book);
    const inner=document.createElement('div');inner.className='fx47-face fx47-face-inside';
    const surface=document.createElement('div');surface.className='fx47-room-surface';
    surface.style.width=innerWidth+'px';surface.style.height=innerHeight+'px';
    surface.style.transform=`scale(${from.width/innerWidth},${from.height/innerHeight})`;
    if(roomContent){
      const current=document.querySelector('.app-shell');
      if(current){const clone=current.cloneNode(true);clone.classList.add('fx47-room-clone');surface.appendChild(clone)}
    }else if(destinationURL){
      const iframe=document.createElement('iframe');iframe.className='fx47-room-frame';
      iframe.setAttribute('aria-hidden','true');iframe.tabIndex=-1;iframe.setAttribute('loading','eager');
      iframe.title='';
      // El archivo del Tracker no se ejecuta una segunda vez en su previsualización.
      if(id==='cobblemon')iframe.setAttribute('sandbox','allow-same-origin');
      iframe.src=destinationURL;
      surface.appendChild(iframe);
      iframe.addEventListener('load',()=>inner.classList.add('fx47-ready'),{once:true});
    }
    inner.appendChild(surface);flip.append(outer,inner);holder.appendChild(flip);wrap.appendChild(holder);document.body.appendChild(wrap);
    // El movimiento del lomo no arrastra sus minianimaciones.
    book.querySelectorAll('.fx-book-animation').forEach(el=>{el.style.animationPlayState='paused'});
    return {wrap,holder,flip,book,inner};
  }


  /* La navegación pertenece a la página, no al libro que gira.
     Un duplicado *temporal* del encabezado real queda delante de la pieza 3D
     hasta que la página de destino toma su lugar. No hay assets sustituidos. */
  function bridgeHeader(nextTitle,duration){
    const original=document.querySelector('.app-shell > .fx-site-header');
    if(!original||reduced)return null;
    const b=original.getBoundingClientRect();
    if(b.width<1||b.height<1)return null;
    const bridge=original.cloneNode(true);
    bridge.classList.add('fx-museum-header-bridge');
    bridge.setAttribute('aria-hidden','true');
    // Never duplicate focusable controls or active navigation in the overlay.
    bridge.querySelectorAll('a,button,[tabindex]').forEach(el=>{
      el.removeAttribute('href');el.removeAttribute('tabindex');
      if(el.hasAttribute('aria-current'))el.removeAttribute('aria-current');
    });
    // Restoring active visuals is CSS-only; leave the Museo highlight intact.
    Object.assign(bridge.style,{
      left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px',
      '--fx-bridge-time':duration+'ms'
    });
    const oldTitle=bridge.querySelector('.fx-top-room-title');
    // En la entrada solo se desvanece el título. En la salida sí se
    // intercambian el título de la sala y «Museo», como en la v4.10.
    if(!nextTitle)bridge.classList.add('fx-museum-header-entry');
    if(oldTitle && nextTitle && oldTitle.textContent.trim()!==nextTitle){
      const newTitle=oldTitle.cloneNode(false);
      newTitle.textContent=nextTitle;
      newTitle.classList.add('fx-museum-title-next');
      oldTitle.classList.add('fx-museum-title-old');
      oldTitle.after(newTitle);
    }
    document.body.appendChild(bridge);
    return bridge;
  }

  /* Una sola curva controla traslación, cambio de escala Y giro verdadero (180°).
     En el punto medio se ve el canto; después se revela la página interior. */
  function animateTransition(transition,from,to,{opening,duration}){
    const {holder,flip,book}=transition;
    const dx=to.left-from.left,dy=to.top-from.top;
    const sx=to.width/from.width,sy=to.height/from.height;
    const details=[...book.querySelectorAll('.fx-book-title,.fx-book-animation')];
    let lastP=opening?0:1;
    const setFrame=p=>{
      // Cambiar la altura alrededor del perfil (90°) evita estirar la portada
      // y hace que el interior ya tenga proporciones naturales al mostrarse.
      const unfold=smooth(clamp((p-.31)/.38));
      holder.style.transform=`translate3d(${(dx*p).toFixed(3)}px,${(dy*p).toFixed(3)}px,0) scale3d(${(1+(sx-1)*p).toFixed(5)},${(1+(sy-1)*unfold).toFixed(5)},1)`;
      const angle=-180*p;
      // La inclinación disminuye de manera natural al terminar el movimiento.
      const tilt=5*Math.sin(Math.PI*p);
      flip.style.transform=`rotateY(${angle.toFixed(4)}deg) rotateX(${tilt.toFixed(4)}deg)`;
      const opacity=1-clamp(p/.28);
      details.forEach(el=>el.style.opacity=String(opacity));
      lastP=p;
    };
    setFrame(opening?0:1);
    const start=performance.now();
    return new Promise(resolve=>{
      const frame=now=>{
        const t=clamp((now-start)/duration),progress=smooth(t);
        const p=opening?progress:1-progress;
        setFrame(p);
        if(t<1)requestAnimationFrame(frame);else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  function openBook(bookLink){
    if(busy)return;busy=true;
    const id=bookLink.dataset.book;
    const start=rect(bookLink);
    put(LAST,{id,scrollY:scrollY,rects:layoutSnapshot(),viewport:{width:innerWidth,height:innerHeight}});
    const url=new URL(bookLink.href);
    if(id!=='cobblemon')url.searchParams.set('fx_book_origin',encodeBookOrigin(start,scrollY));
    put(ENTRY,{id,path:url.pathname});
    if(id==='cobblemon')put(COB_RETURN,{id,scrollY});else del(COB_RETURN);
    if(reduced){location.assign(url.href);return}
    const end=viewport();
    const transition=createTransition(id,start,{source:bookLink,destinationURL:url.href});
    if(id!=='cobblemon'){
      bridgeHeader(null,1120);
      // La cabecera original queda debajo de la copia transitoria. Ocultar
      // solo su título evita que se vea a través del desvanecimiento.
      document.body.classList.add('fx-museum-opening');
    }
    bookLink.classList.add('fx-book-is-restacking');
    animateTransition(transition,start,end,{opening:true,duration:1120})
      .then(()=>location.assign(url.href),()=>location.assign(url.href));
  }
  function closeRoom(){
    if(busy)return;busy=true;
    const id=roomId(),last=get(LAST),origin=decodeBookOrigin();
    const target=scaledRect(last?.rects?.[id],last)||scaledRect(origin?.rect,origin);
    const savedScroll=Number.isFinite(last?.scrollY)?last.scrollY:(origin?.scrollY||0);
    const url=new URL(libraryUrl.href);
    url.searchParams.set('fx_return',id);url.searchParams.set('fx_scroll',String(savedScroll));
    // Mark this as a completed close, never a return animation awaiting replay.
    put(RETURN,{id,scrollY:savedScroll,direct:!!target,completed:true});
    if(reduced){location.assign(url.href);return}
    // animateTransition() is defined in BOOK -> VIEWPORT coordinates.
    // When closing it runs its progress backwards (p: 1 -> 0).
    // It MUST therefore receive bookRect as `from` and viewport as `to`,
    // exactly as the opening does. Passing viewport -> bookRect inverted the
    // geometry: the closing finished as a giant cover then the library snapped
    // to a small book, giving the impression of a second animation.
    const bookRect=target||fallbackRect(),expanded=viewport();
    if(target)returnBackdrop(last?.rects?.[id]?last:approximateSnapshot(origin,id),id);
    const transition=createTransition(id,bookRect,{roomContent:true});
    // Keep the nav in place; only the room body belongs to the rotating face.
    const previewHeader=transition.inner.querySelector('.fx47-room-clone .fx-site-header');
    if(previewHeader)previewHeader.style.setProperty('visibility','hidden','important');
    bridgeHeader('Museo',1020);
    document.body.classList.add('fx-room-departing');
    animateTransition(transition,bookRect,expanded,{opening:false,duration:1020})
      .then(()=>location.assign(url.href),()=>location.assign(url.href));
  }
  /* Entrada directa a una sala sin haber elegido primero un libro: fallback. */
  function fallbackReturn(id,scroll){
    const book=document.querySelector(`.fx-museum-book[data-book="${id}"]`);if(!book)return;
    if(Number.isFinite(scroll))window.scrollTo(0,Math.max(0,scroll));
    if(reduced)return;
    const to=rect(book),from=fallbackRect();
    book.classList.add('fx-book-is-restacking');
    const transition=createTransition(id,from,{source:book});
    animateTransition(transition,from,to,{opening:false,duration:700}).finally(()=>{
      book.classList.remove('fx-book-is-restacking');transition.wrap.remove();
    });
  }
  // v4.12: previews are activated by entering a book, never by a timer
  // running on the idle page. A card belt is merely paused/resumed by CSS.
  // For Champions and the Club Tree, one interaction produces one complete
  // cycle; removing the pointer mid-cycle never cuts it short.
  function setupBookPreview(book){
    const id=book.dataset.book;
    if(reduced||id==='cobblemon')return;
    if(id==='leyendas')return; // CSS :hover/:focus-visible pauses in place.
    const animationName=id==='campeones'?'fx412-medal-turn':'fx412-tree-glow';
    const expectedSelector=id==='campeones'?'.fx-book-medal-rotor':'.fx-book-tree';
    let armed=true;
    let finishedSides=0;
    const start=()=>{
      if(!armed||busy)return;
      armed=false;
      if(book.classList.contains('fx-preview-active'))return;
      finishedSides=0;
      book.classList.add('fx-preview-active');
    };
    const rearm=()=>{armed=true};
    book.addEventListener('pointerenter',start);
    book.addEventListener('pointerleave',rearm);
    book.addEventListener('focusin',start);
    book.addEventListener('focusout',e=>{if(!book.contains(e.relatedTarget))rearm()});
    book.addEventListener('animationend',e=>{
      if(e.animationName!==animationName||!e.target.matches(expectedSelector))return;
      finishedSides++;
      if(finishedSides>=book.querySelectorAll(expectedSelector).length){
        book.classList.remove('fx-preview-active');
        finishedSides=0;
      }
    });
  }
  if(onLibrary){
    completeMedals(document);
    document.querySelectorAll('.fx-museum-book[data-book]').forEach(setupBookPreview);
    const query=new URLSearchParams(location.search);
    let incoming=get(RETURN);
    const cobblemonReturn=get(COB_RETURN);
    if(!incoming&&cobblemonReturn&&/\/cobblemon\/(?:index\.html)?/.test(document.referrer||''))incoming=cobblemonReturn;
    const requested=query.get('fx_return');
    if(requested&&Object.hasOwn(books,requested))incoming={...incoming,id:requested,scrollY:Number(query.get('fx_scroll')||0)};
    del(RETURN);
    if(incoming?.id==='cobblemon')del(COB_RETURN);
    if(requested){
      query.delete('fx_return');query.delete('fx_scroll');
      try{history.replaceState(history.state,'',location.pathname+(query.toString()?'?'+query:'')+location.hash)}catch{}
    }
    if(incoming&&Object.hasOwn(books,incoming.id)){
      if(requested||incoming.completed){
        // closeRoom() already animated the entire inverse journey on the room
        // page. The library is only the final static frame of that SAME motion.
        // In particular file:// must not start fallbackReturn() a second time.
        requestAnimationFrame(()=>scrollTo(0,Math.max(0,Number(incoming.scrollY)||0)));
      }else if(incoming.direct){
        requestAnimationFrame(()=>scrollTo(0,Math.max(0,Number(incoming.scrollY)||0)));
      }else{
        // Kept only for a genuinely external return (e.g. old tracker link).
        requestAnimationFrame(()=>requestAnimationFrame(()=>fallbackReturn(incoming.id,Number(incoming.scrollY||0))));
      }
    }
    window.addEventListener('pageshow',event=>{
      if(!event.persisted)return;
      document.querySelectorAll('.fx-museum-transition,.fx-museum-return-backdrop,.fx-museum-header-bridge').forEach(el=>el.remove());
      document.querySelectorAll('.fx-museum-book').forEach(el=>el.classList.remove('fx-book-is-restacking','fx-preview-active'));
      document.body.classList.remove('fx-museum-opening');
      busy=false;
    });
    document.querySelectorAll('.fx-museum-book').forEach(book=>book.addEventListener('click',event=>{
      if(!clickOK(event))return;event.preventDefault();openBook(book);
    }));
  }else{
    // A browser back/forward cache restoration must not keep a frozen header.
    window.addEventListener('pageshow',event=>{
      if(!event.persisted)return;
      document.querySelectorAll('.fx-museum-transition,.fx-museum-return-backdrop,.fx-museum-header-bridge').forEach(el=>el.remove());
      document.body.classList.remove('fx-room-departing');
      busy=false;
    });
    const entry=get(ENTRY);
    // La URL lleva el origen del libro incluso cuando file:// no comparte
    // sessionStorage entre los HTML. Solo entonces aparece el título nuevo.
    const arrivedByBook=entry?.path===location.pathname ||
      new URLSearchParams(location.search).has('fx_book_origin');
    if(arrivedByBook){
      del(ENTRY);
      if(!reduced){
        document.body.classList.add('fx-room-arriving','fx-museum-room-title-arriving');
        document.documentElement.classList.remove('fx-museum-title-pending');
        setTimeout(()=>document.body.classList.remove('fx-room-arriving'),220);
        setTimeout(()=>document.body.classList.remove('fx-museum-room-title-arriving'),420);
      }
    }
    document.querySelectorAll('[data-museum-return]').forEach(a=>a.addEventListener('click',event=>{
      if(!clickOK(event))return;event.preventDefault();closeRoom();
    }));
  }
})();
