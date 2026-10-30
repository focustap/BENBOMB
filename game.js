'use strict';

// BENBOMB: independent static game. Realtime rooms require config.js.
const $ = (id) => document.getElementById(id);
const VIEWS = ['menu', 'lobby', 'game', 'results'];
const SETTINGS = Object.freeze({
  easy: {min: 10500, max: 15500},
  classic: {min: 8000, max: 13500},
  spicy: {min: 6000, max: 10500}
});
const PROMPTS = {
  one: ['e','y','a','o','i','r','s','t','n','l','u','d','p','m','c'],
  two: ['zz','fr','th','er','in','re','an','on','ed','ar','en','al','st','or','la','bo','ch','pl','de','ba','sh','tr','br','co','ri','ki','li','po','mo','qu','ce','ve','ea','ee','oo','sp','tt','ly','te','ss','ou','ig','bl','fl','pr','wr','dr','sc','ck'],
  long: ['sec','ing','est','ant','end','pre','ful','out','ice','app','and','ess','tion','air','art','one','ous','ear','ter','str','ple','ake','con','ent','que','tch','ght','all','ever','ring','ound','able','ment','inter','ight']
};
const PROMPT_WEIGHTS = {
  easy: ['one','one','two','two','two','long'],
  classic: ['one','two','two','two','long','long'],
  spicy: ['two','two','long','long','long']
};
let wordSet = new Set(), words = [], promptMatches = new Map();
let session = null, game = null, client = null, view = 'menu';
let raf = null, exploding = false, soundOn = true, audioCtx = null, toastTimer = null;
let usedPromptHistory = [];
let onlineConnected = false;

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function randomId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
}
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  if (crypto && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    for (const b of bytes) result += chars[b % chars.length];
  } else {
    for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
function choose(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function display(viewName) {
  const changed = view !== viewName;
  view = viewName;
  VIEWS.forEach(v => $(v + 'View').hidden = v !== viewName);
  if (changed) window.scrollTo(0, 0);
}
function notify(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}
function feedback(message, type = '') {
  $('feedback').textContent = message;
  $('feedback').className = 'feedback ' + type;
}
function playSound(kind) {
  if (!soundOn) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const n = kind === 'success' ? [[600,0,.09],[850,.09,.12]]
      : kind === 'boom' ? [[110,.0,.25],[65,.12,.32]]
      : [[260,0,.12]];
    n.forEach(([frequency,delay,duration]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = kind === 'boom' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(frequency,now+delay);
      if (kind === 'boom') osc.frequency.exponentialRampToValueAtTime(42,now+delay+duration);
      gain.gain.setValueAtTime(.0001,now+delay);
      gain.gain.exponentialRampToValueAtTime(.09,now+delay+.015);
      gain.gain.exponentialRampToValueAtTime(.0001,now+delay+duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now+delay);osc.stop(now+delay+duration+.01);
    });
  } catch (_) {}
}
function saveName(name) {
  try {localStorage.setItem('benbombName', name);} catch (_) {}
}
function configureButtons() {
  const ready = wordSet.size > 0;
  const cfg = window.BENBOMB_CONFIG || {};
  const onlineReady = ready && !!(cfg.url && cfg.publishableKey);
  $('soloButton').disabled = !ready;
  $('localButton').disabled = !ready;
  $('hostButton').disabled = !onlineReady;
  $('joinButton').disabled = !onlineReady;
}
async function loadDictionary() {
  try {
    // Revalidate on each visit: GitHub Pages can otherwise keep the old tiny wordlist in cache.
    const response = await fetch('./words.txt?v=moby-20261030', {cache:'no-cache'});
    if (!response.ok) throw new Error('HTTP '+response.status);
    // The dictionary includes capitalized entries (e.g. Itch/Poop), so normalize case.
    words = Array.from(new Set((await response.text()).toLowerCase().split(/\s+/).filter(w => /^[a-z]{3,20}$/.test(w))));
    wordSet = new Set(words);
    if (wordSet.size < 500) throw new Error('Dictionary is too short');

    // Store counts, not huge matching-word arrays: the new dictionary has 400k+ entries.
    // Index in batches so the page stays responsive while loading.
    promptMatches.clear();
    const allPatterns = [...new Set(Object.values(PROMPTS).flat())];
    for (let i = 0; i < allPatterns.length; i++) {
      const pattern = allPatterns[i];
      let count = 0;
      for (const word of words) if (word.includes(pattern)) count++;
      promptMatches.set(pattern,count);
      if (i % 4 === 3) {
        $('dictionaryBadge').textContent = 'INDEXING ' + Math.round((i+1) / allPatterns.length * 100) + '%';
        await new Promise(resolve => setTimeout(resolve,0));
      }
    }
    $('dictionaryBadge').textContent = wordSet.size.toLocaleString('en-US') + ' WORDS READY';
    configureButtons();
  } catch (error) {
    $('dictionaryBadge').textContent = 'WORDS OFFLINE';
    notify('Could not load the dictionary. Use GitHub Pages or a local web server.');
    console.error('Dictionary load failed', error);
  }
}
function promptCandidates(key) {
  return PROMPTS[key].filter(pattern => {
    const total = promptMatches.get(pattern) || 0;
    const required = pattern === 'zz' ? 5 : pattern.length === 1 ? 50 : pattern.length === 2 ? 14 : 9;
    const alreadyPlayed = game.used.reduce((sum,word) => sum + (word.includes(pattern) ? 1 : 0),0);
    return total - alreadyPlayed >= required;
  });
}
function nextPrompt() {
  const difficulty = session && session.difficulty || 'classic';
  let key = choose(PROMPT_WEIGHTS[difficulty] || PROMPT_WEIGHTS.classic);
  let choices = promptCandidates(key).filter(s => !usedPromptHistory.slice(-6).includes(s));
  if (!choices.length) choices = promptCandidates(key);
  if (!choices.length) choices = ['one','two','long'].flatMap(promptCandidates);
  const selected = choose(choices.length ? choices : ['e']);
  usedPromptHistory.push(selected);
  if (usedPromptHistory.length > 12) usedPromptHistory.shift();
  return selected;
}
function fuseDuration() {
  const preset = SETTINGS[session && session.difficulty || 'classic'];
  return Math.round(preset.min + Math.random() * (preset.max - preset.min));
}
function newFuse() {
  game.prompt = nextPrompt();
  game.duration = fuseDuration();
  game.deadline = Date.now() + game.duration;
  game.round += 1;
}
function living() {return game.players.filter(p => p.lives > 0);}
function nextLivingIndex(current) {
  for (let i = 1; i <= game.players.length; i++) {
    const index = (current+i) % game.players.length;
    if (game.players[index].lives > 0) return index;
  }
  return current;
}
function makePlayer(name) {return {id:randomId(),name:name.slice(0,18),lives:3,score:0};}
function beginMatch() {
  if (!session || !session.host || !game || game.players.length === 0) return;
  if (session.kind !== 'solo' && game.players.length < 2) {notify('You need at least two players.');return;}
  usedPromptHistory = [];
  game.players.forEach(p => {p.lives = 3; p.score = 0;});
  game.phase = 'playing';
  game.used = [];
  game.recent = [];
  game.turn = 0;
  game.round = 0;
  game.winner = null;
  newFuse();
  broadcastState();
  render();
  playSound('success');
}
function makeGame(mode,players) {
  return {phase: mode === 'online' ? 'lobby' : 'playing',players,turn:0,prompt:'',used:[],recent:[],round:0,duration:0,deadline:0,winner:null};
}
function beginOffline(kind) {
  if (!wordSet.size) {notify('The dictionary has not finished loading.');return;}
  const n = ($('soloName').value || 'Player').trim().slice(0,18);
  if (kind === 'solo') {
    session = {kind,host:true,id:randomId(),difficulty:'classic'};
    game = makeGame(kind,[makePlayer(n)]);
    saveName(n);
  } else {
    const names = $('localNames').value.split(',').map(x=>x.trim()).filter(Boolean);
    if (names.length < 2 || names.length > 8) {notify('Enter 2–8 names separated by commas.');return;}
    if (new Set(names.map(x=>x.toLowerCase())).size !== names.length) {notify('Use a different name for each player.');return;}
    session = {kind,host:true,id:randomId(),difficulty:'classic'};
    game = makeGame(kind,names.map(makePlayer));
  }
  beginMatch();
}
function getTurnPlayer() {return game && game.players[game.turn];}
function canType() {
  if (!session || !game || game.phase !== 'playing' || exploding) return false;
  if (session.kind !== 'online') return true;
  return !!(getTurnPlayer() && getTurnPlayer().id === session.id);
}
function submitWord(playerId,rawWord) {
  if (!session || !session.host || !game || game.phase !== 'playing' || exploding) return;
  const player = getTurnPlayer();
  if (!player || player.id !== playerId) return;
  if (Date.now() >= game.deadline) {explode(); return;}
  const word = String(rawWord||'').trim().toLowerCase();
  let reason = '';
  if (!/^[a-z]{3,20}$/.test(word)) reason = 'Use an English word with at least 3 letters.';
  else if (!word.includes(game.prompt)) reason = 'That word does not contain "' + game.prompt.toUpperCase() + '" in order.';
  else if (!wordSet.has(word)) reason = 'Not in this dictionary. Try another word!';
  else if (game.used.includes(word)) reason = 'Already used! Find a different word.';
  if (reason) {
    if (session.kind === 'online' && playerId !== session.id) {
      broadcast('notice',{id:playerId,message:reason});
    } else feedback(reason,'bad');
    playSound('bad');
    return;
  }
  game.used.push(word);
  game.recent.unshift({name:player.name,word});
  if (game.recent.length > 6) game.recent.pop();
  player.score++;
  game.turn = nextLivingIndex(game.turn);
  newFuse();
  broadcastState();
  render();
  feedback('Great! ' + word.toUpperCase() + ' accepted. The fuse has reset.','ok');
  playSound('success');
  if (session.kind !== 'online' || getTurnPlayer().id === session.id) $('wordInput').focus();
}
function explode() {
  if (!session || !session.host || !game || game.phase !== 'playing' || exploding) return;
  exploding = true;
  $('bomb').classList.add('exploding');
  playSound('boom');
  const doomedIndex = game.turn;
  const doomedName = getTurnPlayer().name;
  setTimeout(() => {
    if (!game || game.phase !== 'playing') {exploding = false;return;}
    $('bomb').classList.remove('exploding');
    const player = game.players[doomedIndex];
    player.lives = Math.max(0,player.lives-1);
    const survivors = living();
    if ((session.kind === 'solo' && player.lives === 0) || (session.kind !== 'solo' && survivors.length <= 1)) {
      game.phase = 'ended';
      game.winner = survivors.length === 1 && session.kind !== 'solo' ? survivors[0].id : null;
    } else {
      game.turn = nextLivingIndex(doomedIndex);
      newFuse();
    }
    exploding = false;
    broadcastState();
    render();
    if (game.phase === 'playing') feedback(doomedName + ' lost a life! New bomb, new chance.','bad');
  },420);
}
function renderLobby() {
  if (!game) return;
  $('lobbyCode').textContent = session.code;
  $('lobbyCount').textContent = game.players.length + '/8';
  $('lobbyRole').textContent = session.host ? 'HOST' : 'GUEST';
  $('lobbyPlayers').innerHTML = game.players.map((p,i) =>
    '<div class="lobby-player"><div class="player-avatar">'+escapeHTML(p.name[0].toUpperCase())+'</div><span>'+escapeHTML(p.name)+'</span><small>'+ (i===0?'HOST':'READY') +'</small></div>').join('');
  $('beginButton').hidden = !session.host;
  $('beginButton').disabled = game.players.length < 2;
  $('lobbyHint').textContent = session.host ? 'Invite someone with the room code. Host starts when everyone is ready.' : 'Waiting for the host to start the match.';
}
function renderGame() {
  const current = getTurnPlayer();
  if (!current) return;
  $('roundNumber').textContent = String(game.round).padStart(2,'0');
  $('wordCount').textContent = String(game.used.length).padStart(2,'0');
  $('prompt').textContent = game.prompt.toUpperCase();
  $('bomb').setAttribute('aria-label','Bomb requiring the letters ' + game.prompt.toUpperCase());
  $('gameStatus').textContent = session.kind === 'solo' ? 'SOLO SURVIVAL' : session.kind === 'online' ? ('ROOM '+session.code) : 'PASS THE KEYBOARD';
  $('playerStrip').innerHTML = game.players.map((p,i) => '<div class="player-card '+ (i===game.turn?'active ':'')+(p.lives<=0?'eliminated':'')+'"><div class="player-card-name">'+escapeHTML(p.name)+'</div><div class="player-card-hearts">'+('♥ '.repeat(p.lives)) + ('♡ '.repeat(3-p.lives))+'</div><div class="player-card-score">'+p.score+' WORD'+(p.score===1?'':'S')+'</div></div>').join('');
  $('turnLabel').textContent = session.kind === 'solo' ? 'YOUR TURN — KEEP GOING' : (session.kind === 'online' && current.id !== session.id ? 'WAIT FOR ' : 'NOW PLAYING — ') + current.name.toUpperCase();
  $('turnHearts').textContent = '♥ '.repeat(current.lives) + '♡ '.repeat(3-current.lives);
  $('wordInput').disabled = !canType();
  $('sendWordButton').disabled = !canType();
  $('wordInput').placeholder = canType() ? 'TYPE A WORD…' : 'WAITING FOR YOUR TURN…';
  $('lastWords').innerHTML = game.recent.map(({name,word}) => '<span class="last-word">'+escapeHTML(name)+': '+escapeHTML(word)+'</span>').join('');
  if (canType()) $('wordInput').focus({preventScroll:true});
}
function renderResults() {
  let title,subtitle;
  if (session.kind === 'solo') {
    title = 'FUSE EXPIRED.';
    subtitle = 'You survived ' + game.used.length + ' successful word' + (game.used.length===1?'':'s') + '. Want another run?';
  } else {
    const champion = game.players.find(p => p.id === game.winner);
    title = champion ? champion.name.toUpperCase() + ' WINS!' : 'GAME OVER.';
    subtitle = 'The last player standing takes the crown.';
  }
  $('resultsHeading').textContent = title;
  $('resultsSubtitle').textContent = subtitle;
  const ranked = [...game.players].sort((a,b) => b.lives-a.lives || b.score-a.score);
  $('resultsPlayers').innerHTML = ranked.map((p,i)=>'<div class="result-row"><div class="result-rank">#'+(i+1)+'</div><div class="result-name">'+escapeHTML(p.name)+'</div><div class="result-score"><strong>'+p.score+'</strong>WORDS</div></div>').join('');
  $('rematchButton').hidden = session.kind === 'online' && !session.host;
}
function render() {
  if (!game || !session) return;
  if (game.phase === 'lobby') {display('lobby');renderLobby();}
  else if (game.phase === 'playing') {display('game');renderGame();}
  else if (game.phase === 'ended') {display('results');renderResults();}
}
function tick() {
  raf = requestAnimationFrame(tick);
  if (!game || game.phase !== 'playing' || view !== 'game') return;
  const remaining = Math.max(0, game.deadline - Date.now());
  const percent = Math.max(0,Math.min(100,remaining / (game.duration||1)*100));
  $('timerFill').style.width = percent + '%';
  $('timerLabel').textContent = (remaining/1000).toFixed(1)+'s';
  $('bomb').classList.toggle('danger',remaining<2600 && !exploding);
  $('timerLabel').classList.toggle('danger',remaining<2600);
  if (remaining===0 && session.host) explode();
}
function broadcast(event,payload) {
  if (!session || !session.channel || !onlineConnected) return;
  session.channel.send({type:'broadcast',event,payload}).catch(err=>console.warn('Realtime broadcast failed',err));
}
function broadcastState() {
  if (session && session.kind === 'online' && session.host && game) {
    broadcast('sync',{hostId:session.id,game});
  }
}
function currentName() {
  const name = ($('onlineName').value || '').trim().slice(0,18);
  if (!name) {notify('Enter a nickname first.');return null;}
  saveName(name);
  return name;
}
async function getClient() {
  if (client) return client;
  const config = window.BENBOMB_CONFIG || {};
  if (!config.url || !config.publishableKey) {
    throw new Error('Online multiplayer needs a Supabase URL and publishable key in config.js.');
  }
  const module = await import('https://esm.sh/@supabase/supabase-js@2.75.0');
  client = module.createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
  return client;
}
async function connectRoom(role,code,nickname) {
  try {
    const sb = await getClient();
    const id = randomId();
    session = {kind:'online',host:role==='host',id,code,difficulty:'classic',channel:null};
    game = role === 'host' ? makeGame('online',[{id,name:nickname,lives:3,score:0}]) : null;
    const channel = sb.channel('benbomb:'+code, {config:{broadcast:{self:false,ack:true}}});
    session.channel = channel;
    onlineConnected = false;
    channel
      .on('broadcast',{event:'join'},({payload}) => {
        if (!session || !session.host || session.code!==code || !game || game.phase!=='lobby') return;
        if (!payload || typeof payload.name!=='string' || !/^[a-zA-Z0-9 -]{1,18}$/.test(payload.name)) return;
        const exists = game.players.find(p=>p.id===payload.id);
        if (!exists && game.players.length < 8 && !game.players.some(p=>p.name.toLowerCase()===payload.name.toLowerCase())) {
          game.players.push({id:payload.id,name:payload.name,lives:3,score:0});
        }
        broadcastState();
        render();
      })
      .on('broadcast',{event:'sync'},({payload}) => {
        if (!session || session.host || session.code!==code || !payload || !payload.game) return;
        const g = payload.game;
        if (!['lobby','playing','ended'].includes(g.phase) || !Array.isArray(g.players)) return;
        if (!g.players.some(p=>p.id===session.id)) return;
        game = g;
        render();
        if (game.phase==='playing') feedback('Find a word containing the exact letters!','');
      })
      .on('broadcast',{event:'attempt'},({payload}) => {
        if (!session || !session.host || !payload || typeof payload.word!=='string') return;
        submitWord(payload.id,payload.word);
      })
      .on('broadcast',{event:'notice'},({payload}) => {
        if (session && !session.host && payload && payload.id===session.id) feedback(payload.message,'bad');
      })
      .on('broadcast',{event:'leave'},({payload}) => {
        if (!session || !session.host || !game || !payload) return;
        if (game.phase==='lobby') {
          game.players = game.players.filter(p=>p.id!==payload.id);
          broadcastState();render();
        } else if (game.phase==='playing') {
          const p=game.players.find(p=>p.id===payload.id);
          if (p) {p.lives=0;if (living().length<=1) {game.phase='ended';game.winner=living()[0]?.id||null;}
          else if (getTurnPlayer()?.lives===0) {game.turn=nextLivingIndex(game.turn);newFuse();}
          broadcastState();render();}
        }
      })
      .on('broadcast',{event:'closed'},() => {
        if (session && !session.host && session.code===code) {leaveRoom(false);notify('The host closed this room.');}
      });
    channel.subscribe((status) => {
      if (!session || session.code !== code || session.channel !== channel) return;
      if (status === 'SUBSCRIBED') {
        onlineConnected=true;
        if (session.host) {render();notify('Room ready! Share the code with friends.');}
        else {
          broadcast('join',{id:session.id,name:nickname});
          notify('Connecting to the room…');
          setTimeout(() => {
            if (session && !session.host && session.code===code && !game) {
              notify('No host responded. Double-check the room code.');
              leaveRoom(false);
            }
          },7000);
        }
      } else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
        onlineConnected=false;
        notify('Realtime connection lost. Try again.');
      }
    });
    if (!session.host) {
      $('onlineStatus').textContent = 'Connecting…';
    }
  } catch (err) {
    notify(err.message || 'Could not connect to multiplayer.');
    console.error('BENBOMB multiplayer',err);
    leaveRoom(false);
  }
}
function leaveRoom(sendLeave=true) {
  if (session && session.kind==='online' && session.channel) {
    if (sendLeave) broadcast(session.host?'closed':'leave',{id:session.id});
    const oldChannel = session.channel;
    setTimeout(()=>{try{client.removeChannel(oldChannel);}catch(_){}},100);
  }
  session=null;game=null;exploding=false;onlineConnected=false;
  $('bomb').classList.remove('exploding','danger');
  display('menu');
}
function rematch() {
  if (!session || !game) return;
  if (session.kind==='online' && !session.host) return;
  beginMatch();
}
function handleWordSubmit(e) {
  e.preventDefault();
  if (!canType()) return;
  const word = $('wordInput').value;
  $('wordInput').value = '';
  if (session.kind === 'online' && !session.host) {
    broadcast('attempt',{id:session.id,word});
  } else {
    submitWord(getTurnPlayer().id,word);
  }
}
function setupListeners() {
  $('soloButton').addEventListener('click',()=>beginOffline('solo'));
  $('localButton').addEventListener('click',()=>beginOffline('local'));
  $('hostButton').addEventListener('click',()=>{const n=currentName();if(n)connectRoom('host',randomCode(),n);});
  $('joinButton').addEventListener('click',()=>{
    const n=currentName();if(!n)return;
    const code=$('roomCodeInput').value.trim().toUpperCase();
    if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){notify('Room code must have six letters or numbers.');return;}
    connectRoom('guest',code,n);
  });
  $('roomCodeInput').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);});
  $('beginButton').addEventListener('click',beginMatch);
  $('copyCodeButton').addEventListener('click',()=>{
    const url=location.origin+location.pathname+'?room='+session.code;
    if(navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(()=>notify('Invite link copied!')).catch(()=>notify(session.code));
    else notify('Room code: '+session.code);
  });
  $('leaveLobbyButton').addEventListener('click',()=>leaveRoom());
  $('leaveGameButton').addEventListener('click',()=>{
    if(confirm('Leave this match?')) leaveRoom();
  });
  $('wordForm').addEventListener('submit',handleWordSubmit);
  $('homeButton').addEventListener('click',()=>leaveRoom());
  $('rematchButton').addEventListener('click',rematch);
  $('soundToggle').addEventListener('click',()=>{
    soundOn=!soundOn;
    $('soundToggle').textContent=soundOn?'♫':'♪';
    $('soundToggle').setAttribute('aria-label',soundOn?'Mute sound':'Unmute sound');
    notify(soundOn?'Sound on':'Sound off');
  });
  $('backLink').addEventListener('click',event=>{
    if(session && game && game.phase==='playing' && !confirm('Leave BENBOMB and return to BenGames? Your current match will end for you.')) event.preventDefault();
    else if(session && session.kind==='online') {broadcast(session.host?'closed':'leave',{id:session.id});}
  });
  window.addEventListener('beforeunload',event=>{
    if(session && game && game.phase==='playing') {event.preventDefault();event.returnValue='';}
  });
}
function init() {
  setupListeners();
  let saved='';
  try {saved=localStorage.getItem('benbombName')||'';}catch(_){}
  if(saved){$('soloName').value=saved;$('onlineName').value=saved;}
  const params=new URLSearchParams(location.search);
  const invite=(params.get('room')||'').toUpperCase();
  if(/^[A-HJ-NP-Z2-9]{6}$/.test(invite)) $('roomCodeInput').value=invite;
  const config=window.BENBOMB_CONFIG||{};
  $('onlineStatus').textContent=config.url&&config.publishableKey ? 'Room codes work on this site. Host needs to stay online.' : 'Supabase connection needed for online rooms. Solo and local play work now.';
  display('menu');
  loadDictionary();
  raf=requestAnimationFrame(tick);
}
init();
