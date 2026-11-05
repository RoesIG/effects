window.FXTeams = (() => {
  function shuffle(items) {
    const a=[...items];
    for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
  function generate(players,count) {
    const shuffled=shuffle(players);
    const teams=Array.from({length:count},()=>[]);
    shuffled.forEach((p,i)=>teams[i%count].push(p));
    return teams;
  }
  function render(teams) {
    const out=document.getElementById('teams-output'); out.innerHTML='';
    teams.forEach((team,i)=>{
      const box=document.createElement('div'); box.className='team-box';
      const title=document.createElement('h4'); title.textContent=`Equipo ${i+1}`; box.appendChild(title);
      const ul=document.createElement('ul');
      team.forEach(name=>{const li=document.createElement('li');li.textContent=`• ${name}`;ul.appendChild(li);});
      box.appendChild(ul); out.appendChild(box);
    });
  }
  function init(){
    const input=document.getElementById('players-input'); if(!input)return;
    input.value=FXStorage.get('teams.players','Player1, Player2, Player3, Player4, Player5, Player6');
    let count=FXStorage.get('teams.count',2); const countEl=document.getElementById('teams-count');
    const sync=()=>{countEl.textContent=count; FXStorage.set('teams.count',count);}; sync();
    document.getElementById('teams-minus').onclick=()=>{if(count>2){count--;sync();}};
    document.getElementById('teams-plus').onclick=()=>{if(count<8){count++;sync();}};
    document.getElementById('generate-teams').onclick=()=>{
      const players=input.value.split(',').map(x=>x.trim()).filter(Boolean);
      if(players.length<2){window.FXUI.toast('Faltan nombres','Escribe al menos 2 participantes.');return;}
      FXStorage.set('teams.players',input.value); render(generate(players,count));
    };
  }
  return {init,shuffle,generate};
})();
