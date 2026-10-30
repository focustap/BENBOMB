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

  const LENGTHS=['one','two','three','four'];
  // Dictionary frequency drives difficulty, not just sequence length.
  // The stage changes only after enough accepted words on the SAME bomb.
  const STAGES=[
    {after:0, minRatio:.005, maxRatio:1, minFamiliar:3, weights:['one','two','two','three','three']},
    {after:15,minRatio:.0015,maxRatio:.05,minFamiliar:2,weights:['two','three','three','three','four']},
    {after:20,minRatio:.00035,maxRatio:.015,minFamiliar:1,weights:['two','three','three','four','four']},
    {after:25,minRatio:0,maxRatio:.004,minFamiliar:1,weights:['three','three','four','four','four']}
  ];
  const emptyPools=()=>({one:[],two:[],three:[],four:[]});
  const pools=emptyPools();
  const stagePools=STAGES.map(emptyPools);
  const counts=new Map();
  const familiarCounts=new Map();
  let ready=false;

  function substrings(word){
    const result=new Set();
    for(let size=1;size<=4;size++)
      for(let i=0;i<=word.length-size;i++) result.add(word.slice(i,i+size));
    return result;
  }
  async function build(words,onProgress=()=>{}){
    ready=false;
    counts.clear();
    familiarCounts.clear();
    for(const key of LENGTHS) pools[key]=[];
    for(const stage of stagePools) for(const key of LENGTHS) stage[key]=[];
    const known=new Set(words);
    // Known everyday words are a second gate against obscure but valid fragments.
    for(const word of new Set(seeds)){
      if(!known.has(word)) continue;
      for(const sub of substrings(word)) familiarCounts.set(sub,(familiarCounts.get(sub)||0)+1);
    }
    const batch=3000;
    for(let start=0;start<words.length;start+=batch){
      const end=Math.min(start+batch,words.length);
      for(let i=start;i<end;i++)
        for(const sub of substrings(words[i])) counts.set(sub,(counts.get(sub)||0)+1);
      if(start%(batch*5)===0) onProgress(Math.round(end/words.length*100));
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    for(const [sub,count] of counts){
      const len=sub.length, key=LENGTHS[len-1];
      // Baseline: every offered sequence must have multiple valid answers.
      const min=len===1?500:len===2?(sub==='zz'?12:130):len===3?55:38;
      const familiar=familiarCounts.get(sub)||0;
      if(count<min||(len>1&&familiar===0)) continue;
      pools[key].push(sub);
      for(let i=0;i<STAGES.length;i++){
        const stage=STAGES[i];
        if(!stage.weights.includes(key)||familiar<stage.minFamiliar) continue;
        if(count<Math.ceil(words.length*stage.minRatio)) continue;
        if(count>Math.max(1,Math.floor(words.length*stage.maxRatio))) continue;
        stagePools[i][key].push(sub);
      }
    }
    ready=true;
    return {
      count:LENGTHS.reduce((n,k)=>n+pools[k].length,0),
      byLength:Object.fromEntries(LENGTHS.map(k=>[k,pools[k].length])),
      byStage:stagePools.map(stage=>LENGTHS.reduce((n,k)=>n+stage[k].length,0))
    };
  }
  function choose(used,history,difficulty,passesThisFuse=0){
    const offset=difficulty==='easy'?-5:difficulty==='spicy'?5:0;
    const passes=Math.max(0,passesThisFuse+offset);
    let highestStage=0;
    for(let i=1;i<STAGES.length;i++) if(passes>=STAGES[i].after) highestStage=i;
    const recent=new Set(history.slice(-40));
    const alreadyUsed=Array.isArray(used)?used:[];
    const hasAnswers=(candidate)=>{
      let left=counts.get(candidate)||0;
      for(const word of alreadyUsed) if(word.includes(candidate)) left--;
      return left>=Math.max(8,Math.min(30,Math.floor((counts.get(candidate)||0)*.04)));
    };
    let selected=null;
    for(let stageIndex=highestStage;stageIndex>=0&&!selected;stageIndex--){
      const keys=STAGES[stageIndex].weights.filter(k=>stagePools[stageIndex][k].length>0);
      if(!keys.length) continue;
      for(let attempt=0;attempt<100&&!selected;attempt++){
        const key=keys[Math.floor(Math.random()*keys.length)];
        const pool=stagePools[stageIndex][key];
        const candidate=pool[Math.floor(Math.random()*pool.length)];
        if(!recent.has(candidate)&&hasAnswers(candidate)) selected=candidate;
      }
      // Guaranteed scan if random picks couldn't find a fresh solvable fragment.
      if(!selected) for(const key of new Set(keys)){
        const pool=stagePools[stageIndex][key], start=Math.floor(Math.random()*pool.length);
        for(let i=0;i<pool.length;i++){
          const candidate=pool[(start+i)%pool.length];
          if(!recent.has(candidate)&&hasAnswers(candidate)){selected=candidate;break;}
        }
        if(selected) break;
      }
    }
    // If a stage has been exhausted, fall back to a solvable earlier prompt.
    if(!selected) for(const key of LENGTHS){
      selected=pools[key].find(p=>!recent.has(p)&&hasAnswers(p));
      if(selected) break;
    }
    if(!selected) selected='e';
    history.push(selected);
    if(history.length>75) history.shift();
    return selected;
  }
  window.BENBOMB_PROMPTS={build,choose,pools,counts,get ready(){return ready;}};
})();
