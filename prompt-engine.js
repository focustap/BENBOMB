'use strict';
// Generated from the full BENBOMB dictionary, not a fixed 99-prompt list.
// Familiar seeds filter out obscure patterns with no recognizable answers.
(function () {
  const seeds = `pizza puzzle jazz jazzy buzz buzzing fuzzy dizzy fizz fizzing
  friend friends friendship friendly french france frozen freeze fresh fruit
  second seconds secret secrets section sections security secretary insect
  apple apples orange banana chocolate cookies cookie candies candy cake
  sandwich sandwiches burger cheeseburger chicken potatoes tomatoes fries
  computer computers programming keyboard monitor screen screens internet
  school schools classroom classes college university student students
  teacher teachers homework books book bookcase bookstore bookshelves
  word words wording puzzle puzzles puzzling letter letters alphabet
  question questions answer answers correct incorrect wrong right
  sunflower flowers flowering sunshine sunlight sunset sunrise sunny
  summer winter spring autumn weather snowflake snowball thunder lightning
  cat cats kitten kittens dog dogs puppies puppy panda pandas zebra zebras
  animals animal wildlife elephant elephants monkey monkeys lion tigers
  horse horses penguin penguins butterfly butterflies turtle turtles
  soccer football basketball baseball volleyball tennis running jumping
  player players playing game games gaming playground competition
  magic magical wizard wizards witch witches dragon dragons fantasy
  planet planets universe galaxy galaxies space spaceship rocket rockets
  moon moons star stars starlight sky skies ocean oceans sea water waterfalls
  garden gardens gardener forest forests woods woodland mountains mountain
  river rivers beach beaches island islands fishing fisherman swimming
  family families father mother brother sister grandparents friends
  christmas halloween birthday holidays holiday celebration celebrate
  party parties music musician musical guitar piano dancing singer singing
  television movie movies cinema theater theatre camera cameras photographs
  photo photos painting painter art artist science scientific biology
  physics chemistry mathematics history geography english language languages
  breakfast lunch dinner supper noodles pasta pizza pepper peppers
  cheese cheesy cheesecloth chocolate coffee waffles pancakes syrup
  orange orangejuice strawberry strawberries blueberry blueberries
  lemonade lemon lemons watermelon pineapple pineapples peach peaches
  table tables chair chairs window windows door doors room rooms bedroom
  bathroom kitchen ceiling floor floors stairs fireplace furniture
  clothes clothing shirt shirts pants jeans jacket jackets shoes sneakers
  computer keyboard mouse printer printers cable cables network networks
  phone phones telephone telephones charging charger battery batteries
  water watery watery weather warm warmer winter cold colder freezing
  beautiful beauty amazing amazement awesome exciting excited happiness
  quick quicker quickest fast faster fastest slow slower slowly
  racing racer racecar cars truck trucks driving driver highway roads
  traveler travelers travel travelling adventure adventurous journey
  friend friendly friendship frightening scary scream screaming surprise
  watch watches watching catch catching catches match matching matches
  scratch scratching patch patches kitchen kitchens switch switching
  important importance interesting interested entertainment entertaining
  black blue yellow green purple orange pink violet indigo rainbow
  gold golden silver diamond diamonds emerald emeralds ruby rubies
  nervous anxious anxiety happy peaceful calm sleepy sleepyhead
  always already almost also again about around above across after
  before below between because without within throughout though through
  nothing everything something anything someone anybody everybody
  internet connection connecting connected disconnect reconnect
  technology engineering engineer mechanical machinery automobile
  break breaking broken breakthrough breakfast background
  question questioner questionnaire quiz quizzes testing test tests
  number numbers numbering numerical counting count counts score scores
  victory victorious winner winning lose losing loss defeated defeat
  bookish bookshelf bookmark bookshelves
  zebra zipper zippers zero zillion jazz jazzhands jacuzzi buzzwords`.toLowerCase().split(/\s+/);
  const pools = {one:[],two:[],three:[],four:[]};
  const counts = new Map();
  let ready=false;
  function substrings(word) {
    const result=new Set();
    for(let size=1;size<=4;size++){
      for(let i=0;i<=word.length-size;i++) result.add(word.slice(i,i+size));
    }
    return result;
  }
  async function build(words,onProgress=()=>{}) {
    ready=false;
    counts.clear();
    Object.keys(pools).forEach(key=>pools[key]=[]);
    const known=new Set(words);
    const anchorCounts=new Map();
    for(const word of new Set(seeds)){
      if(!known.has(word)) continue;
      for(const sub of substrings(word)) anchorCounts.set(sub,(anchorCounts.get(sub)||0)+1);
    }
    const batch=3000;
    for(let start=0;start<words.length;start+=batch){
      const end=Math.min(start+batch,words.length);
      for(let i=start;i<end;i++) {
        for(const sub of substrings(words[i])) counts.set(sub,(counts.get(sub)||0)+1);
      }
      if(start%(batch*5)===0) onProgress(Math.round(end/words.length*100));
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    for(const [sub,count] of counts) {
      const len=sub.length;
      // Make sure a fragment is broadly playable and has a recognizable example.
      const min = len===1?500 : len===2?(sub==='zz'?12:130) : len===3?55:38;
      if(count<min || (len>1 && !(anchorCounts.get(sub)>0))) continue;
      pools[len===1?'one':len===2?'two':len===3?'three':'four'].push(sub);
    }
    ready=true;
    return {count:Object.values(pools).reduce((n,p)=>n+p.length,0),byLength:Object.fromEntries(Object.entries(pools).map(([k,v])=>[k,v.length]))};
  }
  function choose(used,history,difficulty) {
    const weights={
      easy:['one','two','two','two','three','three','four'],
      classic:['one','two','two','two','three','three','three','four','four'],
      spicy:['two','three','three','four','four','four']
    };
    const keys=(weights[difficulty]||weights.classic).filter(k=>pools[k].length>0);
    if(!keys.length) return 'e';
    const key=keys[Math.floor(Math.random()*keys.length)];
    const recent=new Set(history.slice(-40));
    // Check several random options; no linear scan through all used words on every turn.
    const pool=pools[key];
    let selected=pool[Math.floor(Math.random()*pool.length)];
    for(let attempt=0;attempt<35;attempt++){
      const candidate=pool[Math.floor(Math.random()*pool.length)];
      if(recent.has(candidate)) continue;
      const consumed=used.filter(w=>w.includes(candidate)).length;
      const minRemaining=candidate.length===1?35:candidate.length===2?16:candidate.length===3?8:5;
      if((counts.get(candidate)||0)-consumed >= minRemaining) {selected=candidate;break;}
    }
    history.push(selected);
    if(history.length>75) history.shift();
    return selected;
  }
  window.BENBOMB_PROMPTS={build,choose,pools,counts,get ready(){return ready;}};
})();
