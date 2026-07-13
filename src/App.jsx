import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  BookOpen,
  Languages,
  Quote,
  Mic,
  PenLine,
  Send,
  RefreshCw,
  Loader2,
  ChevronRight,
  Check,
  X,
  Users,
  Zap,
  GraduationCap,
  Home,
  Banknote,
  Briefcase,
  ClipboardList,
  Stethoscope,
  Activity,
  Landmark,
  MessagesSquare,
  Plane,
  Clock,
  AlertTriangle,
  MapPin,
  ShoppingBag,
  AlertCircle,
  MessageSquare,
  XCircle,
  CalendarClock,
  Car,
  ArrowLeft,
  PlayCircle,
  PenSquare,
  ListChecks,
  CheckCircle2,
  Scale,
  Type,
  History,
  Lightbulb,
  Headphones,
  Pause,
  Eye,
  EyeOff,
  Map as MapIcon,
  Volume2,
  MicOff,
  Layers,
  Target,
  Compass,
  FileText,
  Upload,
  ImagePlus,
} from "lucide-react";

/* ----------------------------- Claude helpers ---------------------------- */

async function askClaudeJSON(system, userText, maxTokens = 1000) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userText }],
    }),
  });
  const data = await res.json();
  const raw = (data.content || []).map((b) => b.text || "").join("\n");
  const clean = raw.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); }
  catch(e) {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    return null;
  }
}

// Same as askClaudeJSON, but can also attach one or more photos (e.g. a
// photographed worksheet) as image content blocks before the text prompt.
async function askClaudeJSONWithImages(system, userText, images) {
  const content = [];
  (images || []).forEach((img) => {
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
  });
  content.push({ type: "text", text: userText });
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content }],
    }),
  });
  const data = await res.json();
  const raw = (data.content || []).map((b) => b.text || "").join("\n");
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

async function askClaudeText(system, messages) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system,
      messages,
    }),
  });
  const data = await res.json();
  return (data.content || []).map((b) => b.text || "").join("\n").trim();
}

/* --------------------------------- Data ---------------------------------- */

const QUESTION_SETS = [
  ["What did you do this morning?", "What do you usually do on weekends?", "What is one thing you want to improve about your English?"],
  ["What did you have for breakfast today?", "What do you like to do in your free time?", "Tell me about a goal you have for this year."],
  ["How did you get here today?", "What's your favorite season, and why?", "What's something new you tried recently?"],
  ["What's the weather like where you are today?", "What do you usually do after work or school?", "Tell me about a place you'd like to visit."],
  ["What time did you wake up today?", "What's your favorite way to relax?", "What's one skill you'd like to learn?"],
  ["What did you eat for lunch today?", "Who do you usually spend weekends with?", "What's something that made you happy this week?"],
];


const ACKS = [
  "좋아요, 잘 들었어요!",
  "오, 흥미롭네요!",
  "좋습니다, 거의 다 왔어요!",
];

const ANALYSIS_SYSTEM = `You are a friendly Korean-speaking English coach analyzing a learner's spoken answers to 3 interview questions. Detect grammar mistakes, tense problems, missing be-verbs, vocabulary limitations, and unnatural sentence patterns.
Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{"weakness_summary_ko:"2-3 friendly Korean sentences summarizing the main weaknesses","corrected":[{"original":"...","corrected":"...","note_ko:"short friendly Korean note on what changed"}],"grammar_focus_ko:"one short Korean title naming ONE big-picture grammar area to focus on, like '시제: 과거 vs 현재완료'","grammar_focus_explanation_ko:"one or two simple, easy Korean sentences on why this matters, based on their actual mistakes","today_vocab":[{"word:"...","meaning_ko:"..."}],"today_phrases":[{"phrase":"...","meaning_ko:"..."}],"patterns":[{"pattern_en:"...","meaning_ko:"...","examples":[{"en:"...","ko:"..."}]}],"focus_areas":["짧은 한국어 태그 2~4개"]}
Rules: "corrected" must have exactly 3 items, pulled directly from the learner's real answers below. "today_vocab" must have exactly 4 words that would actually help the learner talk about the exact topics they just answered about (not generic words). "today_phrases" must have exactly 3 natural spoken expressions relevant to those same topics. "patterns" must have exactly 2 reusable sentence patterns that let the learner express similar ideas in different ways, each with exactly 2 short examples. Keep every Korean explanation short and warm — be concise everywhere so this generates quickly.`;

const VOCAB_SYSTEM_BASE = `You are an English vocabulary coach for a Korean adult learner. Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{"words":[{"word:"...","pos":"동사/명사/형용사/부사 등","pronunciation":"...","meaning_ko:"...","example_en:"...","example_ko:"..."}]}
Provide exactly 6 practical, everyday words that help the learner speak more richly about daily life. Keep examples short and natural, meanings in Korean.`;

const GRAMMAR_SYSTEM_BASE = `You are an English grammar coach for a Korean adult learner. Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{"points":[{"title_ko:"...","title_en:"...","explanation_ko:"one simple, friendly Korean sentence","wrong":"...","right":"..."}]}
Provide exactly 4 grammar points that are common pain points for Korean speakers learning English. Keep explanations very simple and easy.`;

const IDIOM_SYSTEM_BASE = `You are an English coach teaching natural spoken expressions to a Korean adult learner. Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{"idioms":[{"phrase":"...","meaning_ko:"...","example_en:"...","example_ko:"..."}]}
Provide exactly 4 common, everyday spoken idioms or expressions (not overly formal or rare) with natural example sentences.`;

/* ----------------------- Grammar-focused speaking course -------------------- */
/* Flow: pick a grammar point -> watch a short video lecture -> write sentences
   using it -> answer a quiz -> drill it conversationally with AI, on this one
   pattern only (not a random open chat). */


const BASIC_SPEAKING_DATA=[
{id:"daily-phrases-1",label_ko:"하루 루틴 & 집안일",level:"기초",icon_name:"MessageSquare",
vocab:[{en:"laundry",ko:"빨래"},{en:"groceries",ko:"식재료, 장볼 것들"},{en:"chores",ko:"집안일"},{en:"babysitter",ko:"아이 돌봐주는 사람"},{en:"school run",ko:"학교 등하교"},{en:"meal prep",ko:"밥 준비"},{en:"packed lunch",ko:"도시락"},{en:"overtime",ko:"야근"},{en:"day off",ko:"쉬는 날"}],
patterns:[{pattern_en:"I + V + 목적어 (일상 동작)",explain_ko:"I go grocery shopping. / I clean the house. — 주어+동사로 일상 표현"},{pattern_en:"Get + 명사 (서비스를 받다)",explain_ko:"Get a haircut. / Get my nails done. — get으로 서비스 받기"}],examples:[]},
{id:"there-is-are",label_ko:"어디에 뭐가 있어 — 있다/없다 말하기",level:"기초",icon_name:"MapPin",
vocab:[{en:"parking",ko:"주차 공간"},{en:"traffic",ko:"교통체증"},{en:"a spot",ko:"자리 하나"},{en:"plenty of room",ko:"공간이 충분한"},{en:"nothing left",ko:"남은 게 없는"},{en:"a long way to go",ko:"갈 길이 먼"},{en:"a lot going on",ko:"일이 많은"}],
patterns:[{pattern_en:"There is/are + 명사 + 장소",explain_ko:"There is a café near my condo. — 존재 표현"},{pattern_en:"Is/Are there + 명사?",explain_ko:"Is there a pharmacy nearby? — 존재 질문"}],examples:[]},
{id:"can-basic",label_ko:"할 수 있어, 해도 돼? — can으로 말하기",level:"기초",icon_name:"Zap",
vocab:[{en:"afford",ko:"여유가 되다"},{en:"handle",ko:"감당하다"},{en:"make it",ko:"시간 맞추다, 해내다"},{en:"tell",ko:"알아보다, 구분하다"},{en:"help it",ko:"어쩔 수 없다"},{en:"imagine",ko:"상상하다"},{en:"believe",ko:"믿다"}],
patterns:[{pattern_en:"Can I + V?",explain_ko:"Can I sit here? — 허락 구하기"},{pattern_en:"Can you + V?",explain_ko:"Can you help me? — 부탁하기"}],examples:[]},
{id:"should-have-to-must",label_ko:"야 해, 해야만 해 — 해야 할 말 하기",level:"기초",icon_name:"Target",
vocab:[{en:"rest",ko:"쉬다"},{en:"apologize",ko:"사과하다"},{en:"be careful",ko:"조심하다"},{en:"move on",ko:"넘어가다"},{en:"let go",ko:"놔주다, 집착 버리다"},{en:"speak up",ko:"말하다, 목소리 내다"},{en:"set boundaries",ko:"선을 긋다"}],
patterns:[{pattern_en:"You should + V",explain_ko:"You should drink more water. — 조언"},{pattern_en:"S + must be + adj",explain_ko:"She must be tired. — 분명 ~일 거야"}],examples:[]},
{id:"be-verb-present",label_ko:"나는 ~이야, 걔는 ~해 — 지금 상태 말하기",level:"기초",icon_name:"BookOpen",
vocab:[{en:"exhausted",ko:"기진맥진한"},{en:"stressed out",ko:"스트레스받은"},{en:"in a good mood",ko:"기분이 좋은"},{en:"under the weather",ko:"몸이 안 좋은"},{en:"on time",ko:"시간을 맞춰서"},{en:"in charge",ko:"담당인"},{en:"worth it",ko:"그만한 가치가 있는"},{en:"my treat",ko:"내가 낼게"}],
patterns:[{pattern_en:"주어 + be동사 + 명사/형용사",explain_ko:"She is a nurse. / He is tall."},{pattern_en:"소유격 + 명사 / 소유대명사",explain_ko:"This is my bag. / This is mine."}],examples:[]},
{id:"amount-some-any",label_ko:"좀 있어, 하나도 없어 — 양을 말할 때",level:"기초",icon_name:"Layers",
vocab:[{en:"a bunch of",ko:"한 다발, 여러 개의"},{en:"a handful of",ko:"소수의, 조금의"},{en:"a bit of",ko:"약간의"},{en:"a couple of",ko:"두어 개의"},{en:"tons of",ko:"엄청 많은"},{en:"barely any",ko:"거의 없는"},{en:"way too much",ko:"너무 많은"}],
patterns:[{pattern_en:"I have some + 명사 vs I don't have any",explain_ko:"긍정문→some, 부정·의문문→any"},{pattern_en:"There is no + 명사",explain_ko:"There is no time. / No way! — no+명사"}],examples:[]},
{id:"adjectives-do-verb",label_ko:"맛있어, 비싸, 자주 가 — 묘사하고 습관 말하기",level:"기초",icon_name:"Type",
vocab:[{en:"packed",ko:"꽉 찬, 붐비는"},{en:"crowded",ko:"붐비는"},{en:"fancy",ko:"고급스러운"},{en:"overrated",ko:"과대평가된"},{en:"underrated",ko:"과소평가된"},{en:"worth trying",ko:"먹어볼 만한"},{en:"sketch",ko:"수상한"},{en:"legit",ko:"진짜인, 믿을 만한"}],
patterns:[{pattern_en:"주어 + be동사 + 형용사",explain_ko:"She is quiet. / They are friendly."},{pattern_en:"Does + she/he + 동사원형?",explain_ko:"Does she live nearby? — 3인칭 단수 질문"}],examples:[]},
{id:"adverbs-frequency-ordinals",label_ko:"항상, 가끔, 절대 — 얼마나 자주 하는지",level:"기초",icon_name:"Clock",
vocab:[{en:"all the time",ko:"항상, 맨날"},{en:"once in a while",ko:"가끔"},{en:"every now and then",ko:"이따금"},{en:"back to back",ko:"연달아"},{en:"first thing in the morning",ko:"아침 제일 먼저"},{en:"at least",ko:"적어도"},{en:"for the first time",ko:"처음으로"}],
patterns:[{pattern_en:"주어 + 빈도부사 + 일반동사",explain_ko:"I usually wake up at 7."},{pattern_en:"How often + do/does + 주어 + V?",explain_ko:"How often do you exercise?"}],examples:[]},
{id:"past-tense",label_ko:"어제 갔어, 먹었어 — 과거 말하기",level:"기초",icon_name:"History",
vocab:[{en:"ran into",ko:"우연히 만났어"},{en:"ended up",ko:"결국 ~하게 됐어"},{en:"took forever",ko:"엄청 오래 걸렸어"},{en:"fell asleep",ko:"잠들었어"},{en:"lost track of time",ko:"시간 가는 줄 몰랐어"},{en:"forgot",ko:"잊었어"},{en:"figured out",ko:"알아냈어"}],
patterns:[{pattern_en:"I + 과거동사 + (시간)",explain_ko:"I went to the market yesterday."},{pattern_en:"Did you + 동사원형?",explain_ko:"Did you eat breakfast?"}],examples:[]},
{id:"present-continuous-get",label_ko:"지금 하는 중이야 — 진행 말하기",level:"기초",icon_name:"PlayCircle",
vocab:[{en:"getting worse",ko:"나빠지고 있어"},{en:"getting better",ko:"나아지고 있어"},{en:"getting crowded",ko:"붐비고 있어"},{en:"getting late",ko:"늦어지고 있어"},{en:"falling apart",ko:"무너지고 있어"},{en:"coming along",ko:"잘 되어가고 있어"},{en:"heading out",ko:"나가는 중이야"}],
patterns:[{pattern_en:"I am + V-ing",explain_ko:"I am eating. / I am studying."},{pattern_en:"What are you doing?",explain_ko:"뭐 하는 중이야? — 가장 많이 쓰는 패턴"}],examples:[]},
{id:"passive-advanced",label_ko:"당했어, 됐어 — 내가 한 게 아닐 때",level:"고급",icon_name:"Scale",
vocab:[{en:"get hired",ko:"채용되다"},{en:"get fired",ko:"해고되다"},{en:"get caught",ko:"잡히다, 걸리다"},{en:"get hurt",ko:"다치다"},{en:"get cheated on",ko:"바람 맞다"},{en:"get rejected",ko:"거절당하다"},{en:"get promoted",ko:"승진하다"}],
patterns:[{pattern_en:"조동사 + be + p.p.",explain_ko:"The meeting should be cancelled."},{pattern_en:"I want + 목적어 + to be + p.p.",explain_ko:"I want the dishes to be washed."}],examples:[]},
{id:"when-time-clauses",label_ko:"~할 때, ~하는 동안 — 시간 연결해서 말하기",level:"중급",icon_name:"Clock",
vocab:[{en:"all of a sudden",ko:"갑자기"},{en:"out of nowhere",ko:"뜬금없이"},{en:"right away",ko:"바로"},{en:"sooner or later",ko:"조만간"},{en:"from now on",ko:"이제부터"},{en:"by then",ko:"그때쯤이면"},{en:"at the last minute",ko:"마지막 순간에"}],
patterns:[{pattern_en:"As soon as + S + V, S + V",explain_ko:"As soon as I arrive, I'll call you."},{pattern_en:"By the time + 과거, + 과거완료",explain_ko:"By the time he arrived, we had eaten."}],examples:[]},
{id:"say-tell-speak-talk",label_ko:"말했어, 얘기했어 — 말하다 표현 구분",level:"중급",icon_name:"MessageSquare",
vocab:[{en:"bring up",ko:"꺼내다, 언급하다"},{en:"gossip",ko:"험담하다, 가십"},{en:"spill the beans",ko:"비밀을 누설하다"},{en:"word for word",ko:"그대로"},{en:"off the record",ko:"비공식적으로"},{en:"talk behind one's back",ko:"뒤에서 험담하다"},{en:"keep it to yourself",ko:"혼자만 알고 있어"}],
patterns:[{pattern_en:"주어 + told + 사람 + that + S + V",explain_ko:"She told me that she would be late."},{pattern_en:"talk to 사람 + about 주제",explain_ko:"I talked to her about the plan."}],examples:[]},
{id:"get-take-phrasal",label_ko:"get, take — 원어민이 제일 많이 쓰는 동사",level:"고급",icon_name:"Zap",
vocab:[{en:"get away",ko:"도망치다, 떠나다"},{en:"get back to",ko:"다시 연락하다"},{en:"get rid of",ko:"없애다"},{en:"take it easy",ko:"쉬엄쉬엄 해"},{en:"take turns",ko:"번갈아가며 하다"},{en:"take a toll",ko:"타격을 주다"},{en:"take for granted",ko:"당연하게 여기다"}],
patterns:[{pattern_en:"Get + adjective (상태 변화)",explain_ko:"I got tired. / It got dark."},{pattern_en:"It takes + 시간 + to + V",explain_ko:"It takes 30 minutes to get to school."}],examples:[]},
{id:"expressions-advanced",label_ko:"어쩔 수 없어, 그때 그때 달라 — 고급 표현",level:"고급",icon_name:"Sparkles",
vocab:[{en:"that said",ko:"그렇긴 해도"},{en:"at the end of the day",ko:"결국"},{en:"to be honest",ko:"솔직히"},{en:"if anything",ko:"오히려"},{en:"more often than not",ko:"대체로"},{en:"needless to say",ko:"말할 것도 없이"},{en:"out of the blue",ko:"뜬금없이"},{en:"once in a blue moon",ko:"아주 드물게"}],
patterns:[{pattern_en:"It depends on + 명사/whether",explain_ko:"It depends on the weather. / whether she comes."},{pattern_en:"S + can't help + V-ing",explain_ko:"I can't help feeling nervous. — 어쩔 수 없다"}],examples:[]},
{id:"priority-choices",label_ko:"내 1순위는 이거고, 2순위는 이거야 — 우선순위 말하기",level:"중급",icon_name:"Star",
vocab:[
  {en:"top priority",ko:"최우선 순위"},
  {en:"second priority",ko:"두 번째 우선순위"},
  {en:"first choice",ko:"첫 번째 선택"},
  {en:"second choice",ko:"두 번째 선택"},
  {en:"option",ko:"선택지"},
  {en:"on my list",ko:"내 목록에 있는"},
  {en:"next best choice",ko:"그 다음으로 좋은 선택"},
],
patterns:[
  {pattern_en:"My top priority is ~ / My second priority is ~",explain_ko:"내 1순위는 ~이고, 2순위는 ~이야",
    examples:[
      {ko:"내 1순위는 건강이고, 2순위는 돈이야.",en:"My top priority is my health, and my second priority is money."},
      {ko:"내 1순위는 캐나다 이민이고, 2순위는 사업 시작이야.",en:"My top priority is immigrating to Canada, and my second priority is starting a business."},
      {ko:"내 1순위는 아이들 교육이고, 2순위는 집 사는 거야.",en:"My top priority is my kids education, and my second priority is buying a house."},
    ]},
  {pattern_en:"There are ~ options. My first choice is ~ and my second choice is ~",explain_ko:"선택지가 ~개 있어. 첫 번째 선택은 ~이고 두 번째는 ~이야",
    examples:[
      {ko:"선택지가 두 개 있어. 첫 번째는 집에서 일하는 거고 두 번째는 사무실로 가는 거야.",en:"There are two options. My first choice is working from home and my second choice is going to the office."},
      {ko:"선택지가 세 개 있어. 첫 번째는 버스고 두 번째는 지하철이야.",en:"There are three options. My first choice is the bus and my second choice is the subway."},
      {ko:"선택지가 몇 가지 있어. 첫 번째는 한국식이고 두 번째는 일본식이야.",en:"There are a few options. My first choice is Korean style and my second choice is Japanese style."},
    ]},
  {pattern_en:"There are ~ things on my list",explain_ko:"내 목록에 ~가지가 있어",
    examples:[
      {ko:"내 목록에 할 일이 세 가지 있어.",en:"There are three things on my list."},
      {ko:"내 목록에 가고 싶은 곳이 다섯 군데 있어.",en:"There are five places on my list."},
      {ko:"내 목록에 배우고 싶은 게 몇 가지 있어.",en:"There are a few things I want to learn on my list."},
    ]},
  {pattern_en:"My next best choice would be ~",explain_ko:"그 다음으로 좋은 선택은 ~일 거야",
    examples:[
      {ko:"그 다음으로 좋은 선택은 온라인 수업일 거야.",en:"My next best choice would be online classes."},
      {ko:"그 다음으로 좋은 선택은 대중교통일 거야.",en:"My next best choice would be public transportation."},
      {ko:"그 다음으로 좋은 선택은 프리랜서로 일하는 거야.",en:"My next best choice would be working as a freelancer."},
    ]},
],examples:[]}
,{id:"should-have-past",label_ko:"공부 열심히 할걸... — should have 후회 표현",level:"중급",icon_name:"AlertCircle",
vocab:[
  {en:"should've listened to",ko:"말을 들었어야 했다"},
  {en:"should've bought",ko:"샀어야 했다"},
  {en:"should've woken up",ko:"일어났어야 했다"},
  {en:"should've studied",ko:"공부했어야 했다"},
  {en:"should've taken",ko:"챙겼어야 했다"},
  {en:"should've saved",ko:"아꼈어야 했다"},
  {en:"should've called",ko:"전화했어야 했다"},
  {en:"shouldn't have eaten",ko:"먹지 말았어야 했다"},
  {en:"shouldn't have gone",ko:"가지 말았어야 했다"},
],
patterns:[
  {pattern_en:"주어 + should have + p.p.",explain_ko:"~했어야 했는데 — 과거에 하지 않은 것에 대한 후회",
    examples:[
      {ko:"내가 남편 말을 들었어야 했는데 그러지 않았어.",en:"I should have listened to my husband but I didn't."},
      {ko:"너 비트코인을 그때 샀어야 했는데 왜 안 샀어?",en:"You should have bought Bitcoin back then. Why didn't you?"},
      {ko:"그녀는 오늘 아침에 더 일찍 일어났어야 했는데 늦잠을 잤어.",en:"She should have woken up earlier this morning but she overslept."},
    ]},
  {pattern_en:"주어 + shouldn't have + p.p.",explain_ko:"~하지 말았어야 했는데 — 과거에 한 것에 대한 후회",
    examples:[
      {ko:"내가 어제 그렇게 매운 음식을 먹지 말았어야 했는데.",en:"I shouldn't have eaten such spicy food yesterday."},
      {ko:"너 그 사람한테 그렇게 말하지 말았어야 했어.",en:"You shouldn't have talked to him like that."},
      {ko:"우리는 애초에 태국에 가지 말았어야 했어.",en:"We shouldn't have gone to Thailand in the first place."},
    ]},
  {pattern_en:"Should + 주어 + have + p.p. ~?",explain_ko:"~했어야 했을까? — 의문문",
    examples:[
      {ko:"내가 그 목걸이를 사지 말았어야 했을까?",en:"Should I have not bought that necklace?"},
      {ko:"너가 그때 나한테 먼저 전화를 했어야 했던 거니?",en:"Should you have called me first back then?"},
      {ko:"그들이 기말고사가 끝난 후에 우리를 불렀어야 했을까?",en:"Should they have called us after the final exams?"},
    ]},
],examples:[]}
,{id:"could-have-past",label_ko:"나도 하버드 갈 수 있었는데! — could have 과거 가능성",level:"중급",icon_name:"Zap",
vocab:[
  {en:"could've won",ko:"이길 수도 있었다"},
  {en:"could've died",ko:"죽을 수도 있었다"},
  {en:"could've passed",ko:"합격할 수도 있었다"},
  {en:"could've stayed",ko:"머무를 수도 있었다"},
  {en:"could've avoided",ko:"피할 수도 있었다"},
  {en:"could've married",ko:"결혼할 수도 있었다"},
  {en:"couldn't have done",ko:"할 수 없었을 것이다"},
  {en:"couldn't have worn",ko:"입을 수 없었을 것이다"},
],
patterns:[
  {pattern_en:"주어 + could have + p.p.",explain_ko:"~할 수도 있었는데 — 과거의 가능성",
    examples:[
      {ko:"조금만 더 노력했으면 내가 시험에 합격하고 하버드도 갈 수 있었어.",en:"I could have passed the exam and gone to Harvard if I had tried a little harder."},
      {ko:"너 어제 큰 사고 나서 진짜 죽을 수도 있었어. 조심해.",en:"You could have died in that huge accident yesterday. Be careful."},
      {ko:"우리 남편은 원했다면 그 프로젝트를 혼자서 다 끝낼 수도 있었어.",en:"My husband could have finished the project all by himself if he wanted to."},
    ]},
  {pattern_en:"주어 + couldn't have + p.p.",explain_ko:"~했을 리가 없다 / ~할 수 없었을 것이다",
    examples:[
      {ko:"네 도움이 없었다면 난 그걸 해낼 수 없었을 거야.",en:"I couldn't have done it without your help."},
      {ko:"치안이 안 좋아서 밤늦게 그 목걸이를 차고 다닐 수 없었을 걸.",en:"You couldn't have worn that necklace outside late at night."},
      {ko:"비행기 표가 너무 비싸서 그들은 태국으로 여행을 갈 수 없었을 거야.",en:"They couldn't have traveled to Thailand because the flight tickets were too expensive."},
    ]},
  {pattern_en:"Could + 주어 + have + p.p. ~?",explain_ko:"~할 수도 있었을까? — 의문문",
    examples:[
      {ko:"우리가 준비를 더 철저히 했다면 그 문제를 피할 수도 있었을까?",en:"Could we have avoided the problem if we had prepared better?"},
      {ko:"그 남자가 길가에서 여자의 목걸이를 낚아채고 도망칠 수도 있었을까?",en:"Could the man have snatched the necklace and run away?"},
      {ko:"너가 캐나다에 있을 때 다른 사람을 만날 수도 있었을까?",en:"Could you have dated another foreign guy when you were in Canada?"},
    ]},
],examples:[]}
,{id:"would-have-past",label_ko:"내가 부자였을 텐데... — would have 가지 않은 길 상상하기",level:"중급",icon_name:"Star",
vocab:[
  {en:"would've saved",ko:"아꼈을 텐데"},
  {en:"would've gone",ko:"갔을 텐데"},
  {en:"would've loved",ko:"정말 좋아했을 텐데"},
  {en:"would've told",ko:"말해줬을 텐데"},
  {en:"would've been",ko:"~였을 텐데"},
  {en:"wouldn't have wasted",ko:"낭비하지 않았을 텐데"},
  {en:"wouldn't have bought",ko:"사지 않았을 텐데"},
  {en:"wouldn't have enjoyed",ko:"즐겁지 않았을 텐데"},
],
patterns:[
  {pattern_en:"주어 + would have + p.p.",explain_ko:"~했을 텐데 — 실제로는 일어나지 않은 일 상상하기",
    examples:[
      {ko:"부모님이 빌딩을 유산으로 주셨다면 내가 지금 엄청난 부자였을 텐데.",en:"I would have been a rich person if my parents had left me a building."},
      {ko:"너도 여기 왔으면 이 말레이시아 디저트 진짜 좋아했을 텐데.",en:"You would have loved this local dessert if you had come here."},
      {ko:"우리 시어머니가 살아계셨다면 이번 가족 여행을 정말 반기셨을 텐데.",en:"My mother-in-law would have loved this family trip if she were alive."},
    ]},
  {pattern_en:"주어 + wouldn't have + p.p.",explain_ko:"~하지 않았을 텐데 — 부정문",
    examples:[
      {ko:"네 말을 들었다면 난 그렇게 많은 돈을 낭비하지 않았을 텐데.",en:"I wouldn't have wasted so much money if I had listened to you."},
      {ko:"그 영화 진짜 노잼이라 너가 봤어도 전혀 즐겁지 않았을 거야.",en:"The movie was so boring you wouldn't have enjoyed it at all."},
      {ko:"그가 바샤커피 맛을 알았더라면 그 비싼 커피를 사지 않았을 텐데.",en:"He wouldn't have bought that expensive coffee if he knew how it tasted."},
    ]},
  {pattern_en:"Would + 주어 + have + p.p. ~?",explain_ko:"~했을까? — 의문문",
    examples:[
      {ko:"나한테 미리 물어봤다면 내가 널 기꺼이 도왔을까?",en:"Would I have helped you if you had asked me in advance?"},
      {ko:"너가 샤넬 매장에 있는 걸 봤다면 매니저가 할인을 해줬을까?",en:"Would the manager have given you a discount if they saw you at Chanel?"},
      {ko:"그 남자가 그날 저녁에 너한테 진짜로 프로포즈를 했을까?",en:"Would he have proposed to you that evening?"},
    ]},
],examples:[]}
,{id:"even-though",label_ko:"그래도 고마워 — even though / though 역접 표현",level:"중급",icon_name:"Heart",
vocab:[
  {en:"even though it was expensive",ko:"비쌌지만"},
  {en:"even though it failed",ko:"실패했지만"},
  {en:"even though I was tired",ko:"피곤했지만"},
  {en:"even though it rained",ko:"비가 왔지만"},
  {en:"even though he apologized",ko:"사과했지만"},
  {en:"even though we lost",ko:"졌지만"},
  {en:"thanks though",ko:"그래도 고마워"},
  {en:"stay up all night",ko:"밤을 새우다"},
  {en:"shed a tear",ko:"눈물을 흘리다"},
],
patterns:[
  {pattern_en:"Even though 주어 동사, 주어 동사",explain_ko:"비록 ~일지라도 — 긍정문",
    examples:[
      {ko:"비록 가격은 비쌌지만, 그래도 생일 선물 챙겨줘서 고마워.",en:"Even though it was expensive thank you for getting me a birthday gift anyway."},
      {ko:"그 계획이 실패했더라도 너는 최선을 다했으니 괜찮아.",en:"Even though the plan failed it is okay because you did your best."},
      {ko:"그녀는 온몸이 부서질 듯 피곤했지만 결국 밤을 새워 일을 끝냈어.",en:"Even though she was exhausted she stayed up all night to finish the work."},
    ]},
  {pattern_en:"Even though 주어 동사, 주어 부정동사",explain_ko:"비록 ~했음에도 ~하지 않다 — 부정문",
    examples:[
      {ko:"어제 비가 억수같이 왔지만 나는 우산을 쓰지 않았어.",en:"Even though it rained cats and dogs yesterday I didn't use an umbrella."},
      {ko:"그 남자가 무릎 꿇고 사과했음에도 그녀는 마음을 열지 않았어.",en:"Even though he apologized on his knees she didn't open her heart."},
      {ko:"우리는 경기에서 졌지만 아무도 눈물을 흘리지 않았어.",en:"Even though we lost the game nobody shed a tear."},
    ]},
  {pattern_en:"Even though 주어 동사, 의문문?",explain_ko:"~했음에도 과연 ~할까? — 의문문",
    examples:[
      {ko:"시간이 이렇게 늦었는데도 굳이 지금 바샤커피를 마셔야겠어?",en:"Even though it is late do you really have to drink a nice cafe right now?"},
      {ko:"그가 말레이시아 디저트를 싫어하는데도 너는 굳이 사다 줄 거니?",en:"Even though he hates local desserts are you still going to buy it for him?"},
      {ko:"돈이 그렇게 많으면서도 샤넬 가방 사는 게 그렇게 아까웠던 거야?",en:"Even though you have so much money was buying a Chanel bag such a waste to you?"},
    ]},
  {pattern_en:"문장, though.",explain_ko:"그래도 / 근데 — 문장 끝에 붙여서 대조 표현",
    examples:[
      {ko:"A: 나 그 가방 못 구했어. B: 물어봐 줘서 그래도 고마워.",en:"Thanks for asking though."},
      {ko:"다음에 보면 되지 뭐, 그래도.",en:"We can hang out next time though."},
      {ko:"거기 커피 좀 비싸긴 해. 근데 냄새는 진짜 좋더라 그래도.",en:"It smells really good though."},
    ]},
],examples:[]}
,{id:"although",label_ko:"걔가 잘해줬는데도 싫었어 — although 본능적 거부감",level:"중급",icon_name:"Frown",
vocab:[
  {en:"although he was nice to me",ko:"나한테 잘해줬지만"},
  {en:"although she had a cold",ko:"감기에 걸렸지만"},
  {en:"although it was a misunderstanding",ko:"오해였지만"},
  {en:"although I felt uncomfortable",ko:"불편했지만"},
  {en:"although they liked it",ko:"그들이 좋아했지만"},
  {en:"although he is rich",ko:"부자이지만"},
  {en:"instinctively disliked",ko:"본능적으로 싫었어"},
  {en:"cling to",ko:"매달리다"},
],
patterns:[
  {pattern_en:"Although 주어 동사, 주어 동사",explain_ko:"~이기는 하지만 — 긍정문",
    examples:[
      {ko:"걔가 나한테 엄청 잘해줬는데도 그냥 본능적으로 싫었어.",en:"Although he was nice to me I just instinctively disliked him."},
      {ko:"남편은 독한 감기에 걸렸는데도 끝까지 출근을 하더라고.",en:"Although my husband had a bad cold he went to work anyway."},
      {ko:"그게 단순한 오해였지만 이미 시어머니의 마음은 상해 버렸어.",en:"Although it was a simple misunderstanding my mother-in-law's feelings were already hurt."},
    ]},
  {pattern_en:"Although 주어 동사, 주어 부정동사",explain_ko:"~이긴 하지만 ~하지 않다 — 부정문",
    examples:[
      {ko:"그 자리가 불편하긴 했지만 난 티를 내지 않았어.",en:"Although I felt incredibly uncomfortable I didn't show it."},
      {ko:"시댁 식구들이 내 음식을 좋아하긴 했지만 더 만들어 달라고는 안 하시더라.",en:"Although they liked my cooking they didn't ask for more."},
      {ko:"그 사람이 부자이긴 한데 절대 남한테 돈을 안 써.",en:"Although he is rich he never spends money on others."},
    ]},
  {pattern_en:"Although 주어 동사, 의문문?",explain_ko:"~이긴 하지만 과연 ~일까? — 의문문",
    examples:[
      {ko:"네가 진실을 알고 있었음에도 왜 그 사람한테 매달렸던 거야?",en:"Although you knew the truth why did you still cling to him?"},
      {ko:"매니저가 50프로나 할인을 해줬는데도 넌 여전히 비싸다고 생각해?",en:"Although the manager gave a 50 percent discount do you still think it is expensive?"},
      {ko:"경찰이 소매치기를 잡았는데도 잃어버린 목걸이를 못 찾은 거야?",en:"Although the police caught the pickpocket did you end up losing your necklace?"},
    ]},
  {pattern_en:"문장, though.",explain_ko:"원어민들이 대조할 때 쓰는 패턴",
    examples:[
      {ko:"그 사람 엄청 착하긴 해. 근데 난 걔가 그냥 싫었어 그래도.",en:"I just disliked him though."},
      {ko:"말레이시아 날씨 더운 건 맞아. 근데 하늘은 진짜 예쁘다 그래도.",en:"The sky is really beautiful though."},
      {ko:"기말고사 진짜 어렵긴 했어. 근데 나 통과는 했어 그래도.",en:"I passed it though."},
    ]},
],examples:[]}
,{id:"though-contrast",label_ko:"그가 온다고 해도 난 못 가 — though 철벽 방어",level:"중급",icon_name:"Shield",
vocab:[
  {en:"though he says he'll come",ko:"온다고 하지만"},
  {en:"though I wanted to buy it",ko:"사고 싶었지만"},
  {en:"though we live close by",ko:"가까이 살지만"},
  {en:"though she looks young",ko:"어려 보이지만"},
  {en:"though they offered a job",ko:"기회를 제안했지만"},
  {en:"though it is a small mistake",ko:"작은 실수지만"},
  {en:"hold back",ko:"참다, 자제하다"},
  {en:"side dishes",ko:"반찬"},
],
patterns:[
  {pattern_en:"Though 주어 동사, 주어 동사",explain_ko:"~라 하더라도 — 긍정문",
    examples:[
      {ko:"그가 무릎 꿇고 빌며 온다고 해도 난 이번 모임 절대 못 가.",en:"Though he says he will come and beg I absolutely cannot go to this meeting."},
      {ko:"내가 샤넬 백을 미치도록 사고 싶었어도 통장 잔고를 보니 참아야 했어.",en:"Though I desperately wanted to buy the Chanel bag I had to hold back after looking at my bank account."},
      {ko:"우리는 친정집이랑 가까이 살아서 친정엄마가 반찬을 자주 가져다주셔.",en:"Though we live very close to my parents house my mom often brings us side dishes."},
    ]},
  {pattern_en:"Though 주어 동사, 주어 부정동사",explain_ko:"~하긴 하지만 ~하지 않다 — 부정문",
    examples:[
      {ko:"그녀가 화장 안 하면 어려 보이긴 하지만 절대 애 같지는 않아.",en:"Though she looks as young as a high schooler without makeup she never acts like a child."},
      {ko:"그 회사에서 파격적인 조건으로 제안해왔지만 난 내 커리어를 위해 수락하지 않았어.",en:"Though they offered a great job with amazing terms I didn't accept it for my career."},
      {ko:"이게 아주 사소한 실수이긴 하지만 보고서 전체를 망치지는 않았어.",en:"Though it is a small mistake it didn't ruin the entire report."},
    ]},
  {pattern_en:"Though 주어 동사, 의문문?",explain_ko:"~하긴 하지만 과연 ~일까? — 의문문",
    examples:[
      {ko:"태국 여행을 그렇게 야심 차게 계획했는데도 결국 비행기 표를 취소한 거야?",en:"Though you planned a trip to Thailand so ambitiously did you end up canceling the flight tickets?"},
      {ko:"남편이 결혼기념일을 기억하고 있었으면서도 너한테 아무 선물도 안 준 거야?",en:"Though your husband remembered your anniversary did he not give you any gift?"},
      {ko:"아이들이 다 컸는데도 아직도 손이 그렇게 많이 가고 힘드니?",en:"Though the kids are all grown up now do they still require so much work and effort?"},
    ]},
  {pattern_en:"문장, though.",explain_ko:"앞 내용 거절 후 내 상황 말하기",
    examples:[
      {ko:"파티 초대해 준 건 고마워. 근데 나 진짜 못 가 그래도.",en:"I absolutely cannot go though."},
      {ko:"그 사람 계좌에 돈이 많긴 해. 근데 나랑 결혼할 건 아니잖아 그래도.",en:"He is not going to marry me though."},
      {ko:"솜사탕 디저트 비주얼은 예쁘네. 근데 내 스타일은 아니야 그래도.",en:"It is not my style though."},
    ]},
],examples:[]}
,{id:"if-real",label_ko:"너 내일 오면 바샤커피 쏜다! — if 현실 조건문",level:"중급",icon_name:"Coffee",
vocab:[
  {en:"if it rains",ko:"비가 오면"},
  {en:"if you come tomorrow",ko:"내일 오면"},
  {en:"if my husband is tired",ko:"남편이 피곤하면"},
  {en:"if the kids don't sleep",ko:"아이들이 자지 않으면"},
  {en:"if you don't buy it",ko:"사지 않으면"},
  {en:"if you don't mind",ko:"괜찮으시다면"},
  {en:"if you are free",ko:"시간 되면"},
  {en:"if you need money",ko:"돈 필요하면"},
],
patterns:[
  {pattern_en:"If 주어 현재동사, 주어 will 동사",explain_ko:"~하면 ~할 거야 — 미래에 일어날 가능성 높은 일",
    examples:[
      {ko:"내일 비가 오면 우리 그냥 집에 있을 거야.",en:"If it rains tomorrow we will just stay at home."},
      {ko:"너 내일 여기 오면 내가 바샤커피 한잔 쏠게.",en:"If you come here tomorrow I will treat you to a really good a nice cafe."},
      {ko:"우리 남편은 피곤하면 퇴근하고 바로 잠들어요.",en:"If my husband is tired he goes straight to sleep after work."},
    ]},
  {pattern_en:"If 주어 don't 동사, 주어 won't 동사",explain_ko:"~하지 않으면 ~안 한다 — 부정문",
    examples:[
      {ko:"아이들이 지금 자지 않으면 이따가 밤에 엄청 칭얼거릴 거야.",en:"If the kids don't sleep now they will be very cranky later tonight."},
      {ko:"너 이번에 그 가방 안 사면 나중엔 리셀가 붙어서 못 산다.",en:"If you don't buy that bag this time you won't be able to buy it later."},
      {ko:"너가 말레이시아에 오지 않으면 이 디저트를 먹어볼 기회가 없어.",en:"If you don't visit here we won't have a chance to try this dessert."},
    ]},
  {pattern_en:"If 주어 현재동사, will 주어 동사?",explain_ko:"~하면 ~할 거야? — 의문문",
    examples:[
      {ko:"내가 기말고사를 망치면 너 나한테 실망할 거니?",en:"If I fail the final exam will you be disappointed in me?"},
      {ko:"그 사람이 또 약속을 어기면 너 진짜 걔랑 헤어질 거야?",en:"If he breaks his promise again are you really going to break up with him?"},
      {ko:"비행기 표 가격이 더 떨어지면 우리 태국 여행 예약해야 할까?",en:"If the flight ticket price drops more should we book the Thailand trip?"},
    ]},
  {pattern_en:"주어 동사, if 조건절.",explain_ko:"조건절을 뒤로 보내 툭 던지는 표현",
    examples:[
      {ko:"불편하지 않으시다면 제 말 좀 들어주시겠어요?",en:"Could you listen to me if you don't mind?"},
      {ko:"시간 괜찮으시면 저랑 샤넬 매장 같이 가실래요?",en:"Would you like to go to the Chanel store with me if you are free?"},
      {ko:"돈 필요하면 언제든 나한테 얘기해.",en:"Just tell me if you need money."},
    ]},
],examples:[]}
,{id:"if-unreal-present",label_ko:"내가 복권 당첨되면 좋은 집부터 살 거야! — if 현재 상상 가정법",level:"중급",icon_name:"Star",
vocab:[
  {en:"if I won the lottery",ko:"복권에 당첨된다면"},
  {en:"if I were a building owner",ko:"건물주라면"},
  {en:"if she knew his number",ko:"번호를 안다면"},
  {en:"if we didn't live in Canada",ko:"캐나다에 살지 않는다면"},
  {en:"if he didn't have a car",ko:"차가 없다면"},
  {en:"if I were you",ko:"내가 너라면"},
  {en:"if necessary",ko:"필요하다면"},
  {en:"if I had more time",ko:"시간이 더 있다면"},
],
patterns:[
  {pattern_en:"If 주어 과거동사, 주어 would 동사원형",explain_ko:"~한다면 ~할 텐데 — 지금 일어날 가능성이 거의 없는 상상",
    examples:[
      {ko:"내가 만약 복권에 당첨되면 강남에 으리으리한 집부터 살 텐데.",en:"If I won the lottery I would buy a nice house first thing."},
      {ko:"내가 건물주라면 매달 임대료 받으면서 여행만 다닐 텐데.",en:"If I were a building owner I would just travel while receiving monthly rent."},
      {ko:"그녀가 그 사람 연락처를 안다면 지금 당장 전화를 걸어 따질 텐데.",en:"If she knew his phone number she would call and confront him right away."},
    ]},
  {pattern_en:"If 주어 didn't 동사원형, 주어 wouldn't 동사원형",explain_ko:"~하지 않는다면 ~하지 않을 텐데 — 부정문",
    examples:[
      {ko:"우리가 캐나다에 살지 않는다면 이런 지독한 추위를 겪지 않아도 될 텐데.",en:"If we didn't live in Canada we wouldn't have to suffer this terrible cold."},
      {ko:"그 남자가 차가 없다면 매번 널 데리러 오지 못할 거야.",en:"If he didn't have a car he wouldn't be able to pick you up every time."},
      {ko:"내가 돈이 많지 않다면 그 비싼 가방을 고민 없이 사지는 못하겠지.",en:"If I didn't have tons of money I wouldn't buy that expensive bag without hesitation."},
    ]},
  {pattern_en:"If 주어 과거동사, would 주어 동사원형?",explain_ko:"~라면 과연 ~하겠어? — 의문문",
    examples:[
      {ko:"내가 너라면 그 사람 사과를 받아주고 다시 만나겠니?",en:"If you were me would you accept his apology and see him again?"},
      {ko:"우리가 내일 당장 잘린다면 넌 대안이 있긴 하니?",en:"If we got fired tomorrow would you have a backup plan?"},
      {ko:"남편이 갑자기 비상금을 들킨다면 순순히 불까?",en:"If your husband got caught with his secret money would he confess easily?"},
    ]},
  {pattern_en:"주어 would 동사, if 과거절.",explain_ko:"원어민들이 조건절을 뒤에 붙이는 패턴",
    examples:[
      {ko:"내가 너라면 절대 그 돈 안 빌려준다.",en:"I would never lend him the money if I were you."},
      {ko:"필요하다면 제가 기꺼이 매니저와 통화할게요.",en:"I would gladly speak with your manager if necessary."},
      {ko:"시간만 더 있으면 나도 도와줄 수 있을 텐데.",en:"I could help you if I had more time."},
    ]},
],examples:[]}
,{id:"if-unreal-past",label_ko:"내가 그때 주식 샀으면 대박 났을 텐데! — if 과거 후회 가정법",level:"고급",icon_name:"TrendingUp",
vocab:[
  {en:"if I had bought Bitcoin",ko:"비트코인을 샀더라면"},
  {en:"if you had listened to me",ko:"내 말을 들었더라면"},
  {en:"if she hadn't met him",ko:"그를 만나지 않았더라면"},
  {en:"if we hadn't prepared",ko:"준비를 안 했더라면"},
  {en:"if he hadn't studied",ko:"공부를 안 했더라면"},
  {en:"if we hadn't hurried",ko:"서두르지 않았더라면"},
  {en:"if things had been different",ko:"상황이 달랐더라면"},
],
patterns:[
  {pattern_en:"If 주어 had p.p., 주어 would have p.p.",explain_ko:"~했더라면 ~했을 텐데 — 과거 후회",
    examples:[
      {ko:"내가 그때 그 주식 사뒀으면 지금 엄청 올랐을 텐데.",en:"If I had bought that stock back then it would have gone up a lot."},
      {ko:"너가 그때 내 말을 들었더라면 사기당해서 돈을 날리진 않았을 텐데.",en:"If you had listened to me you wouldn't have lost your money to a scam."},
      {ko:"그녀가 애초에 그 남자를 만나지 않았더라면 인생이 훨씬 행복했을 텐데.",en:"If she hadn't met him in the first place her life would have been much happier."},
    ]},
  {pattern_en:"If 주어 hadn't p.p., 주어 wouldn't have p.p.",explain_ko:"~하지 않았더라면 ~하지 않았을 텐데 — 부정문",
    examples:[
      {ko:"우리가 준비를 더 철저히 하지 않았더라면 그 대형 사고를 피하지 못했을 거야.",en:"If we hadn't prepared thoroughly we wouldn't have avoided that huge accident."},
      {ko:"그가 기말고사 공부를 열심히 하지 않았더라면 이번에 낙제했을 걸.",en:"If he hadn't studied hard for the final exam he would have failed this time."},
      {ko:"우리가 서두르지 않았더라면 비행기를 놓쳐서 태국에 못 갈 뻔했어.",en:"If we hadn't hurried we would have missed the flight to Thailand."},
    ]},
  {pattern_en:"If 주어 had p.p., would 주어 have p.p.?",explain_ko:"~했더라면 과연 ~했을까? — 의문문",
    examples:[
      {ko:"그들이 공항에 더 일찍 도착했더라면 샤넬 백을 살 수 있었을까?",en:"If they had arrived earlier would they have been able to buy a Chanel bag?"},
      {ko:"네가 먼저 사과했더라면 시어머니 마음이 그렇게까지 상하셨을까?",en:"If you had apologized first would your mother-in-law have been that upset?"},
      {ko:"경찰이 소매치기를 못 잡았더라면 넌 목걸이를 영영 못 찾았을까?",en:"If the police hadn't caught the pickpocket would you have lost your necklace forever?"},
    ]},
  {pattern_en:"주어 would have p.p., if 주어 hadn't p.p.",explain_ko:"과거 후회를 뒤로 밀어 말하기",
    examples:[
      {ko:"나 진짜 눈물 날 뻔했잖아, 너가 나 안 잡아줬으면.",en:"I would have cried if you hadn't held me."},
      {ko:"일이 다르게 풀렸더라면 우리도 대박 났을 텐데.",en:"We could have been successful if things had been different."},
      {ko:"나 어제 매니저한테 한 소리 들을 뻔했어, 너가 안 도왔으면.",en:"I would have been scolded by the manager if you hadn't helped me."},
    ]},
],examples:[]}
,{id:"if-mixed",label_ko:"그때 열심히 살았으면 지금 떵떵거릴 텐데! — 혼합 가정법",level:"고급",icon_name:"GitBranch",
vocab:[
  {en:"if I had studied harder",ko:"공부를 더 했더라면"},
  {en:"if you had taken the job",ko:"그 직장을 잡았더라면"},
  {en:"if we hadn't moved",ko:"이사를 안 했더라면"},
  {en:"if he had married her",ko:"그녀와 결혼했더라면"},
  {en:"if I had saved money",ko:"돈을 아꼈더라면"},
  {en:"if she had passed",ko:"면접에 붙었더라면"},
  {en:"if I had known",ko:"미리 알았더라면"},
],
patterns:[
  {pattern_en:"If 주어 had p.p., 주어 would 동사원형 (지금)",explain_ko:"그때 ~했더라면 지금 ~할 텐데 — 과거가 현재에 영향",
    examples:[
      {ko:"학창 시절에 공부를 더 열심히 했더라면 지금 하버드 졸업장 들고 떵떵거리며 살 텐데.",en:"If I had studied harder in school I would be successful now with a Harvard degree."},
      {ko:"그때 말레이시아 취직 제안을 수락했더라면 지금쯤 쿠알라룸푸르에서 살고 있을 텐데.",en:"If you had taken the job offer here you would be living in the city right now."},
      {ko:"작년에 시댁 근처로 이사를 안 왔더라면 지금 매주 시댁에 안 가도 될 텐데.",en:"If we hadn't moved near my in-laws last year we wouldn't have to visit them every week."},
    ]},
  {pattern_en:"If 주어 had p.p., 주어 wouldn't 동사원형 (지금)",explain_ko:"그때 ~했더라면 지금 ~하지 않을 텐데 — 부정문",
    examples:[
      {ko:"그가 그때 그녀와 결혼했더라면 지금 이렇게 외롭게 혼자 살진 않을 텐데.",en:"If he had married her back then he wouldn't be living all alone now."},
      {ko:"젊었을 때 돈을 좀 아껴뒀더라면 지금 잔고 보면서 한숨 쉬진 않을 텐데.",en:"If I had saved money when I was young I wouldn't be sighing over my bank account now."},
      {ko:"그녀가 저번 달 면접에 합격했더라면 지금 구직 사이트를 뒤적거리며 스트레스받지 않을 거야.",en:"If she had passed the interview last month she wouldn't be stressed out looking for a job now."},
    ]},
  {pattern_en:"If 주어 had p.p., would 주어 동사원형 지금?",explain_ko:"그랬더라면 지금 ~일까? — 의문문",
    examples:[
      {ko:"내가 그때 주식 사지 말라는 남편 말을 들었더라면 우리 지금 더 유복하게 살고 있을까?",en:"If I had listened to my husband about not buying stocks would we be richer now?"},
      {ko:"그때 대출을 안 받았더라면 지금 매달 이자 때문에 이렇게 쩔쩔매고 있을까?",en:"If we hadn't taken out a loan back then would we be struggling with interest every month now?"},
      {ko:"매니저가 그때 실수를 바로잡았더라면 우리 부서가 지금 이 고생을 하고 있을까?",en:"If the manager had fixed the mistake then would our department be suffering like this now?"},
    ]},
  {pattern_en:"주어 would 동사원형 지금, if 주어 had p.p.",explain_ko:"지금 상태 말하고 과거 원인을 뒤에 붙이기",
    examples:[
      {ko:"나 지금 영어 잘하고 있을 텐데, 어릴 때 유학 갔었으면.",en:"I would speak English fluently now if I had studied abroad."},
      {ko:"우리 지금 진짜 부자일 텐데, 그때 그 땅을 안 팔았으면.",en:"We would be rich now if we hadn't sold that land."},
      {ko:"내가 미리 알았으면 지금 이렇게 고생 안 하지.",en:"I wouldn't be struggling like this if I had known in advance."},
    ]},
],examples:[]}
,{id:"binge",label_ko:"나 어제 넷플릭스 완전 몰아보기 했잖아! — binge 표현",level:"중급",icon_name:"Tv",
vocab:[
  {en:"binge-watch",ko:"드라마를 몰아보다"},
  {en:"binge-eat",ko:"폭식하다"},
  {en:"binge-drink",ko:"폭음하다"},
  {en:"binge-spend",ko:"돈을 흥청망청 쓰다"},
  {en:"go on a binge",ko:"한동안 미친 듯이 빠지다"},
  {en:"black out",ko:"필름이 끊기다"},
  {en:"late-night food",ko:"야식"},
  {en:"get stressed",ko:"스트레스 받다"},
],
patterns:[
  {pattern_en:"주어 binge-watch / binge-eat / binge-drink / binge-spend",explain_ko:"통제 못하고 한꺼번에 몰아서 하다 — 동사형",
    examples:[
      {ko:"나 어제 주말 내내 넷플릭스 시리즈 새로 나온 거 완전히 몰아보기 했어.",en:"I binge-watched the whole new Netflix series all weekend."},
      {ko:"우리 남편은 스트레스 받으면 밤마다 과자랑 야식을 그렇게 폭식하더라.",en:"My husband binge-eats snacks and late-night food whenever he gets stressed."},
      {ko:"그 사람들은 주말마다 모여서 필름이 끊길 때까지 폭음하는 버릇이 있어.",en:"They binge-drink every weekend until they black out."},
    ]},
  {pattern_en:"주어 didn't binge-행동",explain_ko:"몰아서 하거나 과하게 하지 않다 — 부정문",
    examples:[
      {ko:"나 예전엔 드라마 몰아보곤 했는데 요즘은 눈 피로해서 그렇게 못 해.",en:"I didn't binge-watch shows like I used to. My eyes get too tired these days."},
      {ko:"이번 다이어트 때는 스트레스 받아도 절대 폭식 안 하려고 노력 중이야.",en:"I am trying my best not to binge-eat even if I feel stressed during this diet."},
      {ko:"나 이번 달에는 백화점 가도 진짜 필요한 것만 사고 돈 흥청망청 안 썼어.",en:"I didn't binge-spend at the department store this month. I only bought what I needed."},
    ]},
  {pattern_en:"Did you binge-행동 ~?",explain_ko:"과하게 몰아서 한 거야? — 의문문",
    examples:[
      {ko:"너 설마 어제 잠 한 숨 안 자고 그 드라마 전 에피소드 다 몰아본 거야?",en:"Did you seriously binge-watch all the episodes last night without sleeping?"},
      {ko:"속상한 일 있다고 그렇게 밤새도록 술을 폭음하면 다음 날 괜찮겠어?",en:"Are you really going to binge-drink all night just because you are upset?"},
      {ko:"너 왜 스트레스만 받으면 이렇게 옷이랑 가방을 충동적으로 몰아서 사는 거니?",en:"Why do you binge-spend on clothes and bags whenever you get stressed out?"},
    ]},
  {pattern_en:"주어 go on a binge",explain_ko:"go on a binge — 구어체 실전 표현",
    examples:[
      {ko:"나 어제 완전 이성을 잃고 빵이랑 떡볶이 폭식했잖아.",en:"I totally went on an eating binge with bread and tteokbokki yesterday."},
      {ko:"나 이번 휴가 때 밀린 미드 몰아보기 제대로 하려고.",en:"I am going to go on a watching binge during my vacation."},
      {ko:"걔 저번 주에 보너스 받더니 샤넬 매장 가서 돈을 아주 흥청망청 쓰더라고.",en:"He received his bonus last week and went on a spending binge at the Chanel store."},
    ]},
],examples:[]}
,{id:"therapy-expressions",label_ko:"스트레스 받아서 쇼핑 치료 좀 했잖아! — therapy 표현",level:"중급",icon_name:"Heart",
vocab:[
  {en:"retail therapy",ko:"쇼핑 치료 (시발비용)"},
  {en:"carb therapy",ko:"탄수화물 치료 (빵/떡볶이 흡입)"},
  {en:"pet therapy",ko:"반려동물 치료 (힐링)"},
  {en:"nature therapy",ko:"자연 치료 (초록초록 요양)"},
  {en:"caffeine therapy",ko:"카페인 치료 (커피 한 잔)"},
  {en:"need some therapy",ko:"기분 전환이 필요하다"},
  {en:"get chewed out",ko:"혼나다, 잔소리 듣다"},
  {en:"de-stress",ko:"스트레스를 풀다"},
],
patterns:[
  {pattern_en:"주어 need/do 명사 therapy",explain_ko:"~치료가 필요하다 / ~치료를 하다",
    examples:[
      {ko:"나 오늘 매니저한테 잔소리 듣고 퇴근길에 샤넬 매장 들러서 쇼핑 치료 좀 했잖아.",en:"I got chewed out by my manager today so I did some retail therapy at the Chanel store."},
      {ko:"우리 남편은 회사에서 깨지고 오면 꼭 매운 떡볶이 같은 탄수화물 치료를 찾더라.",en:"My husband always needs some carb therapy like spicy tteokbokki whenever he has a rough day at work."},
      {ko:"걔는 요즘 주말마다 강아지 카페 가서 귀여운 애들 보면서 동물 치료받고 있어.",en:"She goes to a dog cafe every weekend to get some serious pet therapy from those cute puppies."},
    ]},
  {pattern_en:"주어 can't afford / don't do 명사 therapy",explain_ko:"~치료는 할 여유가 없다 / 안 한다 — 부정문",
    examples:[
      {ko:"나 이번 달 카드 값 보니까 다음 달엔 쇼핑 치료는 절대 못 하겠다.",en:"Looking at my credit card bill I definitely can't afford any retail therapy next month."},
      {ko:"나 요즘 다이어트 독하게 하는 중이라 아무리 열받아도 탄수화물 치료는 안 해.",en:"I am on a strict diet so I don't do carb therapy at night no matter how frustrated I am."},
      {ko:"이번 휴가 때 쇼핑 치료 같은 건 안 하고 그냥 시골 가서 쉬려고.",en:"We don't need any retail therapy for this vacation. We are just going to rest in the countryside."},
    ]},
  {pattern_en:"Do you want some 명사 therapy?",explain_ko:"~치료 좀 할래? — 의문문",
    examples:[
      {ko:"너 기분 가라앉아 보이는데 퇴근하고 바샤커피 가서 카페인 치료 좀 할래?",en:"You look so down. Do you want to go get some caffeine therapy with me at a nice cafe after work?"},
      {ko:"맨날 쇼핑 치료만 하면 통장 잔고가 남아나겠니?",en:"If you always rely on retail therapy to de-stress will you have any money left in your bank account?"},
      {ko:"주말에 집구석에만 있지 말고 밖에 나가서 자연 치료 좀 받는 게 어때?",en:"Instead of staying home all weekend why don't you go outside and get some nature therapy?"},
    ]},
  {pattern_en:"명사 is my therapy.",explain_ko:"~가 나한테는 최고의 치료야 — 실전 구어체",
    examples:[
      {ko:"난 퇴근하고 침대에 누워서 인스타 릴스 보는 게 유일한 치료야.",en:"Watching Instagram Reels in bed after work is my therapy."},
      {ko:"육아에 지칠 때 친구들이랑 수다 떨면서 매운 음식 먹는 게 나한테는 치료지 뭐.",en:"Eating spicy food while chatting with friends is my therapy when I am exhausted from parenting."},
      {ko:"나한테는 주말 아침에 아무 생각 없이 베이킹하는 게 최고의 치료야.",en:"Baking blankly on a Sunday morning is my therapy."},
    ]},
],examples:[]}
,{id:"abbreviations",label_ko:"FYI가 뭐야? — 원어민 필수 축약어",level:"기초",icon_name:"Hash",
vocab:[
  {en:"POV",ko:"관점, 시점 (Point of View)"},
  {en:"RSVP",ko:"참석 여부 답변 (Please respond)"},
  {en:"BYOB",ko:"술/음료 각자 챙겨오기 (Bring Your Own Bottle)"},
  {en:"ASAP",ko:"가능한 한 빨리 (As Soon As Possible)"},
  {en:"FYI",ko:"참고로, 알아둬 (For Your Information)"},
  {en:"TBD",ko:"추후 결정 예정 (To Be Determined)"},
  {en:"ETA",ko:"예상 도착 시간 (Estimated Time of Arrival)"},
  {en:"BRB",ko:"금방 올게 (Be Right Back)"},
],
patterns:[
  {pattern_en:"In someone's POV, ~",explain_ko:"~의 관점에서는 — 누군가의 입장 설명할 때",
    examples:[
      {ko:"그녀의 관점에선 이건 완전히 잘못됐대.",en:"In her POV this is completely wrong."},
      {ko:"결정을 내리기 전에 나는 그의 관점을 알고 싶어.",en:"I want to know his POV before we make a decision."},
      {ko:"내 관점에서는 이게 제일 좋은 선택이야.",en:"In my POV this is the best choice."},
    ]},
  {pattern_en:"RSVP / Don't worry about RSVPing",explain_ko:"파티 참석 여부 답변 — 초대할 때",
    examples:[
      {ko:"RSVP 할 걱정 안 해도 돼, 난 그냥 너가 나타날 거라고 기대할 거야.",en:"Don't worry about RSVPing I am expecting you to show up anyway."},
      {ko:"파티 간다고 답장 안 해도 되니까 그냥 와.",en:"You don't need to RSVP to the party just come over."},
      {ko:"이번 주말 파티 RSVP 해줄 수 있어?",en:"Can you RSVP to the party this weekend?"},
    ]},
  {pattern_en:"We should leave ASAP / finish ASAP",explain_ko:"가능한 한 빨리 ~해야 해 — 급할 때",
    examples:[
      {ko:"우린 가능한 한 빨리 집을 나서야 해 안 그러면 교통체증에 갇힐 거야.",en:"We should leave the house ASAP or we will get stuck in traffic."},
      {ko:"싱크대 밑에 물이 새. 가능한 한 빨리 고쳐야 해.",en:"It is leaking under the sink so we need to fix it ASAP."},
      {ko:"나 지금 ASAP으로 병원 가야 할 것 같아.",en:"I think I need to go to the hospital ASAP."},
    ]},
  {pattern_en:"FYI, + 문장",explain_ko:"참고로, 알아둬 — 유용한 정보 넌지시 건낼 때",
    examples:[
      {ko:"알아둬, 겐팅 엄청 추우니까 재킷 꼭 가지고 가.",en:"FYI it is very cold in the highlands so make sure to bring a jacket."},
      {ko:"참고로 그 사람 만나는 사람 있어.",en:"FYI he is already seeing someone."},
      {ko:"참고로 내일 그 카페 문 닫아.",en:"FYI that cafe is closed tomorrow."},
    ]},
  {pattern_en:"Time / place is TBD",explain_ko:"아직 안 정해졌어 — 일정 미정일 때",
    examples:[
      {ko:"날짜는 아직 안 정해졌어. 최종 결정 나면 내가 알려줄게.",en:"The date is still TBD but I will keep you posted once it is finalized."},
      {ko:"우리도 아직 몰라, 장소는 안 정해졌어.",en:"We don't know the venue yet. The location is TBD."},
      {ko:"시간은 TBD야, 나중에 알려줄게.",en:"The time is TBD I will let you know later."},
    ]},
  {pattern_en:"What's your ETA? / My ETA is ~",explain_ko:"예상 도착 시간이 언제야? — 약속할 때",
    examples:[
      {ko:"집 몇 시쯤 도착해? 저녁 준비해 놓게.",en:"What is your ETA home? I will prepare dinner."},
      {ko:"내 예상 도착 시간은 10분 뒤야, 밖에서 기다려줘.",en:"My ETA is in 10 minutes so wait for me outside."},
      {ko:"ETA가 언제야? 나 주차장에서 기다리고 있어.",en:"What is your ETA? I am waiting in the parking lot."},
    ]},
  {pattern_en:"BRB, I have to ~",explain_ko:"금방 올게, ~해야 해 — 잠시 자리 비울 때",
    examples:[
      {ko:"나 바로 올게요, 이거 우리 집주인 전화라서 받아야 해요.",en:"BRB it is my landlord I have to take this call."},
      {ko:"내 가방 좀 잠깐 봐줄래? 나 바로 다시 올게.",en:"Can you watch my bag for a second? I will BRB."},
      {ko:"BRB 화장실 좀 다녀올게.",en:"BRB I have to use the restroom real quick."},
    ]},
],examples:[]}


,{id:"prepositions-time-place",label_ko:"at on in 언제 어디서? — 시간·장소 전치사",level:"중급",icon_name:"MapPin",
vocab:[
  {en:"at 9:00 / at night",ko:"정확한 시간·순간"},
  {en:"on Friday / on Christmas",ko:"특정 요일·날짜"},
  {en:"in spring / in 2025",ko:"긴 기간·계절·연도"},
  {en:"for 3 hours",ko:"지속 시간 (숫자)"},
  {en:"during the movie",ko:"~하는 동안 (명사)"},
  {en:"since 2020",ko:"과거 시작점부터"},
  {en:"at the bus stop",ko:"특정 지점·목적지"},
  {en:"on the subway",ko:"넓은 대중교통"},
  {en:"in the car / in a taxi",ko:"좁은 교통수단·밀폐공간"},
  {en:"in the nick of time",ko:"아슬아슬하게 딱 맞게"},
  {en:"on schedule",ko:"예정대로"},
  {en:"on the market",ko:"시판 중 (팔고 있는)"},
  {en:"in the market for",ko:"~를 사려고 하는"},
  {en:"at the corner",ko:"교차로"},
  {en:"on the corner",ko:"길모퉁이"},
  {en:"in the corner",ko:"방 구석"},
],
patterns:[
  {pattern_en:"AT — 정확한 시간/지점",explain_ko:"시계 시간, 순간, 목적지 같은 '점'에 써요",
    examples:[
      {ko:"나 9시에 도착해.",en:"I will arrive at 9."},
      {ko:"나 버스 정류장에서 기다리고 있어.",en:"I am waiting at the bus stop."},
      {ko:"나 밤에는 항상 배고파.",en:"I am always hungry at night."},
    ]},
  {pattern_en:"ON — 특정 날/표면/대중교통",explain_ko:"요일, 날짜, 표면에 닿은 것, 서서 다닐 수 있는 교통수단",
    examples:[
      {ko:"우리 금요일에 만나자.",en:"Let us meet on Friday."},
      {ko:"나 지하철 타고 있어.",en:"I am on the subway."},
      {ko:"그 아파트 지금 시판 중이야.",en:"That apartment is on the market."},
    ]},
  {pattern_en:"IN — 기간/밀폐공간/교통수단",explain_ko:"계절, 연도, 안에 갇힌 공간, 앉아야 하는 교통수단",
    examples:[
      {ko:"나 봄에 말레이시아로 이사했어.",en:"I moved abroad in spring."},
      {ko:"나 택시 안에 있어.",en:"I am in a taxi."},
      {ko:"나 지금 새 노트북 살까 고민 중이야.",en:"I am in the market for a new laptop."},
    ]},
  {pattern_en:"for / during / since 구별",explain_ko:"기간 vs 이벤트 vs 시작점",
    examples:[
      {ko:"나 3시간 기다렸어.",en:"I waited for 3 hours."},
      {ko:"영화 보는 동안 폰 꺼줘.",en:"Please turn off your phone during the movie."},
      {ko:"나 2020년부터 여기 살았어.",en:"I have lived here since 2020."},
    ]},
],
examples:[],
interview_focus:"시간·장소 전치사 at/on/in과 for/during/since를 자연스럽게 사용하도록 유도하세요. 실수하면 왜 틀렸는지 프레임워크를 기반으로 친절하게 설명해주세요.",
interview_system:`You are an expert English Speaking Coach. Your goal: help master "Prepositions of Time and Place" through conversation.

GRAMMAR FRAMEWORK:
TIME: AT (exact moments: at 9pm, at night) / ON (days/dates: on Friday, on Christmas) / IN (longer periods: in spring, in 2025)
for + duration numbers (for 3 hours) / during + noun/event (during the movie) / since + past starting point (since 2020)

PLACE: AT (specific point/purpose: at the bus stop) / ON (surface/big transport: on the subway) / IN (enclosed space/small transport: in the car, in a taxi)

IDIOMS: in the nick of time / on schedule / on the market (for sale) / in the market for (looking to buy) / at/on/in the corner (different meanings)

RULES:
1. Ask ONE question per turn using these prepositions naturally
2. After answer: gently correct ANY preposition mistake + explain WHY using the framework above
3. Feedback in Korean (1-2 sentences) then next question in English
4. 10 questions total then wrap up with summary in Korean
5. Questions should be real Korean adult life situations

Ask your first question directly. No greetings.`}

,{id:"be-verb-present",label_ko:"걔 이뻐? — Be동사 현재",level:"기초",icon_name:"User",
vocab:[
  {en:"Are you",ko:"너 ~야? / 너 ~해?"},
  {en:"Is he",ko:"그 사람 ~야?"},
  {en:"Is she",ko:"그녀 ~야?"},
  {en:"Are they",ko:"걔네 ~야?"},
  {en:"Is it",ko:"그거 ~야?"},
  {en:"Am I",ko:"나 ~야?"},
  {en:"Are we",ko:"우리 ~야?"},
  {en:"Is there",ko:"~가 있어?"},
  {en:"Are there",ko:"~들이 있어?"},
],
patterns:[
  {pattern_en:"Are you + 형용사/명사?",explain_ko:"너 ~야? — 현재 상태 물어볼 때",
    examples:[
      {ko:"너 지금 바빠?",en:"Are you busy right now?"},
      {ko:"너 요즘 행복해?",en:"Are you happy these days?"},
      {ko:"너 선생님이야?",en:"Are you a teacher?"},
    ]},
  {pattern_en:"Is he/she + 형용사/명사?",explain_ko:"그 사람 ~야? — 3인칭 단수",
    examples:[
      {ko:"그 사람이 여기 매니저야?",en:"Is he a manager here?"},
      {ko:"그녀 지금 집에 있어?",en:"Is she at home now?"},
      {ko:"그 사람 한국 사람이야?",en:"Is he Korean?"},
    ]},
  {pattern_en:"Are they + 형용사/명사?",explain_ko:"걔네 ~야? — 복수",
    examples:[
      {ko:"걔네 오늘 사무실에 있어?",en:"Are they at the office today?"},
      {ko:"걔네 부부야?",en:"Are they married?"},
      {ko:"걔네 준비됐어?",en:"Are they ready?"},
    ]},
  {pattern_en:"Is there / Are there ~?",explain_ko:"~가 있어? — 존재 물어볼 때",
    examples:[
      {ko:"근처에 편의점 있어?",en:"Is there a convenience store nearby?"},
      {ko:"주차 공간 있어?",en:"Is there parking available?"},
      {ko:"여기 화장실 있어?",en:"Are there restrooms here?"},
    ]},
],examples:[],
interview_system:`You are a friendly English coach teaching "Be-verb Present" questions to a Korean adult.
Curriculum:
- Are you / Is he / Is she / Are they / Is it / Am I / Are we / Is there / Are there

RULES:
1. Ask ONE question per turn in natural English using be-verb questions
2. After answer: correct be-verb mistakes gently in Korean (1-2 sentences)
3. Then ask next question naturally
4. After 10 questions: "정말 잘하셨어요! 🎉" + Korean summary
5. Use real Korean adult life situations

Ask your first question directly. No greetings.`}

,{id:"be-verb-past",label_ko:"너 어제 바빴어? — Be동사 과거",level:"기초",icon_name:"Clock",
vocab:[
  {en:"Were you",ko:"너 ~였어? / 너 ~했어?"},
  {en:"Was he",ko:"그 사람 ~였어?"},
  {en:"Was she",ko:"그녀 ~였어?"},
  {en:"Were they",ko:"걔네 ~였어?"},
  {en:"Was it",ko:"그거 ~였어?"},
  {en:"Was I",ko:"내가 ~였어?"},
  {en:"Were we",ko:"우리 ~였어?"},
  {en:"Was there",ko:"~가 있었어?"},
  {en:"Were there",ko:"~들이 있었어?"},
],
patterns:[
  {pattern_en:"Were you + 형용사/명사?",explain_ko:"너 어제 ~했어? — 과거 상태",
    examples:[
      {ko:"너 어제 피곤했어?",en:"Were you tired yesterday?"},
      {ko:"너 어렸을 때 말랐어?",en:"Were you thin when you were young?"},
      {ko:"너 거기 있었어?",en:"Were you there?"},
    ]},
  {pattern_en:"Was he/she + 형용사/명사?",explain_ko:"그 사람 ~였어? — 과거 3인칭",
    examples:[
      {ko:"그녀가 오늘 아침 미팅에 있었어?",en:"Was she at the meeting this morning?"},
      {ko:"그 사람 늦었어?",en:"Was he late?"},
      {ko:"그 선생님 좋았어?",en:"Was the teacher good?"},
    ]},
  {pattern_en:"Were they + 형용사/명사?",explain_ko:"걔네 ~였어? — 과거 복수",
    examples:[
      {ko:"지난 일요일에 가게들 열었었어?",en:"Were the shops open last Sunday?"},
      {ko:"걔네 결혼했었어?",en:"Were they married before?"},
      {ko:"파티에 사람 많았어?",en:"Were there many people at the party?"},
    ]},
  {pattern_en:"Was there / Were there ~?",explain_ko:"~가 있었어? — 과거 존재",
    examples:[
      {ko:"거기 주차장 있었어?",en:"Was there a parking lot there?"},
      {ko:"그 식당에 줄 있었어?",en:"Was there a line at the restaurant?"},
      {ko:"많은 사람들이 있었어?",en:"Were there a lot of people?"},
    ]},
],examples:[],
interview_system:`You are a friendly English coach teaching "Be-verb Past" questions to a Korean adult.
Curriculum:
- Were you / Was he / Was she / Were they / Was it / Was I / Were we / Was there / Were there

RULES:
1. Ask ONE question per turn using be-verb PAST questions
2. After answer: correct was/were mistakes gently in Korean (1-2 sentences)
3. Then ask next question
4. After 10 questions: "정말 잘하셨어요! 🎉" + Korean summary
5. Real Korean adult life situations (yesterday, last week, childhood)

Ask your first question directly. No greetings.`}

,{id:"do-verb-variations",label_ko:"너 이거 들었어? — Do동사 변형",level:"기초",icon_name:"Headphones",
vocab:[
  {en:"Do you",ko:"너 ~해?"},
  {en:"Does he",ko:"그 사람 ~해?"},
  {en:"Does she",ko:"그녀 ~해?"},
  {en:"Did you",ko:"너 ~했어?"},
  {en:"Did he",ko:"그 사람 ~했어?"},
  {en:"Did they",ko:"걔네 ~했어?"},
  {en:"Do they",ko:"걔네 ~해?"},
  {en:"Does it",ko:"그거 ~해?"},
  {en:"Did it",ko:"그거 ~했어?"},
],
patterns:[
  {pattern_en:"Do you / Do they + 동사?",explain_ko:"너/걔네 ~해? — 현재 습관",
    examples:[
      {ko:"너 매일 운동해?",en:"Do you work out every day?"},
      {ko:"걔네 여기 자주 와?",en:"Do they come here often?"},
      {ko:"너 커피 마셔?",en:"Do you drink coffee?"},
    ]},
  {pattern_en:"Does he / Does she + 동사?",explain_ko:"그 사람 ~해? — 3인칭 현재",
    examples:[
      {ko:"그는 이 근처에 살아?",en:"Does he live near here?"},
      {ko:"그녀 한국어 해?",en:"Does she speak Korean?"},
      {ko:"그거 작동해?",en:"Does it work?"},
    ]},
  {pattern_en:"Did you / Did he / Did they + 동사?",explain_ko:"~했어? — 과거",
    examples:[
      {ko:"너 어제 뉴스 봤어?",en:"Did you see the news yesterday?"},
      {ko:"그 사람 전화했어?",en:"Did he call?"},
      {ko:"걔네 왔었어?",en:"Did they show up?"},
    ]},
],examples:[],
interview_system:`You are a friendly English coach teaching "Do-verb Variations" to a Korean adult.
Curriculum:
- Do you / Does he / Does she / Did you / Did he / Did they / Do they / Does it / Did it

RULES:
1. Ask ONE question per turn using do/does/did questions
2. After answer: correct do/does/did subject-verb agreement mistakes in Korean (1-2 sentences)
3. Then ask next question
4. After 10 questions: "정말 잘하셨어요! 🎉" + Korean summary
5. Real daily life situations

Ask your first question directly. No greetings.`}

,{id:"basic-5w1h",label_ko:"너 이거 어디서 샀어? — 기본 5W1H",level:"기초",icon_name:"HelpCircle",
vocab:[
  {en:"Who is",ko:"누가 ~야?"},
  {en:"What do",ko:"뭘 ~해?"},
  {en:"Where did",ko:"어디서 ~했어?"},
  {en:"When will",ko:"언제 ~할 거야?"},
  {en:"Why does",ko:"왜 ~해?"},
  {en:"How can",ko:"어떻게 ~할 수 있어?"},
  {en:"What is",ko:"뭐야?"},
  {en:"Where are",ko:"어디 있어?"},
  {en:"Why did",ko:"왜 ~했어?"},
],
patterns:[
  {pattern_en:"Where did / Where are ~?",explain_ko:"어디서/어디에 — 장소 물어볼 때",
    examples:[
      {ko:"너 지금 어디야?",en:"Where are you right now?"},
      {ko:"그거 어디서 샀어?",en:"Where did you buy that?"},
      {ko:"걔네 어디 갔어?",en:"Where did they go?"},
    ]},
  {pattern_en:"Why do / Why did / Why does ~?",explain_ko:"왜 — 이유 물어볼 때",
    examples:[
      {ko:"너 왜 영어 공부해?",en:"Why do you study English?"},
      {ko:"그 사람 왜 늦었어?",en:"Why was he late?"},
      {ko:"왜 그랬어?",en:"Why did you do that?"},
    ]},
  {pattern_en:"When did / When will ~?",explain_ko:"언제 — 시간 물어볼 때",
    examples:[
      {ko:"너 언제 도착했어?",en:"When did you arrive?"},
      {ko:"언제 올 거야?",en:"When will you come?"},
      {ko:"언제 결혼했어?",en:"When did you get married?"},
    ]},
  {pattern_en:"Who is / What do / How can ~?",explain_ko:"누가/뭘/어떻게 — 기타 WH",
    examples:[
      {ko:"저 사람 누구야?",en:"Who is that person?"},
      {ko:"너 뭐 먹고 싶어?",en:"What do you want to eat?"},
      {ko:"어떻게 하면 돼?",en:"How can I do that?"},
    ]},
],examples:[],
interview_system:`You are a friendly English coach teaching "Basic 5W1H Questions" to a Korean adult.
Curriculum:
- Who is / What do / Where did / When will / Why does / How can / What is / Where are / Why did

RULES:
1. Ask ONE question per turn using 5W1H question words
2. After answer: correct question word usage and word order in Korean (1-2 sentences)
3. Then ask next question
4. After 10 questions: "정말 잘하셨어요! 🎉" + Korean summary

Ask your first question directly. No greetings.`}

,{id:"how-chunks",label_ko:"너 이거 얼마줬어? — How 덩어리",level:"중급",icon_name:"BarChart",
vocab:[
  {en:"How long",ko:"얼마나 오래?"},
  {en:"How many",ko:"몇 개/명?"},
  {en:"How much",ko:"얼마나? / 얼마?"},
  {en:"How fast",ko:"얼마나 빨리?"},
  {en:"How quickly",ko:"얼마나 빠르게?"},
  {en:"How often",ko:"얼마나 자주?"},
  {en:"How old",ko:"몇 살? / 얼마나 됐어?"},
  {en:"How far",ko:"얼마나 멀어?"},
  {en:"How tall",ko:"키가 얼마나?"},
],
patterns:[
  {pattern_en:"How many / How much ~?",explain_ko:"수량·금액 물어볼 때",
    examples:[
      {ko:"너 책 몇 권 읽었어?",en:"How many books did you read?"},
      {ko:"우리 시간 얼마나 남았어?",en:"How much time do we have left?"},
      {ko:"아이가 몇 명이야?",en:"How many kids do you have?"},
    ]},
  {pattern_en:"How long / How often / How old ~?",explain_ko:"기간·빈도·나이 물어볼 때",
    examples:[
      {ko:"말레이시아에 얼마나 됐어?",en:"How long have you been here?"},
      {ko:"그녀는 너를 얼마나 자주 만나러 와?",en:"How often does she visit you?"},
      {ko:"그 집 얼마나 됐어?",en:"How old is that house?"},
    ]},
  {pattern_en:"How far / How fast / How tall ~?",explain_ko:"거리·속도·높이 물어볼 때",
    examples:[
      {ko:"여기서 시내까지 얼마나 멀어?",en:"How far is it from here to the city?"},
      {ko:"그 사람 키가 얼마나 돼?",en:"How tall is he?"},
      {ko:"얼마나 빨리 도착할 수 있어?",en:"How quickly can you get here?"},
    ]},
],examples:[],
interview_system:`You are a friendly English coach teaching "How Chunks" to a Korean adult.
Curriculum:
- How long / How many / How much / How fast / How quickly / How often / How old / How far / How tall

RULES:
1. Ask ONE question per turn using How chunks
2. After answer: correct How chunk usage in Korean (1-2 sentences)
3. Then ask next question
4. After 10 questions: "정말 잘하셨어요! 🎉" + Korean summary
5. Real Korean adult life (here, family, shopping, travel)

Ask your first question directly. No greetings.`}

,{id:"which-chunks",label_ko:"어떤게 내꺼야? — Which 덩어리",level:"중급",icon_name:"Layers",
vocab:[
  {en:"Which one",ko:"어떤 거? / 어느 게?"},
  {en:"Which color",ko:"어떤 색?"},
  {en:"Which size",ko:"어떤 사이즈?"},
  {en:"Which class",ko:"어떤 반?"},
  {en:"Which course",ko:"어떤 코스?"},
  {en:"Which team",ko:"어떤 팀?"},
  {en:"Which way",ko:"어느 쪽으로?"},
  {en:"Which bus",ko:"몇 번 버스?"},
  {en:"Which day",ko:"어느 날?"},
],
patterns:[
  {pattern_en:"Which one / Which color / Which size ~?",explain_ko:"선택지 중에 어느 것? — 쇼핑·선택할 때",
    examples:[
      {ko:"어느 게 네 코트야?",en:"Which one is your coat?"},
      {ko:"어느 사이즈로 입어보고 싶어?",en:"Which size do you want to try on?"},
      {ko:"어떤 색이 더 좋아?",en:"Which color do you prefer?"},
    ]},
  {pattern_en:"Which day / Which way / Which bus ~?",explain_ko:"날짜·방향·교통 선택할 때",
    examples:[
      {ko:"그 사람한테는 어느 요일이 제일 좋아?",en:"Which day works best for him?"},
      {ko:"어느 쪽으로 가야 해?",en:"Which way should I go?"},
      {ko:"몇 번 버스가 시내로 가?",en:"Which bus goes to the city center?"},
    ]},
  {pattern_en:"Which class / Which course / Which team ~?",explain_ko:"수업·팀 선택할 때",
    examples:[
      {ko:"어떤 반에 들어갈 거야?",en:"Which class are you joining?"},
      {ko:"어떤 코스 선택했어?",en:"Which course did you choose?"},
      {ko:"어떤 팀 응원해?",en:"Which team do you support?"},
    ]},
],examples:[],
interview_system:`You are a friendly English coach teaching "Which Chunks" to a Korean adult.
Curriculum:
- Which one / Which color / Which size / Which class / Which course / Which team / Which way / Which bus / Which day

RULES:
1. Ask ONE question per turn using Which chunks naturally
2. After answer: correct Which usage in Korean (1-2 sentences)
3. Then ask next question
4. After 10 questions: "정말 잘하셨어요! 🎉" + Korean summary
5. Real situations: shopping, school, travel, daily choices

Ask your first question directly. No greetings.`}

,{id:"expression",label:"표현"},{id:"collocation",label:"콜로케이션"}
,{id:"used-to-past",label_ko:"여기 한식당이었어 — used to",level:"중급",icon_name:"Clock",
vocab:[
  {en:"used to + 동사",ko:"예전에 ~하곤 했어 (지금은 아님)"},
  {en:"live here",ko:"여기 살다"},
  {en:"smoke",ko:"담배 피우다"},
  {en:"have long hair",ko:"긴 머리였다"},
  {en:"work out",ko:"운동하다"},
  {en:"be shy",ko:"수줍음이 많다"},
  {en:"go to the beach",ko:"해변에 가다"},
  {en:"play piano",ko:"피아노를 치다"},
  {en:"date",ko:"사귀다"},
  {en:"hate vegetables",ko:"채소를 싫어하다"},
],
patterns:[
  {pattern_en:"I used to + 동사원형.",explain_ko:"예전에 ~하곤 했어 — 지금은 안 해",examples:[
    {ko:"나는 예전에 여기 살았었어.",en:"I used to live here."},
    {ko:"그녀는 예전에 긴 머리였어.",en:"She used to have long hair."},
    {ko:"그들은 예전에 매일 운동하곤 했어.",en:"They used to work out every day."},
  ]},
  {pattern_en:"I didn't use to + 동사원형.",explain_ko:"예전엔 ~하지 않았어 (did 뒤엔 use to — d 빼!)",examples:[
    {ko:"나 예전엔 커피 안 좋아했었는데, 지금은 정말 좋아해.",en:"I didn't use to like coffee, but now I love it."},
    {ko:"그는 예전에 운동을 전혀 안 했었는데, 지금은 매일 해.",en:"He didn't use to work out, but he exercises every day now."},
    {ko:"그들은 예전에 사이가 안 좋았었는데, 지금은 단짝이야.",en:"They didn't use to get along, but now they are best friends."},
  ]},
  {pattern_en:"Did you use to + 동사원형?",explain_ko:"예전에 ~했었어? (의문문도 use to!)",examples:[
    {ko:"너 예전에 담배 피웠었어?",en:"Did you use to smoke?"},
    {ko:"그녀가 예전에 서울에 살았었니?",en:"Did she use to live in Seoul?"},
    {ko:"그 둘이 예전에 사귀었던 사이야?",en:"Did they use to date each other?"},
  ]},
],
examples:[],
expressions:[
  {en:"I used to live here.",ko:"나는 예전에 여기 살았었어."},
  {en:"She used to have long hair.",ko:"그녀는 예전에 긴 머리였어."},
  {en:"They used to work out every day.",ko:"그들은 예전에 매일 운동하곤 했어."},
  {en:"I didn't use to like coffee, but now I love it.",ko:"나 예전엔 커피 안 좋아했었는데, 지금은 정말 좋아해."},
  {en:"He didn't use to work out, but he exercises every day now.",ko:"그는 예전에 운동을 전혀 안 했었는데, 지금은 매일 해."},
  {en:"Did you use to smoke?",ko:"너 예전에 담배 피웠었어?"},
  {en:"Did she use to live in Seoul?",ko:"그녀가 예전에 서울에 살았었니?"},
  {en:"Did they use to date each other?",ko:"그 둘이 예전에 사귀었던 사이야?"},
  {en:"I used to be shy.",ko:"나 예전에 수줍음이 많았었어."},
  {en:"We used to go to the beach every summer.",ko:"우리 예전에 매여름 해변에 가곤 했어."},
],
interview_system:`You are an English coach teaching "used to + verb" for past habits.
Ask questions that require the learner to use "used to" naturally.
Correct these mistakes immediately in Korean:
- "used to" in negative/question → must be "use to" (no d)
- Wrong tense or verb form after used to
10 questions, then wrap up in Korean. Ask first question directly.`}


,{id:"be-used-to",label_ko:"나 이 날씨에 익숙해졌어 — be used to",level:"중급",icon_name:"Sun",
vocab:[
  {en:"be used to + 명사/ing",ko:"~에 익숙해 (현재 상태)"},
  {en:"the cold weather",ko:"추운 날씨"},
  {en:"waking up early",ko:"일찍 일어나기"},
  {en:"driving on the left",ko:"좌측 운전"},
  {en:"spicy food",ko:"매운 음식"},
  {en:"working under pressure",ko:"압박 속 일하기"},
  {en:"living alone",ko:"혼자 살기"},
  {en:"the traffic",ko:"교통체증"},
  {en:"using this software",ko:"이 소프트웨어 쓰기"},
  {en:"criticism",ko:"비판"},
],
patterns:[
  {pattern_en:"I am used to + 명사/동사-ing.",explain_ko:"~에 익숙해 (to 뒤엔 동사원형❌ → 명사/ing✅)",examples:[
    {ko:"나는 추운 날씨에 익숙해.",en:"I am used to the cold weather."},
    {ko:"그는 일찍 일어나는 것에 익숙해.",en:"He is used to waking up early."},
    {ko:"우리는 좌측 운전에 익숙해.",en:"We are used to driving on the left."},
  ]},
  {pattern_en:"I am not used to + 명사/동사-ing.",explain_ko:"아직 ~에 익숙하지 않아",examples:[
    {ko:"난 아직 혼자 사는 것에 익숙하지 않아.",en:"I am not used to living alone yet."},
    {ko:"그녀는 압박감 속에서 일하는 것에 익숙하지 않아.",en:"She is not used to working under pressure."},
    {ko:"우리는 이런 추운 날씨에 익숙하지 않아.",en:"We are not used to this cold weather."},
  ]},
  {pattern_en:"Are you used to + 명사/동사-ing?",explain_ko:"~에 익숙해?",examples:[
    {ko:"너 여기 소음에 익숙하니?",en:"Are you used to the noise here?"},
    {ko:"그는 일찍 일어나는 것에 익숙하대?",en:"Is he used to waking up early?"},
    {ko:"그들은 이 새 소프트웨어를 쓰는 것에 익숙하대?",en:"Are they used to using this new software?"},
  ]},
],
examples:[],
expressions:[
  {en:"I am used to the cold weather.",ko:"나는 추운 날씨에 익숙해."},
  {en:"He is used to waking up early.",ko:"그는 일찍 일어나는 것에 익숙해."},
  {en:"We are used to driving on the left.",ko:"우리는 좌측 운전에 익숙해."},
  {en:"I am not used to living alone yet.",ko:"난 아직 혼자 사는 것에 익숙하지 않아."},
  {en:"She is not used to working under pressure.",ko:"그녀는 압박감 속에서 일하는 것에 익숙하지 않아."},
  {en:"Are you used to the noise here?",ko:"너 여기 소음에 익숙하니?"},
  {en:"Is he used to waking up early?",ko:"그는 일찍 일어나는 것에 익숙하대?"},
  {en:"Are they used to using this new software?",ko:"그들은 이 새 소프트웨어를 쓰는 것에 익숙하대?"},
  {en:"I am used to spicy food.",ko:"나는 매운 음식에 익숙해."},
  {en:"We are not used to this cold weather.",ko:"우리는 이런 추운 날씨에 익숙하지 않아."},
],
interview_system:`You are an English coach teaching "be used to + noun/verb-ing" for current familiarity.
Ask questions requiring "be used to" naturally.
Correct these mistakes immediately in Korean:
- "be used to + verb base form" → WRONG, must be noun or verb-ing
- Confusing with "get used to" (process vs state)
10 questions, then wrap up in Korean. Ask first question directly.`}


,{id:"get-used-to",label_ko:"넌 익숙해져야 해 — get used to",level:"중급",icon_name:"TrendingUp",
vocab:[
  {en:"get used to + 명사/ing",ko:"~에 익숙해지다 (과정)"},
  {en:"the new job",ko:"새 직장"},
  {en:"speaking English",ko:"영어로 말하기"},
  {en:"wearing glasses",ko:"안경 쓰기"},
  {en:"the time difference",ko:"시차"},
  {en:"working from home",ko:"재택근무"},
  {en:"the food here",ko:"여기 음식"},
  {en:"using a Mac",ko:"맥 쓰기"},
  {en:"being a parent",ko:"부모가 되는 것"},
  {en:"the heat",ko:"더위"},
],
patterns:[
  {pattern_en:"I am getting used to + 명사/동사-ing.",explain_ko:"~에 적응해 가고 있어 (진행 중)",examples:[
    {ko:"나는 새 직장에 적응해 가고 있어.",en:"I am getting used to the new job."},
    {ko:"그녀는 영어로 말하는 것에 익숙해졌어.",en:"She got used to speaking English."},
    {ko:"그들은 곧 그 라이프스타일에 익숙해질 거야.",en:"They will get used to the lifestyle soon."},
  ]},
  {pattern_en:"I can't get used to + 명사/동사-ing.",explain_ko:"도무지 ~에 익숙해지지 않아",examples:[
    {ko:"난 안경 쓰는 것에 도무지 익숙해지지가 않아.",en:"I can't get used to wearing glasses."},
    {ko:"그는 여기 매운 음식에 결국 익숙해지지 못했어.",en:"He didn't get used to the spicy food here."},
    {ko:"그들은 시차에 도저히 적응하지 못했어.",en:"They couldn't get used to the time difference."},
  ]},
  {pattern_en:"Did you get used to + 명사/동사-ing?",explain_ko:"~에 적응됐어?",examples:[
    {ko:"너 새 직장에 좀 적응됐어?",en:"Did you get used to the new job?"},
    {ko:"그녀는 좌측 운전에 좀 익숙해지고 있대?",en:"Is she getting used to driving on the left?"},
    {ko:"그들이 그 라이프스타일에 곧 익숙해질 수 있을까?",en:"Will they get used to the lifestyle soon?"},
  ]},
],
examples:[],
expressions:[
  {en:"I am getting used to the new job.",ko:"나는 새 직장에 적응해 가고 있어."},
  {en:"She got used to speaking English.",ko:"그녀는 영어로 말하는 것에 익숙해졌어."},
  {en:"They will get used to the lifestyle soon.",ko:"그들은 곧 그 라이프스타일에 익숙해질 거야."},
  {en:"I can't get used to wearing glasses.",ko:"난 안경 쓰는 것에 도무지 익숙해지지가 않아."},
  {en:"He didn't get used to the spicy food here.",ko:"그는 여기 매운 음식에 결국 익숙해지지 못했어."},
  {en:"They couldn't get used to the time difference.",ko:"그들은 시차에 도저히 적응하지 못했어."},
  {en:"Did you get used to the new job?",ko:"너 새 직장에 좀 적응됐어?"},
  {en:"Is she getting used to driving on the left?",ko:"그녀는 좌측 운전에 좀 익숙해지고 있대?"},
  {en:"Will they get used to the lifestyle soon?",ko:"그들이 그 라이프스타일에 곧 익숙해질 수 있을까?"},
  {en:"You will get used to it.",ko:"너도 곧 익숙해질 거야."},
],
interview_system:`You are an English coach teaching "get used to + noun/verb-ing" for the process of adapting.
Ask questions requiring "get used to" naturally.
Correct these mistakes immediately in Korean:
- "get used to + verb base form" → WRONG, must be noun or verb-ing
- Confusing with "be used to" (state vs process)
10 questions, then wrap up in Korean. Ask first question directly.`}

];

const SPEAKING_ICON_MAP = {
  MessageSquare, Sparkles, CalendarClock, MapPin, BookOpen, Zap,
  Target, Lightbulb, Layers, Compass, History, Users, Clock, Scale, Type, Loader2,
};

// Existing intermediate topics from PPT v_intermediate
const LISTENING_DB = {
  1: [
    {ko:"넌 안 늦었어.", en:"You are not late."},
    {ko:"나 늦었어?", en:"Am I late?"},
    {ko:"너 5분 늦었어.", en:"You are 5 minutes late."},
    {ko:"이것을 영어로 어떻게 말해요?", en:"How do you say this in English?"},
    {ko:"누구 나오는데?", en:"Who stars in it?"},
    {ko:"영화 제목이 뭐라고?", en:"What is the movie called?"},
    {ko:"스펠링이 어떻게 되?", en:"How do you spell it?"},
    {ko:"돈은 나무에서 자라지 않아.", en:"Money does not grow on trees."},
    {ko:"레스토랑 이름이 뭐라고?", en:"What is the name of the restaurant?"},
    {ko:"너 여기 왜 왔니?", en:"What brings you here?"},
    {ko:"너 어디가?", en:"Where are you going?"},
    {ko:"대체 어디 가는거야?", en:"Where on earth are you going?"},
    {ko:"언제 멈춰야 하는지 말해줘.", en:"Tell me when to stop."},
    {ko:"나 완전 공감해.", en:"I totally relate."},
    {ko:"얼마였어?", en:"How much was it?"},
    {ko:"어떤 브랜드 샀어?", en:"What brand did you buy?"},
    {ko:"비쌌어?", en:"Was it expensive?"},
    {ko:"나 어때 보여?", en:"How do I look?"},
    {ko:"저 여자는 몇살이야?", en:"How old is she?"},
    {ko:"무섭지 않았어?", en:"Was it not scary?"},
    {ko:"난 그거 관심 없어요.", en:"I am not interested in that."},
    {ko:"너 어제 피곤했어.", en:"You looked tired yesterday."},
    {ko:"그녀는 화 날꺼야.", en:"She is going to be mad."},
    {ko:"그녀는 걱정하고 있니?", en:"Is she worried?"},
    {ko:"난 걱정 안 해.", en:"I am not worried."},
  
    {ko:"불안해 하지마.", en:"Don't be anxious."},
    {ko:"너 떨려?", en:"Are you nervous?"},
    {ko:"너 짜증나 보인다.", en:"You look annoyed."},
    {ko:"너 놀랐어?", en:"Were you surprised?"},
    {ko:"그녀는 불안정해.", en:"She is emotionally unstable."},
    {ko:"전혀 감명받지 않았어요.", en:"I was not impressed at all."},
    {ko:"넌 감명받을 꺼에요.", en:"You are going to be impressed."},
    {ko:"차를 가지면 편리해요?", en:"Is it convenient to have a car?"},
    {ko:"말레이시아에 사는건 지루해요?", en:"Is it boring to live here?"},
    {ko:"그는 말이 많아?", en:"Is he talkative?"},

    {ko:"넌 집에 있는걸 더 좋아하니?", en:"Do you prefer staying at home?"},
    {ko:"너는 다음달에 무슨 계획이 있니?", en:"What are your plans for next month?"},
    {ko:"넌 더 큰 차를 찾고있는 중이니?", en:"Are you looking for a bigger car?"},
    {ko:"점점 어두워진다.", en:"It is getting darker."},
    {ko:"점점 매워지는데.", en:"It is getting spicier and spicier."},
    {ko:"여기 모든게 다 싸다.", en:"Everything is so cheap here."},

    {ko:"아무 카드도 안되.", en:"None of the cards are working."},
    {ko:"교통체증이 있을 거야.", en:"There is going to be traffic."},
    {ko:"이거 비싸지 않았어?", en:"Was not this expensive?"},
    {ko:"얼마나 걸렸어?", en:"How long did it take?"},
    {ko:"주로 30분 걸려.", en:"It usually takes about 30 minutes."},
    {ko:"여기에는 주차하기가 힘들어.", en:"It is hard to park here."},
    {ko:"여기 주차 해본 적 있어?", en:"Have you ever parked here before?"},
  

    {ko:"이거 맛 어때?", en:"How does this taste?"},
    {ko:"그는 얼마나 작아?", en:"How short is he?"},
    {ko:"이것들은 얼마에요?", en:"How much are these?"},
    {ko:"어떤 것 사고 싶어?", en:"Which one do you want to buy?"},
    {ko:"어디 가고 싶어?", en:"Where do you want to go?"},
    {ko:"뭘 먹고 싶어?", en:"What do you want to eat?"},
    {ko:"쟤네들은 몇 살이야?", en:"How old are they?"},
    {ko:"저 여자는 어때?", en:"What is she like?"},
    {ko:"누가 아이스크림 먹고 싶어?", en:"Who wants ice cream?"},
    {ko:"짜장면은 주로 어디에서 먹어?", en:"Where do you usually eat Jajangmyeon?"},

    {ko:"왜 이렇게 냄새 안 좋아?", en:"Why does it smell so bad?"},
    {ko:"무엇을 알고싶은거야?", en:"What are you looking for?"},
  

    {ko:"고마워요. 머리 잘랐어요.", en:"Thanks. I cut my hair."},

    {ko:"난 아마 안 갈래요.", en:"I probably won't go."},
    {ko:"여기에 분실물 센터 있나요?", en:"Is there a lost and found here?"},



    {ko:"취룡 너무 맛있지 않니?", en:"Isn't Churyong so delicious?"},
    {ko:"너무 짜.", en:"It is too salty."},
    {ko:"짜장면 안 좋아하는 사람이 어딨어.", en:"Who doesn't like Jajangmyeon?"},
  
    {ko:"맛이 어때?", en:"How does it taste?"},
    {ko:"여행 어땠어?", en:"How was the trip?"},
    {ko:"무섭다.", en:"That is scary."},
  
    {ko:'Fast 가 무슨뜻이야?', en:'What does "fast" mean?'},
  
    {ko:"누구 나오는데?", en:"Who is in it?"},
    {ko:"Departure야.", en:"It is Departure."},
  
    {ko:"너 어디야?", en:"Where are you?"},
    {ko:"나 집에 있어.", en:"I am at home."},
    {ko:"뭐 하고 있어?", en:"What are you doing?"},
    {ko:"나 밥 먹고 있어.", en:"I am eating."},
    {ko:"피곤해?", en:"Are you tired?"},
    {ko:"응 너무 피곤해.", en:"Yes I am so tired."},
    {ko:"배고파?", en:"Are you hungry?"},
    {ko:"조금.", en:"A little bit."},
    {ko:"오늘 날씨 어때?", en:"How is the weather today?"},
    {ko:"오늘 너무 더워.", en:"It is so hot today."},
    {ko:"커피 마실래?", en:"Do you want some coffee?"},
    {ko:"응 좋아.", en:"Yes please."},
    {ko:"이거 얼마야?", en:"How much is this?"},
    {ko:"너 몇 살이야?", en:"How old are you?"},
    {ko:"나 35살이야.", en:"I am 35."},
    {ko:"너 어느 나라 사람이야?", en:"Where are you from?"},
    {ko:"나 한국 사람이야.", en:"I am from Korea."},
    {ko:"영어 할 수 있어?", en:"Can you speak English?"},
    {ko:"조금 할 수 있어.", en:"I can speak a little."},
    {ko:"화장실 어디야?", en:"Where is the bathroom?"},


    {ko:"계산서 주세요.", en:"Can I have the bill please."},
    {ko:"카드 되요?", en:"Do you accept cards?"},
    {ko:"맛있어요.", en:"It is delicious."},
    {ko:"너무 매워요.", en:"It is too spicy."},
    {ko:"이거 뭐예요?", en:"What is this?"},
    {ko:"잠깐만요.", en:"Just a moment please."},
    {ko:"괜찮아요?", en:"Are you okay?"},
    {ko:"도움 필요해요?", en:"Do you need help?"},
  
    {ko:"나 집에 있어.", en:"I am home."},
    {ko:"나 지금 바빠.", en:"I am busy right now."},
    {ko:"나 배고파.", en:"I am hungry."},
    {ko:"나 피곤해.", en:"I am tired."},
    {ko:"나 졸려.", en:"I am sleepy."},
    {ko:"나 심심해.", en:"I am bored."},
    {ko:"나 행복해.", en:"I am happy."},
    {ko:"나 화났어.", en:"I am angry."},
    {ko:"나 슬퍼.", en:"I am sad."},
    {ko:"날씨 좋다.", en:"The weather is nice."},
    {ko:"비 와.", en:"It is raining."},
    {ko:"춥다.", en:"It is cold."},
    {ko:"덥다.", en:"It is hot."},
    {ko:"맛있어.", en:"It is delicious."},
    {ko:"맛없어.", en:"It is not good."},
    {ko:"비싸.", en:"It is expensive."},
    {ko:"싸.", en:"It is cheap."},
    {ko:"예뻐.", en:"It is pretty."},
    {ko:"커.", en:"It is big."},
    {ko:"작아.", en:"It is small."},
    {ko:"빨라.", en:"It is fast."},
    {ko:"느려.", en:"It is slow."},
    {ko:"쉬워.", en:"It is easy."},
    {ko:"어려워.", en:"It is difficult."},
    {ko:"재밌어.", en:"It is fun."},
    {ko:"지루해.", en:"It is boring."},
    {ko:"무서워.", en:"It is scary."},
    {ko:"위험해.", en:"It is dangerous."},
    {ko:"괜찮아.", en:"It is okay."},
    {ko:"좋아.", en:"It is good."},
    {ko:"나빠.", en:"It is bad."},
    {ko:"맞아.", en:"That is right."},
    {ko:"틀려.", en:"That is wrong."},

    {ko:"이게 뭐야?", en:"What is this?"},
    {ko:"저게 뭐야?", en:"What is that?"},

    {ko:"몇 층이야?", en:"What floor is it?"},
    {ko:"몇 번이야?", en:"What number is it?"},
    {ko:"여기야.", en:"It is here."},
    {ko:"저기야.", en:"It is over there."},
    {ko:"이쪽이야.", en:"It is this way."},
    {ko:"저쪽이야.", en:"It is that way."},
    {ko:"왼쪽이야.", en:"It is on the left."},
    {ko:"오른쪽이야.", en:"It is on the right."},
    {ko:"위야.", en:"It is on top."},
    {ko:"아래야.", en:"It is below."},
    {ko:"안이야.", en:"It is inside."},
    {ko:"밖이야.", en:"It is outside."},
    {ko:"앞이야.", en:"It is in front."},
    {ko:"뒤야.", en:"It is in the back."},
    {ko:"옆이야.", en:"It is next to it."},
    {ko:"가까워.", en:"It is close."},
    {ko:"멀어.", en:"It is far."},
    {ko:"나 왔어.", en:"I am here."},
    {ko:"나 갈게.", en:"I am leaving."},
    {ko:"나 왔다 갈게.", en:"I will stop by."},
    {ko:"이따 봐.", en:"See you later."},
    {ko:"내일 봐.", en:"See you tomorrow."},
    {ko:"잘 자.", en:"Good night."},
    {ko:"잘 잤어?", en:"Did you sleep well?"},
    {ko:"밥 먹었어?", en:"Did you eat?"},
    {ko:"뭐 먹었어?", en:"What did you eat?"},
    {ko:"맛있었어?", en:"Was it good?"},
    {ko:"어디 가?", en:"Where are you going?"},
    {ko:"뭐 해?", en:"What are you doing?"},
    {ko:"뭐 봐?", en:"What are you watching?"},
    {ko:"뭐 들어?", en:"What are you listening to?"},
    {ko:"뭐 읽어?", en:"What are you reading?"},
    {ko:"재밌어?", en:"Is it fun?"},
    {ko:"어때?", en:"How is it?"},
    {ko:"좋아해?", en:"Do you like it?"},
    {ko:"알아?", en:"Do you know?"},
    {ko:"이해했어?", en:"Do you understand?"},
  ],
  2: [
    {ko:"한국은 4계절이 있어요.", en:"There are four seasons in Korea."},
    {ko:"그 말은 너무 못됬는데.", en:"That was mean."},
    {ko:"다음주에 나랑 쇼핑갈래?", en:"Do you want to go shopping with me next week?"},
    {ko:"화요일이 괜찮겠어요?", en:"Does Tuesday work for you?"},
    {ko:"돈 다 사용했어. 버스카드 충전해야해.", en:"I am all out of money. I need to top up my transit card."},
    {ko:"그것들은 완전 똑같지는 않아.", en:"They are not exactly the same."},
    {ko:"나 숙제 다하면 TV 볼꺼야.", en:"I will watch TV after I finish my homework."},
    {ko:"어떤 느낌인가요?", en:"What does it feel like?"},
    {ko:"언제 시작 됐나요?", en:"When did it start?"},
    {ko:"이름과 생년월일 말씀해주세요.", en:"Can I get your name and date of birth, please?"},
    {ko:"증상이 좀 나아졌어?", en:"Are your symptoms getting any better?"},
    {ko:"나 요새 목이 욱신거려.", en:"My throat has been throbbing lately."},
    {ko:"가장 가까운 ATM이 어디있나요?", en:"Where is the nearest ATM?"},
    {ko:"걸어서 10분 걸려요.", en:"It takes 10 minutes on foot."},
    {ko:"한국은 말레이시아보다 한시간 빨라.", en:"Korea is an hour ahead of here."},
    {ko:"말레이시아는 한국보다 한시간 느려.", en:"it is an hour behind Korea."},
    {ko:"넌 일찍 오지 않았어.", en:"You did not get here early."},
    {ko:"나 다음에는 시간 딱 맞춰 올께.", en:"I will be on time next time."},
    {ko:"한국 지금 몇시야?", en:"What time is it in Korea right now?"},
    {ko:"나 시차적응 중이야.", en:"I am still adjusting to the time difference."},
    {ko:"블랙박스 있어요?", en:"Do you have a dashcam?"},
    {ko:"왜 깜빡이를 안 켰어요?", en:"Why did not you use your turn signal?"},
    {ko:"다행히도 아무도 안 다쳤어요.", en:"Fortunately, nobody was hurt."},
    {ko:"저녁에 유튜브 시청하는것은 재밌어.", en:"Watching YouTube in the evening is fun."},
    {ko:"너는 TV 보는 것을 그만 해야해.", en:"You need to stop watching TV."},
    {ko:"자야마트는 비싼 편이지.", en:"Jaya Grocer is on the pricier side."},
    {ko:"뭐 하고 싶은 것 있어?", en:"Is there anything you would like to do?"},
    {ko:"너는 15분 산책을 매일 해야해.", en:"You should go for a 15-minute walk every day."},
    {ko:"너는 비타민 C를 매일 먹어야 해.", en:"You need to take Vitamin C daily."},
    {ko:"너는 목요일에 노랑색 티셔츠를 입고와야해.", en:"You are supposed to wear a yellow shirt on Thursday."},
    {ko:"너는 적어도 1리터의 물을 마셔야 해.", en:"You need to drink at least a liter of water a day."},
    {ko:"나는 여기 책을 빌리러 왔어요.", en:"I am here to borrow some books."},
    {ko:"나 오늘 뭔가 매운 것 먹고 싶은 기분이야.", en:"I am in the mood for something spicy today."},
    {ko:"어디에서 샀어?", en:"Where did you buy it?"},
    {ko:"난 항상 내 집이 깨끗해야해.", en:"I always need my house to be spotless."},
    {ko:"난 부정적인 사람이 싫어.", en:"I cannot stand negative people."},
    {ko:"영어 배우는 것에 관심 있으세요?", en:"Are you interested in learning English?"},
    {ko:"나 어제 너무 피곤했어.", en:"I was completely exhausted yesterday."},
    {ko:"어제는 정말 피곤한 하루였어.", en:"Yesterday was such a tiring day."},
    {ko:"우리 아들은 신나 있어요.", en:"My son is so excited."},
    {ko:"우리집 뷰는 정말 놀라워.", en:"The view from my place is absolutely amazing."},
    {ko:"한국드라마는 지루하지 않아.", en:"Korean dramas are never boring."},
    {ko:"난 12월에 한국 갈꺼야.", en:"I am heading to Korea in December."},
  
    {ko:"난 부정적인 사람이 싫어.", en:"I cannot stand negative people."},
    {ko:"너 거기가면 실망할꺼야.", en:"You are gonna be disappointed if you go there."},
    {ko:"난 차 렌트하는건 관심없어.", en:"I am not interested in renting a car."},
    {ko:"너무 불안해 결과를 듣는건.", en:"I am so anxious about hearing the results."},
    {ko:"나 너무 떨려 진실을 얘기하는 것은.", en:"I am so nervous about telling the truth."},
    {ko:"너무 짜증나 비번 찾는건.", en:"It is so annoying trying to find my password."},
    {ko:"나의 숙제를 보고 감명을 받았나요?", en:"Were you impressed by my homework?"},
    {ko:"너 아마 디파짓 돌려받지 못할 수도 있어.", en:"You might not get your deposit back."},
    {ko:"차를 가지면 편리해요.", en:"Having a car is really convenient."},
    {ko:"말레이시아에 사는것 지루하지 않아요.", en:"Living here is not boring at all."},
    {ko:"새로운 친구들을 만나는건 재미있어요.", en:"Meeting new friends is always fun."},
    {ko:"말레이시아에 사는것은 싸지 않아요.", en:"Living here is not cheap."},
    {ko:"버스타는것 꽤 빨라.", en:"Taking the bus is pretty fast."},
    {ko:"가장 빨리 페낭까지 가는 방법이 뭐야?", en:"What is the fastest way to get to another city?"},
    {ko:"우리는 같이 페낭에 가자고 결정했어요.", en:"We decided to go to another city together."},
    {ko:"나는 피아노를 어떻게 치는지 배우고 싶어요.", en:"I want to learn how to play the piano."},
    {ko:"난 디카페인 커피 마시는걸 선호해요.", en:"I prefer to drink decaf coffee."},
    {ko:"영미는 다음달에 뉴질랜드 가는 계획이 있어.", en:"Youngmi plans to go to New Zealand next month."},
    {ko:"그가 너에게 일찍 오라고 했니?", en:"Did he ask you to come early?"},
    {ko:"우리딸은 나만큼 커.", en:"My daughter is as tall as me."},
    {ko:"싸면 쌀 수록 좋지.", en:"The cheaper the better."},
    {ko:"내 친구들 중 몇몇은 이혼했어.", en:"A few of my friends are divorced."},
    {ko:"난 저것의 반만 필요해.", en:"I only need half of that."},
    {ko:"누가 케찹을 뒤집어 놨어?", en:"Who put the ketchup upside down?"},
    {ko:"아이폰이 갤럭시보다 더 비싸.", en:"The iPhone is more expensive than the Galaxy."},
    {ko:"주로 30분 이상걸려.", en:"It usually takes more than 30 minutes."},
    {ko:"나 너의 차 옆에다 주차했어.", en:"I parked right next to your car."},
    {ko:"나 여기 주차 한 번 해본 적 있어.", en:"I have parked here once before."},
  
    {ko:"내 핸드폰 봤어? 내가 테이블 위에 두었는데.", en:"Have you seen my phone? I left it on the table."},
    {ko:"테이블위에 아무것도 없었는데. 내 생각에는 식물 옆에서 본 거 같은데.", en:"There was nothing on the table. I think I saw it next to the plant."},
    {ko:"너 커피숍 앞에 주차 했어?", en:"Did you park in front of the coffee shop?"},
    {ko:"아니 밀베이커리 뒤에 주차 했어. 난 주로 밀베이커리 뒤에 주차해.", en:"No, I parked behind Mill Bakery. I usually park there."},
    {ko:"밀베이커리 뒤에는 많은 주차공간이 있니?", en:"Is there a lot of parking behind Mill Bakery?"},
    {ko:"항상 1-2 자리는 있어.", en:"There is always a spot or two."},
    {ko:"나 피곤해 보여?", en:"Do I look tired?"},
    {ko:"너 피곤해 보이지 않아.", en:"You don't look tired at all."},
    {ko:"나 어제 4시간 밖에 못잤어.", en:"I only slept for four hours last night."},
    {ko:"너 낮잠좀 자야겠다.", en:"You should take a nap."},
    {ko:"잘 지냈어?", en:"How have you been?"},
    {ko:"나 너무 바쁘게 지냈어. 넌?", en:"I have been so busy. How about you?"},
    {ko:"그냥 지냈어. 막 신나는건 없었어, 물어봐줘서 고마워.", en:"Just getting by. Nothing exciting, but thanks for asking."},
    {ko:"오늘밤에 무엇을 입을지 결정했어?", en:"Have you decided what to wear tonight?"},
    {ko:"무엇을 입어야 할지 모르겠어. 너 이따가 같이 TRX 갈래?", en:"I have no idea what to wear. Do you want to go to TRX together later?"},
    {ko:"그냥 지냈어, 별로 신나는것은 없었어. 넌?", en:"Just getting by, nothing exciting. You?"},
    {ko:"난 너무 바빴어. 물어봐줘서 고마워.", en:"I have been buried in work. Thanks for asking."},
    {ko:"데사파크로 이사간지 얼마나 됬어요?", en:"How long has it been since you moved to Desa Park City?"},
    {ko:"한 달 됬어요.", en:"It has been a month."},
    {ko:"너의 아이들도 새로운 집을 좋아해요?", en:"Do your kids like the new place?"},
    {ko:"네 좋아해요. 왜냐하면 더 커지고, 더 새거잖아요.", en:"Yeah they love it. It is bigger and brand-new."},
    {ko:"콘도 얼마나 됬어요?", en:"How old is the condo?"},
    {ko:"2년 안됬어요. 거의 새거에요.", en:"It is less than two years old. It is pretty much brand-new."},
    {ko:"좋게 들려요. 내가 다음에 놀러갈께요.", en:"Sounds great. I will visit you next time."},
  
    {ko:"머리 잘랐어요? 오늘 달라 보여요.", en:"Did you get a haircut? You look different today."},
    {ko:"감사합니다. 저 머리 잘랐어요.", en:"Thank you. I got my hair cut."},
    {ko:"인터내셔널 데이 참석하나요?", en:"Are you attending the International Day?"},
    {ko:"우리 필수 참석인가요?", en:"Is it mandatory for us to go?"},
    {ko:"참석해야 하는지 잘 모르겠어요.", en:"I am not sure if attendance is required."},
    {ko:"전 빠질 것 같아요.", en:"I think I will skip it."},
    {ko:"오랜만이야. 오랫동안 못 봤어.", en:"Long time no see. I haven't seen you for a long time."},
    {ko:"나 가디언 비자 갱신하느라 너무 바빴어.", en:"I was so busy renewing my residency visa."},
    {ko:"알아. 매년 하는 거 정말 짜증 나.", en:"I know. Doing it every year is so annoying."},
    {ko:"문제는 6주가 됐는데 아직 아무 소식도 못 들었어.", en:"The problem is it has been 6 weeks but I haven't heard anything yet."},
    {ko:"비자 에이전트한테 확인해 봐야 할 것 같아.", en:"I think you should check with your visa agent."},
    {ko:"괜찮아. 내가 낼게.", en:"It is okay. I will pay for it."},
    {ko:"돈 아껴. 새 집 사고 싶지 않아?", en:"Save your money. Don't you want to buy a new house?"},
    {ko:"운전면허증 있지 않니?", en:"Don't you have a driver's license?"},
    {ko:"처음에는 오른쪽에서 운전하는 게 어려웠어. 익숙해질 거야.", en:"Driving on the right was hard at first. You will get used to it."},
    {ko:"운전 시작하기 전에 드라이빙 레슨을 받아야 할 것 같아.", en:"I think I need to take driving lessons before I start driving."},
    {ko:"너의 신년 계획이 뭐야?", en:"What is your New Year's resolution?"},
    {ko:"생각 안 해봤는데. 너는?", en:"I haven't really thought about it. What about you?"},
    {ko:"난 더 나은 버전의 내가 될 거야.", en:"I want to become a better version of myself."},
    {ko:"계획은 없는 것보다 있는 게 낫지. 적어도 좋은 방향으로 인도해 주잖아.", en:"Having a plan is better than nothing. At least it guides you in the right direction."},
    {ko:"그럼 난 건강을 최우선으로 할래. 일주일에 세 번씩 운동 시작해야겠어.", en:"Then I will prioritize my health. I should start working out three times a week."},
    {ko:"당신이 말레이시아에 얼마나 살 건지 알고싶어요.", en:"I would like to know how long you are going to live here."},
    {ko:"나도 내가 말레이시아에 얼마나 살지 모르겠어요.", en:"I have no idea how long I will stay here either."},
    {ko:"여기서 은퇴하고 싶지 않으세요?", en:"Don't you want to retire here?"},
    {ko:"제가 여기서 은퇴하길 원하냐고요? 아니요.", en:"Do I want to retire here? No not really."},
    {ko:"기체 결함 때문에 비행기가 2시간 지연된대.", en:"They said the flight is delayed for two hours due to a technical issue."},
    {ko:"그럼 비행기가 10시에 출발한다는 뜻이야?", en:"Does that mean the plane will take off at 10?"},
    {ko:"애들 방학이 2주야. 그래서 난 뭘 해야하는지 모르겠어.", en:"The kids have a two-week break from school so I have no idea what to do."},
    {ko:"웹사이트 먼저 가봐 그리고 티켓이 있는지 체크해봐.", en:"Check the website first to see if there are any tickets available."},
    {ko:"더 빨리 가고 싶으면 네이게이션 앱을 써야 해.", en:"If you want to get there faster you should use a navigation app."},
    {ko:"몰랐네.", en:"I had no idea."},
    {ko:"말레이시아는 골프가 싸대. 배워보고 싶지 않아?", en:"I heard golfing is cheap here. Don't you want to learn?"},
    {ko:"개인적으로 난 춤추는 게 좋아.", en:"Personally I prefer dancing."},
    {ko:"줌바 클래스 들지 그래?", en:"Why don't you take the Zumba class?"},
    {ko:"나 그거 이미 6개월째 듣고 있는 중이야.", en:"I have been doing it for six months already."},
    {ko:"너 그레이스 알아?", en:"Do you know Grace?"},
    {ko:"우리 오래된 친구야. 나 말레이시아 왔을 때부터 알고 지냈어.", en:"We are old friends. I have known her since I came abroad."},
    {ko:"너희가 그렇게 오래된 사이인 줄은 몰랐네.", en:"I didn't know you guys went back that far."},
    {ko:"서울마트 자리에 새로운 한국마켓 어제 열었대.", en:"I heard a new Korean mart opened yesterday where Seoul Mart used to be."},
    {ko:"나중에 한번 가봐야겠다.", en:"I should check it out later."},
    {ko:"거기가 엄청 싸다고 들어서 그냥 가보려고.", en:"I heard it is really cheap so I just want to visit."},
    {ko:"근데 거기 코스트코처럼 대량으로 묶어서 팔아.", en:"But they sell things in bulk just like Costco."},
    {ko:"어제 우리 딸이 열이 났는데 해열제가 없었어.", en:"My daughter had a fever yesterday but we didn't have any fever reducer."},
    {ko:"왜 나한테 연락 안 했어?", en:"Why didn't you call me?"},
    {ko:"전화하기엔 너무 늦은 시간이라고 생각했지.", en:"I thought it was too late to call."},
    {ko:"다음엔 전화해. 도움이 필요하면 주저 말고 전화해.", en:"Call me next time. If you need a hand don't hesitate to call."},
    {ko:"이 카페가 몽키아라에 있으면 정말 좋을 텐데.", en:"It would be great if this cafe were in our neighborhood."},
    {ko:"여기 얼마나 자주 와?", en:"How often do you come here?"},
    {ko:"영어 공부한 지는 얼마나 되셨어요?", en:"How long have you been studying English?"},
    {ko:"10개월 넘게 하고 있어.", en:"I have been at it for more than 10 months."},
  
    {ko:"넌 주로 남편과 무슨 이야기를 하니?", en:"What do you usually talk about with your husband?"},
    {ko:"아이들에게 무슨이야기를 자주하니?", en:"What do you often tell your children?"},
    {ko:"난 아이가 아플때는 학교에 안 보내요.", en:"I don't send my child to school when they are sick."},
    {ko:"넌 집에서 요리를 하니?", en:"Do you cook at home?"},
    {ko:"우리 남편이 더 나이스 해요.", en:"My husband is nicer."},
    {ko:"달다. 설탕 같은 맛이 나.", en:"It is sweet. It tastes like sugar."},
    {ko:"나 바샤커피에서 커피 샀어. 냄새 맡아봐. 냄새 어때?", en:"I bought coffee at a nice cafe. Smell it. How does it smell?"},
    {ko:"냄새 진짜 좋다. 초콜렛 같은 냄새가 나.", en:"It smells really good. It smells like chocolate."},
    {ko:"맛도 볼래? 한입 마셔볼래?", en:"Do you want to taste it too? Do you want to take a sip?"},
    {ko:"왜 태국으로 고른거야? 한국이랑 가까워서 그런거야?", en:"Why did you choose Thailand? Is it because it is close to Korea?"},
    {ko:"난 내가 할 수 있는 한 가장 빨리 운전하고 있는 중이에요.", en:"I am driving as fast as I can."},
    {ko:"너 나만큼 크길 원해?", en:"Do you want to be as tall as me?"},
    {ko:"최악의 여행이었어.", en:"It was the worst trip."},
    {ko:"여기가 우리집에서 가장 큰 방이에요", en:"This is the biggest room in our house."},
    {ko:"2월은 1년중 가장 짧은 달이에요.", en:"February is the shortest month of the year."},
    {ko:"누군가가 그녀를 도와줬어?", en:"Did someone help her?"},
  
    {ko:"한국은 4계절이 있어요.", en:"Korea has four distinct seasons."},
    {ko:"그말은 너무 못됬는데.", en:"That was really mean."},
    {ko:"너 20대때 클럽 매일 갔었어?", en:"Did you go clubbing every day in your twenties?"},
    {ko:"아니야 매일 가지 않았었어. 이틀에 한번 갔었어.", en:"No I didn't go every day. I went every other day."},
    {ko:"다음주에 나랑 쇼핑갈래?", en:"Do you want to go shopping with me next week?"},
    {ko:"3시에 미팅에 참여할 수 있어?", en:"Can you join the meeting at 3?"},
    {ko:"다음주 언제한번 만나자.", en:"Let us meet up sometime next week."},
    {ko:"우리 social 가는건 어때?", en:"How about we go to the social?"},
  
    {ko:"처음 배우는거 아닌데요.", en:"No it is not my first time learning it."},
    {ko:"그것들은 완전 똑같지는 않아.", en:"They are not exactly the same."},
  
    {ko:"너 시차증 있어?", en:"Do you have jet lag?"},
    {ko:"난 한국에 있는 가족과 친구가 그리워.", en:"I miss my family and friends in Korea."},
    {ko:"누군가는 22세의 나이에 졸업을 해요.", en:"Some people graduate at 22."},
    {ko:"오바마는 55세에 은퇴했어요.", en:"Obama retired at 55."},
    {ko:"블랙박스 있어요?", en:"Do you have a dashcam?"},
    {ko:"내가 꼭 봐야해?", en:"Do I really have to watch it?"},
    {ko:"영화 제목이 뭐라고?", en:"What was the title of the movie?"},
    {ko:"스펠링이 어떻게 되?", en:"How do you spell it?"},
    {ko:"Desk의 D.", en:"D as in Desk."},
    {ko:"그녀를 위로 해 줄 수 있어?", en:"Can you comfort her?"},
    {ko:"레스토랑 이름이 뭐라고?", en:"What is the name of the restaurant?"},
    {ko:"레스토랑이 뭐라고 불린다고?", en:"What is the restaurant called?"},
    {ko:"패티크랩이라고 불려.", en:"It is called Patty Crab."},
    {ko:"뭐 하고 싶은 것 있어?", en:"Is there anything you want to do?"},
  
    {ko:"나 지금 바빠서 나중에 전화할게.", en:"I am busy right now so I will call you later."},
    {ko:"너 이번 주말에 뭐 해?", en:"What are you doing this weekend?"},
    {ko:"아직 모르겠어. 아마 집에 있을 것 같아.", en:"I am not sure yet. I will probably stay home."},
    {ko:"나 어제 많이 걸었어. 발이 너무 아파.", en:"I walked a lot yesterday. My feet are really sore."},
    {ko:"오늘 회의 몇 시야?", en:"What time is the meeting today?"},
  
    {ko:"머리 했어요? 오늘 달라 보여요.", en:"Did you do your hair? You look different today."},
  
    {ko:"나도 우리가 가야 하는지 잘 모르겠어요.", en:"I don't know if we have to go either."},
  
    {ko:"여기에 분실물 센터가 있는지 모르겠어요. 안내 데스크에 가서 물어보는건 어때요?", en:"I don't know if there is a lost and found here. Why don't you ask at the information desk?"},
  
    {ko:"난 버스가 몇시에 떠나는지 알고싶어.", en:"I want to know what time the bus leaves."},
  
    {ko:"나도 요금이 얼마인지 몰라. 한번 찾아보자.", en:"I don't know how much it is either. Let's find out."},
  
    {ko:"나 지금 뭐 먹을지 고민 중이야.", en:"I am trying to figure out what to eat right now."},
    {ko:"너 요즘 어때? 잘 지내고 있어?", en:"How have you been lately? Are you doing well?"},
    {ko:"나 요즘 너무 바빠서 친구들 못 만나고 있어.", en:"I have been so busy lately that I have not been able to meet my friends."},
    {ko:"우리 다음주에 시간 맞춰서 밥 한번 먹자.", en:"Let us find a time to have a meal together next week."},
    {ko:"나 어제 잠을 너무 못 잤어. 오늘 너무 피곤해.", en:"I barely slept yesterday. I am so tired today."},
  
    {ko:"언제 시작해?", en:"When does it start?"},
  
    {ko:"나도 그렇게 생각해.", en:"I think so too."},
  
    {ko:"각각 하나씩 주시겠어요?", en:"Could we get one of each please?"},
  
    {ko:"언제 우리 만나야 할까요?", en:"When should we meet?"},
  
    {ko:"저기요 주문할게요.", en:"Excuse me I would like to order."},
  
    {ko:"물 한 잔 주세요.", en:"Can I have a glass of water please."},
  
    {ko:"내가 꼭 빨리 가야해?", en:"Do I really need to rush?"},
  
    {ko:"모자가 드레스보다 비싸?", en:"Is the hat more expensive than the dress?"},
  
    {ko:"오늘은 나의 인생에서 가장 행복한 날이야.", en:"Today is the happiest day of my life."},
  
    {ko:"모든 카드가 한도가 다 찼어.", en:"All my cards are maxed out."},
  
    {ko:"내일 추울까?", en:"Do you think it will be cold tomorrow?"},
  
    {ko:"학교 인터내셔널 데이 갈 거예요?", en:"Are you going to the school International Day?"},
  
    {ko:"우리 가야 해요?", en:"Do we have to go?"},
  
    {ko:"버스는 8시 30분에 코러스호텔에서 떠나.", en:"The bus leaves from Corus Hotel at 8:30."},
  
    {ko:"너 요금이 얼마인지 알아?", en:"Do you know how much the fare is?"},
  ],
  3: [
    {ko:"그녀에게 물어보지 말았어야했어. 그건 너무 개인적인 거였어.", en:"I should not have asked her. It was way too personal."},
    {ko:"난 사람들 나이 제일 먼저 물어보는게 익숙해. 근데 더 이상 하지 말아야해.", en:"I am used to asking people age first, but I really need to stop doing that."},
    {ko:"너는 약을 먹었어야해, 그럼 지금쯤 괜찮았을텐데.", en:"You should have taken your medicine. You would have been fine by now."},
    {ko:"나는 4시쯤 갈 수 있을거야.", en:"I should be able to get there around 4 PM."},
    {ko:"여기에 속도제한 없다고 나와있잖아.", en:"But it says right here that there is no speed limit."},
    {ko:"너 미팅에 올 수 있을 것 같아?", en:"Do you think you can make it to the meeting?"},
    {ko:"그레이스는 뒤끝있어. 내가 저번달에 결석을 하지 말았어야했어.", en:"Grace holds a grudge. I really should not have skipped class last month."},
    {ko:"그레이스는 나에게 다음달에는 결석하지 말라고 얘기 했어.", en:"Grace told me not to skip any classes next month."},
    {ko:"마지막으로 남편 앞에서 방구를 꾼게 언제에요?", en:"When was the last time you farted in front of your husband?"},
    {ko:"우리가 마지막으로 만난것이 언젠지 기억이 안나.", en:"I cannot recall when the last time we met was."},
    {ko:"난 시험이 얼마나 어려웠었는지 몰라.", en:"You have no idea how brutal that exam was."},
    {ko:"너 포르쉐가 얼마나 비싼지 알아?", en:"Do you know how ridiculously expensive a Porsche is?"},
    {ko:"몰라 말레이시아에서 운전하는 것이 얼마나 어려운지.", en:"You have no idea how hard it is to drive here."},
    {ko:"넌 불닭볶음면이 얼마나 매운지 모를 거야.", en:"You will never understand how spicy Buldak Noodles really are."},
    {ko:"나도 어디에 주차했는지 모르겠어.", en:"I do not even remember where I parked my car."},
    {ko:"얼마나 됬나요?", en:"How long has it been?"},
    {ko:"얼마나 종종 아픈가요?", en:"How often do you experience the pain?"},
    {ko:"현재 복용중인 약이 있나요?", en:"Are you currently on any medications?"},
    {ko:"이쪽으로 쭉 가신다음에, 신호등에서 좌회전 하세요.", en:"Go straight down this way, then take a left at the traffic light."},
    {ko:"꽤 멀어요. 나라면 그랩을 부를꺼야.", en:"It is pretty far. If I were you, I would just call a taxi."},
    {ko:"너는 TV 보는것을 그만 했으면 좋겠어?", en:"Do you want me to stop watching TV?"},
    {ko:"말레이시아에 집을 사는건 비쌀까?", en:"Would it be expensive to buy a house here?"},
    {ko:"고마워 너가 방금 말한게 나한테 진짜 위로가 됬어.", en:"Thanks, what you just said really comforted me."},
    {ko:"이건 나에게 전혀 위로가 안되.", en:"This does not comfort me at all."},
    {ko:"너는 cost of living이랑 school tuition을 고려해야해.", en:"You need to take the cost of living and school tuition into consideration."},
    {ko:"Gym에서 운동하는 대신에, 나는 집에서 운동하는걸 추천해.", en:"Instead of working out at the gym, I recommend working out at home."},
    {ko:"이게 그런거야, 너는 사실을 받아 들여야해.", en:"It is what it is. You just have to face reality."},
    {ko:"너는 그녀와 거리를 두어야해.", en:"You should keep your distance from her."},
    {ko:"내가 당신을 뭐라고 부르면 되나요?", en:"What should I call you?"},
    {ko:"난 주중에는 술을 안 마시기로 결정했어.", en:"I have made up my mind not to drink during the week."},
    {ko:"난 사람들을 처음 만나면 내가 좀 조용하더라구.", en:"I find myself being on the quiet side when I first meet people."},
    {ko:"난 청소를 진짜 잘해. 나 자신에게 10점 만점에 10점을 줄 수 있어.", en:"I am great at cleaning. I would give myself a solid 10 out of 10."},
    {ko:"나 흑백요리사 봤는데, 흥미롭지 않았어.", en:"I watched Culinary Class Wars, but I did not find it that interesting."},
    {ko:"이거 너무 헷갈리는데 난 정말 헷갈려.", en:"This is so confusing. I am completely puzzled."},
    {ko:"좋아. 이 전 집보다 더 넓고, 더 나이스해.", en:"It is much more spacious and nicer than my previous place."},
    {ko:"응 난 돈 더 내. 근데 괜찮아. 난 너무 만족해.", en:"Yeah, I pay more rent, but it is totally worth it. I am so satisfied."},
    {ko:"내가 생각한것보다 훨씬 더 오래걸린다.", en:"It is taking much longer than I expected."},
    {ko:"죄송해요, 우린 평소보다 더 예약이 많아요.", en:"Sorry, we are fully booked and much busier than usual."},
    {ko:"주로 12월에는 비행기티켓이 더 비싸.", en:"Flight tickets are generally way more expensive in December."},
    {ko:"진짜? 난 12월에는 비행기 티켓이 더 싼 줄 알았어.", en:"Really? I thought flights would be cheaper in December."},
    {ko:"1-10까지 중에 너의 고통은 어느정도 인가요?", en:"On a scale of 1 to 10, how would you rate your pain?"},
    {ko:"증상이 더 나아졌나요, 아니면 나빠졌나요?", en:"Have the symptoms been getting better or worse?"},
    {ko:"그 남자 뭐 되? 그는 알지 못하는것 같아.", en:"Who does he think he is? He clearly has no clue."},
    {ko:"너가 아까 말한거랑 다르잖아.", en:"That is not what you said earlier."},
    {ko:"난 어디서든지 기꺼이 일할 수 있어, 월급 상관없이.", en:"I am willing to work anywhere, regardless of the salary."},
    {ko:"하와이에서 한 달 사는거 상상할 수 있어?", en:"Imagine living in Hawaii for a whole month. Can you picture that?"},
  
    {ko:"나는 항상 집 전체를 다 싸가야해 내가 여행 갈 때면.", en:"Whenever I travel, I feel like I have to pack my whole house."},
    {ko:"난 무조건 칼국수야 여기 올 때마다.", en:"Whenever I come here, Kalguksu is a must for me."},
    {ko:"난 그녀가 좀 나 같다는 느낌이 들어.", en:"I feel like she is a lot like me. Do not you think so?"},
    {ko:"난 항상 내 집에 깨끗해야해.", en:"My place always has to be spotless."},
    {ko:"난 주중에는 술을 안 마시기로 결정했어.", en:"I have decided not to drink during the week."},
    {ko:"난 사람들을 처음 만나면 내가 좀 조용하더라구.", en:"I realized that I am on the quiet side when I first meet people."},
    {ko:"난 사람들이랑 너무 가깝게 지내고 싶지는 않아.", en:"I do not really want to get too close to people."},
    {ko:"난 나 같은 사람이랑 친한 것 같아.", en:"I think I naturally click with people who are like me."},
    {ko:"점심 다 같이 먹으면 재미있겠다.", en:"It would be fun if we all had lunch together."},
    {ko:"하루에 적어도 6시간 자는건 중요해.", en:"It is important to get at least 6 hours of sleep a day."},
    {ko:"넌 그 사람 뭐가 좋아?", en:"What do you like about him?"},
    {ko:"너네 잘 맞는구나.", en:"You guys click so well."},
    {ko:"그녀는 디파짓을 한달 이내에 돌려준다고 동의했어요.", en:"She agreed to return the deposit within a month."},
    {ko:"내가 계속 설명 해도 알아 듣질 못해.", en:"Even though I keep explaining it they just do not get it."},
    {ko:"빛이 계속 켜졌다 꺼졌다 해.", en:"The light keeps flickering on and off."},
    {ko:"우리 남편은 항상 티셔츠를 뒤집어서 벗어놔.", en:"My husband always leaves his T-shirts inside out when he takes them off."},
    {ko:"너 먹고 싶은 만큼 먹어.", en:"Eat as much as you want."},
    {ko:"난 계속 읽어봤는데 난 여전히 이해를 못하겠어.", en:"I read it over and over again but I still do not get it."},
    {ko:"우리 만난 적 있나요? 너 익숙해 보여요.", en:"Have we met before? You look familiar."},
    {ko:"나 이전에 너 본 적 있는거 같아요.", en:"I think I have seen you before."},
    {ko:"나 누군가가 여기서 담배 피는 것 본 적 있어.", en:"I have seen someone smoking here before."},
    {ko:"오페라 하우스는 내가 생각한 것 만큼 아름다웠어.", en:"The Opera House was as beautiful as I thought it would be."},
    {ko:"싱가폴은 말레이시아보다 훨씬 더 깨끗하지 않았어.", en:"Different cities have different vibes when you travel."},
    {ko:"내 핸드폰이 꺼졌어. 충전기를 빌릴 수 있을까요?", en:"My phone died. Can I borrow a charger?"},
    {ko:"turbulence가 진짜 안 좋았어. 토할것 같았어.", en:"The turbulence was awful. I felt like throwing up."},
  
    {ko:"이런거 이전에 먹어 본 적있어?", en:"Have you ever tried this before?"},
    {ko:"이런 뭔가 먹어 본 적 없어.", en:"I have never had anything like this."},
    {ko:"냄새가 어때?", en:"How does it smell?"},
    {ko:"냄새가 꽤 좋아. 칼국수 같은 냄새가 나.", en:"It smells pretty good. It smells like Kalguksu."},
    {ko:"저 여자 어때? 난 저 여자가 어디 사람인지 궁금해.", en:"Look at that girl. I wonder where she is from."},
    {ko:"저 여자가 베트남 여자라고 들었어.", en:"I heard she is Vietnamese."},
    {ko:"나 궁금해 저 여자가 몇 살인지. 저 여자 엄청 어려보여.", en:"I wonder how old she is. She looks so young."},
    {ko:"난 확실해 그녀가 너 보다 나이가 많아.", en:"I am positive she is older than you."},
    {ko:"좋은 날은 여기서 메르데카 빌딩이 보여요.", en:"On a clear day you can see the Merdeka building from here."},
    {ko:"뷰가 엄청 좋아요. 이 뷰는 트윈타워에서 보는 것만큼 좋아요.", en:"The view is amazing. It is just as good as the view from the Twin Towers."},
    {ko:"창 밖을 봐요. 그림 같아요. 여기서 살 수 있으면 좋겠어요.", en:"Look out the window. It looks like a painting. I wish I could live here."},
    {ko:"그녀를 다 믿지마. 그녀는 항상 이야기에 살을 붙혀. 그래서 난 그녀가 말한 것의 반만 믿어.", en:"Do not believe everything she says. She always adds extra layers to her stories so I only believe half of what she says."},
    {ko:"난 조금은 알고있었어. 그녀가 항상 과장하는것은.", en:"I had a feeling. I knew she always exaggerates."},
    {ko:"나 10분동안 너를 찾고 있었어.", en:"I have been looking for you for 10 minutes."},
    {ko:"얼마나 기다렸어?", en:"How long have you been waiting?"},
    {ko:"30분째야.", en:"It has been 30 minutes."},
    {ko:"여기 최근에 바빠. 난 이렇게 기다린거 세번째야.", en:"It has been busy here lately. This is my third time waiting like this."},
    {ko:"나 너무 배고파. 나 아침 이후로 아무것도 먹은게 없어.", en:"I am starving. I have not eaten anything since breakfast."},
    {ko:"너 정말 배고프겠다.", en:"You must be starving."},
    {ko:"저건 무슨 뜻이야?", en:"What does that mean?"},
    {ko:"저 뜻은 우리는 여기 주차할 수 없다는 뜻이야.", en:"It means we cannot park here."},
    {ko:"내가 아는 한, VIP뜻은 very important person이라는 뜻이야.", en:"As far as I know VIP means Very Important Person."},
    {ko:"다오래 몇 주 전에 다시 열었잖아.", en:"You know a Korean BBQ place reopened a few weeks ago."},
    {ko:"다오래 보쌈 먹어봤어? 원할머니보쌈 만큼 맛있어?", en:"Have you tried the Bossam at a Korean BBQ place? Is it as good as another Korean restaurant?"},
    {ko:"내가 목요벼룩시장에 어떻게 갈 수 있을까요 여기서부터?", en:"How do I get to the Thursday Flea Market from here?"},
    {ko:"찾기가 어려워. 내가 같이 가도 될까? 내가 거기 데리고 갈께.", en:"It is tricky to find. Mind if I join you? I will take you there."},
    {ko:"나 가고 있는 길이야. 나 지금 H&M 방향으로 가고 있어.", en:"I am on my way. I am heading towards H&M right now."},
    {ko:"알았어. 나 잠깐 화장실 좀 들렀다가 갈께.", en:"Got it. I will just stop by the restroom real quick and head over."},
    {ko:"나 스타벅스 커피 먹고 싶어. 여기 주위에 드라이브스루 스타벅스 있어?", en:"I am craving Starbucks. Is there a drive-thru Starbucks around here?"},
    {ko:"저 다리건너에 하나 있어.", en:"There is one just across the bridge."},
    {ko:"나 어때 보여? 이거 나한테 잘 어울려?", en:"How do I look? Does this look good on me?"},
    {ko:"너무 끼는데. 내 생각에는 너 살찐거 같아.", en:"It is way too tight. I think you gained weight."},
    {ko:"내가 방금 대기명단에 이름 올렸어.", en:"I just put our names on the waiting list."},
    {ko:"나 말레이시아에 1년째 살고 있어요.", en:"I have been living here for a year."},
    {ko:"우리 선풍기 안 껐네. 얼마나 켜져 있었던거야?", en:"We left the fan on. How long has it been running?"},
    {ko:"너의 새해 계획은 뭐야?", en:"What is your New Year's resolution?"},
    {ko:"난 건강을 최우선으로 둘꺼야. 너는?", en:"I am going to prioritize my health. What about you?"},
    {ko:"더 나은 버젼의 내가 되도록 노력 할꺼야.", en:"I am going to try to become a better version of myself."},
  
    {ko:"머리 바꿨어요? 오늘 완전히 달라 보여요.", en:"Did you change your hair? You look totally different today."},
    {ko:"고마워요. 다듬었어요.", en:"Thanks. I got it trimmed."},
    {ko:"학교 인터내셔널 데이 갈 거야?", en:"Are you hitting the school's International Day?"},
    {ko:"우리 꼭 얼굴 도장 찍어야 해?", en:"Are we supposed to show up?"},
    {ko:"가야 되는 건지 감이 안 오네.", en:"I have no clue if we need to be there."},
    {ko:"난 그냥 패스할래.", en:"I will probably pass on it."},
    {ko:"진짜 오랜만이다! 너 못 본 지 엄청 됐다.", en:"It has been forever! I haven't run into you in so long."},
    {ko:"가디언 비자 갱신 때문에 눈코 뜰 새 없이 바빴어.", en:"I have been swamped with my residency visa renewal."},
    {ko:"내 말이, 매년 그거 하는 거 진짜 골칫덩어리야.", en:"Tell me about it, doing that every year is such a pain."},
    {ko:"이게 어떻게 된 거냐면, 6주나 지났는데 아직 아무것도 아는 게 없어.", en:"Here's the thing, it has been six weeks and I am still left in the dark."},
    {ko:"비자 에이전트한테 진행 상황 어떻게 돼가냐고 물어봐야 할 것 같아.", en:"You should probably get a status update from your visa agent."},
    {ko:"코로나 전에 집을 샀더라면 가치가 두 배는 뛰었을 텐데.", en:"If I had bought a house before COVID it would have doubled in value."},
    {ko:"집값이 이렇게까지 치솟을 줄은 꿈에도 몰랐지.", en:"I never expected the prices to go this far."},
    {ko:"만약 지금 돈이 있다면 집을 살 거야?", en:"If you had the money right now would you buy a house?"},
    {ko:"내가 지금 집을 사면 집값이 왠지 뚝 떨어질 것 같아.", en:"If I purchased a property now the market would probably go down."},
    {ko:"맞아 그럴게. 왜 이렇게 오래 걸리는 거야? 이해가 안 가.", en:"Right I will. Why is it taking so long? I don't understand."},
    {ko:"이거 순 바가지 아냐?", en:"Isn't this a total rip-off?"},
    {ko:"나 머리 자른 거 눈치 못 챘어?", en:"Haven't you noticed I got a haircut?"},
    {ko:"내가 그걸 어떻게 알아챠냐.", en:"How on earth was I supposed to know?"},
    {ko:"넌 내가 머리를 아예 금발로 염색해도 절대 모를 인간이야.", en:"You wouldn't notice even if I dyed my hair blonde."},
    {ko:"laugh 스펠링이 뭐야?", en:"How do you spell laugh?"},
    {ko:"램프의 L.", en:"L as in lamp."},
    {ko:"아, 그게 맞는 말이야? 세상에, 난 여태 잘못 말하고 있었네.", en:"Is that how you say it? Oh my god I have been saying it wrong."},
    {ko:"아, as in이야. 이제 알겠지?", en:"Ah it is as in. Got it?"},
    {ko:"나 오늘 하루 종일 집에 처박혀 있었어. 심심해 죽겠는데 너 뭐 해?", en:"I have been stuck at home all day. I am so bored what are you up to?"},
    {ko:"나 이제 맥주 안 마셔.", en:"I don't drink beer anymore."},
    {ko:"아니, 3주째야. 1월 1일부터 한 방울도 안 마셨어.", en:"No it has been three weeks. I haven't touched a drop since January 1st."},
    {ko:"네가 얼마나 버티나 한 번 두고 보자.", en:"Let us see how long you can keep it up."},
    {ko:"이번 다짐을 지키려고 진짜 최선을 다할 거야.", en:"I am going to do my best to keep this promise."},
    {ko:"나 너무 슬프다. 내 소중한 술친구를 잃어버린 기분이야.", en:"I am so sad I feel like I lost my drinking buddy."},
    {ko:"곰을 마주치면 침착함을 유지하라고 적혀 있더라고.", en:"It says you should stay calm if you see a bear."},
    {ko:"곰을 봤는데 내가 어떻게 침착해? 난 그냥 캠핑 안 갈래.", en:"How can I stay calm if I run into a bear? I would rather skip camping entirely."},
    {ko:"내가 너라면 갈 텐데. 곰을 만날 확률은 엄청 낮아.", en:"If I were you I would still go. The chance of seeing a bear is very slim."},
    {ko:"혹시 모르니까 반드시 곰 퇴치 스프레이 챙겨와.", en:"Just in case make sure to bring bear spray."},
    {ko:"내가 네 입장이라면 난 그 사람 용서해 준다.", en:"If I were in your shoes I would forgive him."},
    {ko:"내 말뜻은, 그래도 기회를 한 번만 더 주는 게 맞지 않나 싶어서.", en:"What I mean is I think you should give him one more chance."},
    {ko:"딱 잘라 말하는데, 나 그 사람이랑 완전히 끝났어.", en:"Let me make it clear, we are completely done."},
  
    {ko:"그녀가 나에게 그렇게 걱정하지 말래", en:"She says not to worry so much."},
    {ko:"그녀가 나에게 그렇게 걱정하지 말래", en:"She told me not to worry so much."},
    {ko:"너도 긴머리를 했었니?", en:"Did you used to have long hair?"},
    {ko:"한국에서 운전을 했었나요?", en:"Did you used to drive in Korea?"},
    {ko:"아이가 열이 나, 그래서 학교를 안 보냈어. 너는 아이가 아프면 학교에 보내니?", en:"My child has a fever so I didn't send them to school. Do you send your child to school when they are sick?"},
    {ko:"했었어요. 근데 지금은 안해요. 하지만 난 남편이 오면 요리를 해요.", en:"I used to but I don't now. But I cook when my husband comes home."},
    {ko:"네 저는 Chinese Canadian을 만났었어요.", en:"Yes I dated a Chinese Canadian."},
    {ko:"그는 너의 남편 만큼 나이스 한가요?", en:"Is he as nice as your husband?"},
    {ko:"너의 남편의 첫인상이 어땠어?", en:"What was your first impression of your husband?"},
    {ko:"언제 그와 결혼해야겠다고 결정했어?", en:"When did you decide to marry him?"},
    {ko:"응 난 우리남편을 처음 만났던 날을 기억해. 왜냐하면 우리가 만난 날은 나의 생일이었어.", en:"Yes I remember the day I first met my husband because the day we met was my birthday."},
    {ko:"혹시 내가 깍아달라고 하는것도 들었니?", en:"Did you hear me ask for a discount by any chance?"},
    {ko:"이거 먹어봐. 이거 말레이시아 디저트인데 꼭 팥빙수같아.", en:"Try this. This is a local dessert and it is just like Patbingsu."},
    {ko:"꼭 솜사탕 같아 보인다. 한번 먹어볼께.", en:"It looks just like cotton candy. I will try it."},
    {ko:"그래. 이거 냄새는 좋은데 맛은 진짜 좋지는 않다.", en:"Okay. This smells good but it doesn't taste really good."},
    {ko:"마지막으로 여행간 건 2년전이었고, 우리는 태국에 갔었어.", en:"The last time we went on a trip was two years ago and we went to Thailand."},
    {ko:"그것도 맞고, 싸고 그리고 시차도 없잖아.", en:"That is true too plus it is cheap and there is no time difference."},
    {ko:"너 어제 30분 넘게 기다렸어?", en:"Did you wait for more than 30 minutes yesterday?"},
    {ko:"난 매운거 정말 잘먹어요. 그러니 할 수 있는 한 가장 맵게 만들어줘요.", en:"I am really good at eating spicy food. So please make it as spicy as you can."},
    {ko:"난 늦어서 서둘러야해요. 할 수 있는한 가장 빨리 운전해줄 수 있나요?", en:"I am late so I need to hurry. Can you drive as fast as you can?"},
    {ko:"가장 긴 줄 이었어.", en:"It was the longest line."},
    {ko:"너의 집에서 가장 큰 방이 어디에요?", en:"Where is the biggest room in your house?"},
    {ko:"1년중 가장 짧은 달이 언제에요?", en:"When is the shortest month of the year?"},
    {ko:"고마워 근데 난 이 목걸이를 하고 다니면 안된다고 들었어 밖에서.", en:"Thanks but I heard that I shouldn't wear this necklace outside."},
  
    {ko:"몽키아라의 길은 좁고 많은 차들로 항상 붐벼요.", en:"The roads in our neighborhood are narrow and always packed with cars."},
    {ko:"언제 괜찮아? 이번주 금요일 괜찮아?", en:"When are you free? Does this Friday work for you?"},
    {ko:"내가 이 주식 팔기만 하면 밤부힐에 하남돼지집에 데려갈께.", en:"Once I sell this stock I will take you to a Korean BBQ restaurant at the mall."},
    {ko:"4시쯤 갈 수 있을거야.", en:"I should be able to get there around 4."},
    {ko:"이 도로위에서는 속도를 줄여야 한다는 뜻이야.", en:"It means you need to slow down on this road."},
    {ko:"여기에 속도제한 없다고 나와있잖아.", en:"It says there is no speed limit here."},
    {ko:"나 미팅에 못 갈 것 같아.", en:"I don't think I can make it to the meeting."},
    {ko:"너 미팅에 올 수 있을 것 같아?", en:"Do you think you can make it to the meeting?"},
    {ko:"그레이스는 내가 다음달에 오길 원한다고 이야기 했어요.", en:"Grace said she wants me to come next month."},
    {ko:"그레이스는 나에게 다음달에는 결석하지 말라고 얘기 했어요.", en:"Grace told me not to miss class next month."},
    {ko:"다음주에 목요일에 친구랑 점심 약속이 있어.", en:"I have lunch plans with a friend next Thursday."},
    {ko:"목요일이 우리 둘 다 한테 괜찮은것 같아.", en:"I think Thursday works for both of us."},
    {ko:"목요일이 우리 모두에게 괜찮은것 같아.", en:"I think Thursday works for everyone."},
    {ko:"화요일이 괜찮겠어요?", en:"Would Tuesday work for you?"},
    {ko:"나는 4시쯤 도착할 수 있을거야.", en:"I should be able to get there around 4."},
    {ko:"그 학교는 예전에 다른 이름이었어.", en:"That school used to be called something else before."},
    {ko:"너 그 약어가 무슨뜻인지 알고있어?", en:"Do you know what that abbreviation stands for?"},
    {ko:"이제 나는 은행계좌를 열 수 있을것 같아.", en:"I think I can open a bank account now."},
    {ko:"3시 미팅은 못 갈것 같은데.", en:"I don't think I can make the 3 o clock meeting."},
    {ko:"대학 1학년 동안에 나는 거의 매일 클럽에 갔었어.", en:"During my freshman year of college I went clubbing almost every day."},
    {ko:"내 20대의 한 기간동안, 나는 클럽에 매일 갔었어.", en:"At one point in my twenties I went clubbing every day."},
    {ko:"나 다음달에 이용할 수 있을 것 같아.", en:"As for next Wednesday I might be available."},
  
    {ko:"처음 잡 인터뷰 했던 날 기억나?", en:"Do you remember the day we had our first job interview?"},
    {ko:"줌바 배우는거 처음이세요?", en:"Is this your first time taking a Zumba class?"},
    {ko:"마지막으로 남편 앞에서 방구를 꾼게 언제에요?", en:"When was the last time you farted in front of your husband?"},
    {ko:"나 뉴욕에 가는거 처음이에요. 나 너무 신나요.", en:"It is my first time going to New York and I am so excited."},
    {ko:"그만 지적해 지겨워 죽겠어.", en:"Stop pointing everything out. I am so sick of it."},
    {ko:"나 말레이시아에서 버스 처음 타봤어.", en:"I took the bus here for the first time."},
    {ko:"나 어제 야생 원숭이 봤어 처음으로. 너무 무서웠어.", en:"I saw a wild monkey for the first time yesterday. It was so scary."},
    {ko:"덱스한테 연기가 적합한지 잘 모르겠어.", en:"I am not sure if acting is the right fit for Dex."},
    {ko:"예희는 straight A student에요. 항상 1등해요.", en:"Yehee is a straight-A student. She is always at the top of her class."},
    {ko:"내가 들어가서 처음 본 것은 결혼사진이었어.", en:"The first thing I saw when I walked in was a wedding photo."},
    {ko:"나 숙제 다하면 TV 볼꺼야.", en:"I am going to watch TV after I finish my homework."},
    {ko:"우리가 마지막으로 만난것이 언젠지 기억이 안나.", en:"I can not remember the last time we met."},
    {ko:"나도 어디에 주차했는지 모르겠어.", en:"I don't even know where I parked."},
    {ko:"너 내가 뭘 사고 싶은지 알아?", en:"Do you know what I want to buy?"},
    {ko:"난 너가 뭘 사고 싶은지 몰라.", en:"I don't know what you want to buy."},
    {ko:"난 목요일날 되는데. 넌 되?", en:"Thursday works for me. Does it work for you?"},
  
    {ko:"나 한국 갈 준비 다 됬어.", en:"I am all set to go to Korea."},
    {ko:"나 점심 먹을 준비 다 됬어.", en:"I am all set for lunch."},
    {ko:"나 출발 준비 다 됬어.", en:"I am all set to leave."},
    {ko:"나 요가 시작할 준비 다 됬어.", en:"I am all set to start yoga."},
    {ko:"아직 준비 안됬어.", en:"I am not set yet."},
    {ko:"나 빠질 준비가 아직 안됬어.", en:"I am not set to leave yet."},
    {ko:"나 배터리 다 됬어.", en:"I am running out of battery."},
    {ko:"나 시간 다 됬어.", en:"I am running out of time."},
    {ko:"나 아이디어가 다 떨어졌어.", en:"I am running out of ideas."},
    {ko:"나 돈 다 떨어져 가.", en:"I am running out of money."},
    {ko:"나 주제가 다 떨어졌어.", en:"I am running out of topics."},
    {ko:"우리 케찹 다 떨어져가.", en:"We are running out of ketchup."},
    {ko:"우리 물 다 떨어졌어.", en:"We have run out of water."},
    {ko:"나 핸드폰 배터리가 다 됐어.", en:"My phone ran out of battery."},
    {ko:"나 캐리어에 공간이 없어.", en:"I ran out of space in my suitcase."},
    {ko:"우리 소금이 다 떨어졌어.", en:"We ran out of salt."},
    {ko:"나 아이디어가 다 됐어.", en:"I ran out of ideas."},
    {ko:"우리 먹을게 다 떨어졌어.", en:"We ran out of food."},
    {ko:"나 쇼핑백에 공간이 없어.", en:"I ran out of space in my shopping bag."},
  
    {ko:"비자 에이전트에게 연락을 해봤어요?", en:"Have you reached out to your visa agent?"},
    {ko:"나는 이미 그에게 수백번 전화를 했어요.", en:"I have already called him hundreds of times."},
    {ko:"너 그 카페에 가본 적 있어?", en:"Have you ever been to that cafe?"},
    {ko:"나 오늘 처음 가봤어.", en:"I went there for the first time today."},
    {ko:"너 저번에 거기 가봤던 적 있어?", en:"Have you ever been there before?"},
    {ko:"한 번도 가본적 없어.", en:"I have never been there."},
    {ko:"나 거기 몇 번 가봤어.", en:"I have been there a few times."},
    {ko:"너 불닭볶음면 먹어본 적 있어?", en:"Have you ever tried Buldak noodles?"},
    {ko:"매리는 노래를 엄청 잘해. 노래 대회에서 여러 번 우승했었어.", en:"Mary is a great singer. She has won singing competitions several times."},
    {ko:"나는 아직 한국 드라마 한편도 안봤어.", en:"I have not watched a single Korean drama yet."},
    {ko:"어젯밤에 거의 잠을 못 잤어. 오늘 너무 피곤해.", en:"I barely slept last night. I am so tired today."},
    {ko:"나는 케이팝 노래를 거의 안 들어.", en:"I barely listen to K-pop."},
    {ko:"나는 어제 5km를 거의 다 뛰었어.", en:"I almost ran five kilometers yesterday."},
    {ko:"지갑을 거의 잊어버릴 뻔했어. 다행히 차안에 있었어.", en:"I almost forgot my wallet. Luckily it was in the car."},
    {ko:"와! 여기 엄청 맛있어보여! 나 벌써 군침 돌아.", en:"Wow this looks so good. I am already drooling."},
    {ko:"드디어 비자가 나왔어! 이제 나 진짜 말레이시아에서 살 수 있어.", en:"My visa finally came through. I can really live here now."},
  
    {ko:"한국이랑 일본이랑 시차가 어떻게 되?", en:"What is the time difference between Korea and Japan?"},
    {ko:"나 시차적응 중이야.", en:"I am still adjusting to the time difference."},
    {ko:"뉴욕은 캘리포니아보다 3시간 빨라요.", en:"New York is three hours ahead of California."},
    {ko:"누군가는 25세에 CEO가 되요.", en:"Some people become CEOs at 25."},
    {ko:"나 사고날뻔 했었어.", en:"I almost got into an accident."},
    {ko:"후회 안 할꺼야. 난 확실해 너가 완전 좋아할꺼야.", en:"You won't regret it. I am sure you will absolutely love it."},
    {ko:"난 그냥 2달 기다렸다가 집에서 볼래.", en:"I will just wait two months and watch it at home."},
    {ko:"사실, 나의 편안함이 그에게 최우선이야.", en:"Actually my comfort is his top priority."},
    {ko:"몰디브는 완전 나의 다음 여행 리스트의 top이야.", en:"The Maldives is at the top of my travel list."},
    {ko:"나는 그녀를 위로 하기위해 최선을 다했어요.", en:"I did my best to comfort her."},
    {ko:"이건 나에게 전혀 위로가 안돼.", en:"This doesn't comfort me at all."},
    {ko:"돈은 나무에서 자라지 않아.", en:"Money doesn't grow on trees."},
    {ko:"자야마트는 비싼 편이지.", en:"the supermarket is on the expensive side."},
  ],
  4: [
    {ko:"너 감정을 다치게 하려는 뜻은 아니였어. 기분나쁘게 하려는게 아니었어.", en:"I did not mean to hurt your feelings. I hope you did not take it personally."},
    {ko:"나 일찍 올 수 있었는데, 오는길에 차 사고가 있었어.", en:"I could have been here earlier, but there was a car accident on the way."},
    {ko:"다음주 언제한번 만나자.", en:"Let us grab a coffee or something sometime next week."},
    {ko:"너가 오른쪽에서 운전하는것 감만 잡으면, 엄청 쉽다고 느낄꺼야.", en:"Once you get the hang of driving on the right side, you will find it super easy."},
    {ko:"그레이스는 내가 다음달에 오길 원한다고 이야기 했어.", en:"Grace mentioned that she expects me to show up next month."},
    {ko:"BTS 콘서트가 다음달에 해외에서 열린대, 나랑 같이 갈래?", en:"I heard the BTS concert is happening in the city next month. Do you want to come with me?"},
    {ko:"미안해 나 10분 늦을 것 같아. 너희들 먼저 주문해.", en:"Sorry, I think I am running about 10 minutes late. Go ahead and order first."},
    {ko:"그 학교는 예전에 다른 이름이었어.", en:"That school used to be called something else before."},
    {ko:"나는 운전을 밤에 했었는데 이제 안해. 남편이 원하지 않아서.", en:"I used to drive at night, but I do not anymore because my husband prefers me not to."},
    {ko:"우리 날짜좀 앞으로 옮겨도 될까?", en:"Do you mind if we move the date up a bit?"},
    {ko:"나 화요일 아니면 목요일로 일정을 다시 잡고 싶어요.", en:"I would like to reschedule our appointment for either Tuesday or Thursday."},
    {ko:"처음 잡 인터뷰 했던 날 기억나?", en:"Do you remember the day you had your very first job interview?"},
    {ko:"나 뉴욕에 가는거 처음이에요. 나 너무 신나요.", en:"This is my first time visiting New York, and I am beyond excited!"},
    {ko:"드디어 2년 넘게 있었던 집에 있던 로봇들을 다 팔았어.", en:"I finally sold off all the robot cleaners that had been sitting in my house for over two years."},
    {ko:"예희는 straight A student에요. 항상 1등해요.", en:"Yehee is a straight A student. She always takes first prize."},
    {ko:"너 내일 미팅이 얼마나 할지 알아? 난 오래 있을 수 없는데.", en:"Do you know how long tomorrow meeting will run? I cannot stay for too long."},
    {ko:"말레이시아 무시하지마. 여기 오기만 하면 왜 사람들이 좋아하는지 깨닫게 될꺼야.", en:"Do not look down on here. Once you visit, you will see exactly why people fall in love with this place."},
    {ko:"난 3일째 인후통이 있어요.", en:"I have had a sore throat for three days now."},
    {ko:"고통이 있나요? 만약 그렇다면, 묘사해 주실 수 있나요?", en:"Are you in any pain? If so, could you describe it for me?"},
    {ko:"내가 우리딸을 내일 병원에 데려갈꺼야.", en:"I am taking my daughter to the clinic tomorrow."},
    {ko:"그냥 접촉사고였어요. 심각한건 아니였어요.", en:"It was just a minor fender bender. Nothing serious."},
    {ko:"나는 TRX갈꺼야 룰루레몬 매장이 있는지 보러.", en:"I am heading to TRX to check if there is a Lululemon store."},
    {ko:"나 toyrus 갈꺼야 우리딸 선물을 사러.", en:"I am going to Toys R Us to pick up a gift for my daughter."},
    {ko:"내가 물어볼께 그들이 가격을 내릴 수 있는지.", en:"I will check if they can lower the price for us."},
    {ko:"나는 서점에 갔어요 Wimpy Kid series 있는지 확인 하기 위해.", en:"I stopped by the bookstore to check if they have the Wimpy Kid series."},
    {ko:"내가 999에 전화했어요 경찰에 신고하려고.", en:"I dialed 999 to report it to the police."},
    {ko:"나는 미역국을 끓일꺼야 오늘밤에, 그래서 자야 마트에 가야해.", en:"I am going to whip up some seaweed soup tonight, so I have got to hit Jaya Grocer."},
    {ko:"내가 꼭 노랑색을 입어야해요? 빨간색을 입으면 안 되요?", en:"Do I really have to wear yellow? Can I just wear red instead?"},
    {ko:"내가 지난 주에 영화를 봤는데, 너는 꼭 봐야해. 실화 바탕의 영화야.", en:"I watched a movie last week that you absolutely must see. It is based on a true story."},
    {ko:"알았어 내일 볼께. 이 아이맥스 영화의 가격은 거의 두배잖아.", en:"Alright, I will watch it tomorrow. It better be good since IMAX tickets cost almost double."},
    {ko:"난 그냥 2달 기다렸다가 집에서 볼래.", en:"I would rather just wait a couple of months and watch it at home."},
    {ko:"치우는데 30분 걸릴거에요. 나는 너가 30분 후에 출발하면 좋겠어요.", en:"It is going to take 30 minutes to clean up, so I would prefer if you left in half an hour."},
    {ko:"나는 너무 순진했어 그렇게 얘기하다니.", en:"It was so naive of me to say something like that."},
    {ko:"우리 점심약속 2틀만 땡기면 안될까? 나는 다음주 화요일 수요일 다 되는데.", en:"Would it be possible to move our lunch date up by two days? I am completely free next Tuesday and Wednesday."},
    {ko:"진짜? 얼마나 싸? 같이 가 볼래? 너 내일 시간 되?", en:"Really? How cheap is it? Want to go check it out together? Are you free tomorrow?"},
    {ko:"그녀는 위로가 필요해, 나는 그녀에게 전화해야겠어 오늘밤에.", en:"She needs some comforting, so I should give her a call tonight."},
    {ko:"우리언니랑 쇼핑을 가는것은 엄청 재밌어. 우리는 옷 보는 취향이 비슷하거든.", en:"Going shopping with my sister is always a blast because we have the exact same taste in clothes."},
    {ko:"일찍 자는것은 장단점이 있지.", en:"Going to bed early definitely has its pros and cons."},
    {ko:"그녀는 그런 일을 겪은 적이 없어, 너는 그녀로부터 조언을 받으면 안되.", en:"She has never been through anything like that, so you probably should not take advice from her."},
    {ko:"한국이랑 일본이랑 시차가 어떻게 되?", en:"What is the time difference between Korea and Japan?"},
    {ko:"나 말레이시아에서 버스 처음 타봤어.", en:"This is actually my first time taking a bus here."},
    {ko:"저 여자는 너의 생각보다 나이가 많아.", en:"She is actually much older than you would think."},
    {ko:"저 여자는 40대야. 놀랍지 않니?", en:"She is actually in her 40s. Is not that surprising?"},
    {ko:"나는 항상 집 전체를 다 싸가야해 내가 여행 갈 때면.", en:"I always feel the need to pack my entire house whenever I travel."},
    {ko:"새 집 어때?", en:"How do you like your new place?"},
    {ko:"내가 얼마나 더 오래 기다려야해요?", en:"How much longer do I have to wait?"},
    {ko:"아니야, 크리스마스도 있고 새해 전날도 있잖아. 더 많은 휴일이 있잖아.", en:"Not really, with Christmas and New Year Eve, there are just so many holidays compared to usual."},
  
    {ko:"난 청소를 진짜 잘해. 나 자신에게 10점 만점에 10점을 줄 수 있어.", en:"I am really good at cleaning. I would give myself a 10 out of 10."},
    {ko:"너 사람들 앞에서 피아노 쳐서 자랑스러웠어?", en:"Were you proud of playing the piano in front of everyone?"},
    {ko:"나 너무 떨렸어. 근데 영광스러웠어 사람들 앞에서 피아노를 치는건.", en:"I was so nervous but it was an honor to play the piano in front of people."},
    {ko:"이거 먹기에 너무 달다. 내가 먹어본 제일 단 초콜렛이야.", en:"This is too sweet to eat. It is the sweetest chocolate I have ever had."},
    {ko:"너는 내가 아는 가장 말이 많은 사람중에 하나야.", en:"You are one of the most talkative people I know."},
    {ko:"오늘은 내가 경험해본 가장 추운 날 중에 하나야.", en:"Today is one of the coldest days I have ever experienced."},
    {ko:"이것은 내가 산 것중에 제일 비싼거야.", en:"This is the most expensive thing I have ever bought."},
    {ko:"말레이시아로 이주하는건 내가 결정한 가장 용감한 결정이였어.", en:"Moving abroad was the bravest decision I have ever made."},
    {ko:"말레이시아로 이주하는건 내가 여태까지 결정한 가장 잘 한 결정중에 하나야.", en:"Moving abroad is one of the best decisions I have ever made."},
    {ko:"너 신발이 엄청 많다. 난 너만큼 많은 신발은 없는것 같아.", en:"You have a ton of shoes. I do not think I have as many as you."},
    {ko:"너무 웃긴다. 넌 내가 아는 웃긴 사람중에 한 명이야.", en:"That is so funny. You are one of the funniest people I know."},
    {ko:"사기전에 꼼꼼히 확인해봐. 가끔은 더 싸면 품질이 더 나빠.", en:"Check carefully before you buy it. Sometimes the cheaper it is the worse the quality."},
    {ko:"맞아 비쌀수록 품질이 좋긴하지.", en:"True the more expensive it is the better the quality tends to be."},
    {ko:"항상 그렇지는 않아.", en:"Not always. That is not always the case."},
    {ko:"우리 저번주에 가족 모임이 있었는데, 만두를 처음부터 끝까지 만들었어.", en:"We had a family gathering last week and made dumplings completely from scratch."},
    {ko:"싱가폴은 내가 들은것만큼 깨끗하지 않았어. 쓰레기들이 여기저기 있었어.", en:"Singapore was not as clean as I had heard. There was trash all over the place."},
    {ko:"너는 차가 소유했을때의 장단점을 생각해봐야해 결정을 하기 전에.", en:"You should weigh the pros and cons of owning a car before making a decision."},
    {ko:"이 스케쥴이 너무 타이트하다고 생각하지 않니?", en:"Do not you think this schedule is too tight?"},
    {ko:"몽키아라에는 한국 식당이 많아 근데 아주 몇몇개만 맛있어.", en:"There are a lot of Korean restaurants in our neighborhood but only a few of them are actually good."},
    {ko:"주차는 너가 생각하는 것 보다 쉬워.", en:"Parking is easier than you think."},
    {ko:"이 소식은 내가 들은 가장 놀라운 소식중에 하나야.", en:"This is one of the most shocking pieces of news I have ever heard."},
    {ko:"지영이는 한국에 가기로 결정했대.", en:"I heard Jiyoung decided to go back to Korea."},
    {ko:"그녀는 말레이시아에 산지 얼마나 됬지?", en:"How long has she been living here?"},
    {ko:"너의 아들이나 딸이 말레이시아 사람이랑 결혼해도 괜찮겠어?", en:"Would you be okay if your son or daughter moved abroad?"},
  
    {ko:"내가 여기서 기다려야 하나요?", en:"Should I wait here?"},
    {ko:"오래 걸릴까요?", en:"Will it take long?"},
    {ko:"주말동안에는 더 오래 걸릴거에요.", en:"It will take longer over the weekend."},
    {ko:"안녕하세요. 당신에 대해 말씀 많이 들었어요.", en:"Hi I have heard a lot about you."},
    {ko:"마찬가지에요. Amy가 엄청 좋게 말하던데요.", en:"Likewise. Amy spoke very highly of you."},
    {ko:"만나서 반가웠어요.", en:"It was nice meeting you."},
    {ko:"내가 컵을 끝까지 채워주길 원하세요?", en:"Do you want me to fill the cup to the top?"},
    {ko:"아니요. 반만 채워주세요. 그리고 제 샌드위치를 반으로 잘라주세요.", en:"No just half please. And please cut my sandwich in half."},
    {ko:"그랩페이로 낼 수 있나요?", en:"Can I pay with a card?"},
    {ko:"그랩페이 안 받아요. 현금만 받아요.", en:"We do not accept card payments. We only take cash."},
    {ko:"난 지금 현금이 없어요.", en:"I do not have any cash on me right now."},
    {ko:"ATM에 가셔서 현금을 찾아오세요.", en:"You can go to the ATM and withdraw some cash."},
    {ko:"현금으로만 내야해요? 그 방법 밖에는 없나요?", en:"Do I have to pay in cash? Is that the only option?"},
    {ko:"안타깝지만 그래요.", en:"Yes I am afraid so."},
    {ko:"나 그녀에게 전달했어요.", en:"I passed the message along to her."},
    {ko:"그녀는 너한테 아무것도 들은게 없다고 말했어요.", en:"She said she has not heard anything from you."},
    {ko:"내가 한번 더 확인해 볼께요. 내가 보냈는지.", en:"Let me double-check if I sent it."},
    {ko:"내가 이해한 바로는 그는 그녀에게 빠지지 않았어.", en:"From what I understand he is just not that into her."},
    {ko:"넌 그것에 관해서 어떻게 그렇게 확신할 수 있어?", en:"How can you be so sure about that?"},
    {ko:"딱 걔 같이 들린다. 그는 절대 한명으로 만족한 적이 없어.", en:"That sounds just like him. He has never been satisfied with just one person."},
    {ko:"저 토요일날 예약 취소하려고 전화했어요.", en:"I am calling to cancel my reservation for this Saturday."},
    {ko:"다른 날로 다시 예약 잡아드릴까요?", en:"Would you like to reschedule for another day?"},
    {ko:"다른 것 도와 드릴것이 있을까요?", en:"Is there anything else I can assist you with?"},
    {ko:"학교 보험 환급 절차에 관해서 물어볼게 있어서 연락드렸습니다.", en:"I am calling to inquire about the school insurance reimbursement process."},
    {ko:"담당자가 자리에 없는데 전화번호 남겨주시면 전화드리라고 할께요.", en:"The person in charge is not at their desk right now. If you leave your number I will have them call you back."},
    {ko:"이것 관련해서 누구와 이야기 해야하는지 알려주시겠어요?", en:"Could you tell me who I should speak with regarding this matter?"},
    {ko:"너가 하고 있는 프로모션 관련해서 물어볼게 있어서 연락드렸습니다.", en:"I am calling to ask about the promotion you are running."},
    {ko:"이 프로모션이 아직도 이용 가능한지 궁금합니다.", en:"I was wondering if this promotion is still available."},
    {ko:"저도 이 서비스 예약하고 싶은데 예약하는 걸 도와주시겠어요?", en:"I would like to book this service. Could you help me with the booking?"},
  
    {ko:"머리에 뭐 했어? 새로운 스타일 너무 좋다!", en:"Did you do something to your hair? I love the new look!"},
    {ko:"고마워, 그냥 새로 머리 좀 잘랐어.", en:"Thanks I just got a fresh cut."},
    {ko:"인터내셔널 데이 가?", en:"You going to International Day?"},
    {ko:"잠깐, 그거 필수임?", en:"Wait is it a must?"},
    {ko:"가야 되는지 잘 모름.", en:"I don't know if we even need to."},
    {ko:"어, 나 그냥 쨀래.", en:"Yeah I am gonna skip out."},
    {ko:"내가 널 먼저 만났으면 너랑 결혼했을지도 몰라.", en:"If we had met earlier things might have been different."},
    {ko:"지금 나랑 결혼할 수도 있었다는 소릴 하는 거야?", en:"Are you saying that things could have been different between us?"},
    {ko:"꿈 깨, 네가 백만장자라도 난 너랑 결혼 안 해.", en:"I wouldn't change my mind even if you offered me a million dollars."},
    {ko:"그녀가 언제 시간이 될지 확답을 모르겠네요.", en:"I am not sure when she will be available."},
    {ko:"그럼 제가 그녀가 금요일에 시간이 비는지 물어볼게요.", en:"Then I will inquire if she is free this Friday."},
    {ko:"그럼 금요일로 일정을 최종 확정 지읍시다.", en:"Let us finalize our appointment for Friday."},
    {ko:"알겠습니다. 일단 금요일로 스케줄을 잡아 놓을게요.", en:"Understood. I will pencil it in for Friday for now."},
  
    {ko:"말레이시아 사는것에 익숙해졌니?", en:"Have you gotten used to living here?"},
    {ko:"너의 아이가 미국으로 유학가고 싶다고 하면 뭐라고 이야기 할꺼니?", en:"What would you say if your child said they wanted to study abroad in the US?"},
    {ko:"다른 언어를 하나 더 말한다면, 어떤 언어를 말하고 싶니?", en:"If you could speak one more language which language would you want to speak?"},
    {ko:"마지막이 언제야 너가 너의 가족과 해외로 여행을 간 것은?", en:"When was the last time you traveled overseas with your family?"},
    {ko:"재미있었어? 내가 태국에 갔었을 때는 너무 더워서 나갈 수가 없었어.", en:"Was it fun? When I went to Thailand it was so hot that I couldn't go out."},
    {ko:"우리가 도착한 날 우리 시어머니가 돌아가셨어. 그래서 우리는 한국으로 바로 돌아왔었어야 했어.", en:"On the day we arrived my mother-in-law passed away. So we had to come back to Korea right away."},
    {ko:"나랑 남편한테는 처음이 아니었는데, 아이들한테는 태국을 여행한건 처음이었지.", en:"It wasn't the first time for my husband and me but it was the first time for the kids to travel to Thailand."},
    {ko:"난 너 보다 조금 더 컸으면 좋겠어.", en:"I wish I were a little taller than you."},
  
    {ko:"기분나쁘게 하려는 뜻은 아니였어.", en:"I didn't mean to hurt your feelings."},
    {ko:"그녀에게 물어보지 말았어야했어. 그건 너무 개인적인 거였어.", en:"I shouldn't have asked her that. It was way too personal."},
    {ko:"나는 사람들 나이 제일 먼저 물어보는게 익숙해. 근데 더 이상 하지 말아야해.", en:"I am used to asking people's age first but I really need to stop doing that."},
    {ko:"말레이시아 사람들은 와츠앱을 사용해요. 카카오톡을 사용하는데 익숙한데 이제 와츠앱을 사용하는데 익숙해져야겠어요.", en:"People here use WhatsApp. I am used to using KakaoTalk but now I need to get used to using WhatsApp."},
    {ko:"내가 아이폰을 사용한다고 해서 애플의 팬은 아니야. 난 그냥 아이폰 사용하는것에 익숙해.", en:"Just because I use an iPhone doesn't mean I am an Apple fan. I am just used to using an iPhone."},
    {ko:"너 약을 먹었어야해, 그럼 지금쯤 괜찮았을텐데.", en:"You should have taken the medicine. You would probably be feeling better by now."},
    {ko:"주식가격이 떨어졌어. 저번주에 팔아버렸어야 하는데.", en:"The stock price dropped. I should have sold it last week."},
    {ko:"그레이스는 뒤끝있어요. 내가 저번달에 결석을 하지 말았어야했어.", en:"Grace holds grudges. I really shouldn't have missed class last month."},
    {ko:"너가 오른쪽에서 운전하는것 감만 잡으면 엄청 쉽다고 느낄꺼야.", en:"Once you get the hang of driving on the right you will find it really easy."},
    {ko:"내가 아는한은 이것은 위험하다는 뜻이야.", en:"As far as I know it means this is dangerous."},
    {ko:"미안해 나 10분 늦을 것 같아. 너희들 먼저 주문해.", en:"Sorry I think I am going to be about 10 minutes late. Go ahead and order without me."},
    {ko:"그녀가 뒤에서 너 얘기 하고다녔는지 물어봐봐.", en:"Ask her if she was talking about you behind your back."},
    {ko:"우리 날짜좀 앞으로 옮겨도 될까?", en:"Can we move the date up a bit?"},
    {ko:"다음주 목요일이 우리 다 한테 괜찮은것 같아요.", en:"I think next Thursday works for all of us."},
    {ko:"대학교 1학년때 클럽 매일 가던 그런 시간이 있었어.", en:"There was a time in my freshman year when I went clubbing almost every day."},
  
    {ko:"나 화요일 아니면 목요일로 일정을 다시 잡고 싶어요.", en:"I would like to reschedule for either Tuesday or Thursday."},
    {ko:"나 말레이시아 처음 온 날 기억나. 완전 내 인생 최악의 날이었어.", en:"Do you remember the day I first moved abroad? It was literally the worst day of my life."},
    {ko:"너가 술을 끊었다고 말했잖아요. 마지막으로 맥주를 마신게 언제에요?", en:"You said you quit drinking right? When was the last time you had a beer?"},
    {ko:"베트남 음식 먹은거 처음이에요. 너무 맛있어요. 난 완전 또 먹을꺼에요.", en:"This is my first time trying Vietnamese food. It is so good. I am definitely having it again."},
    {ko:"나 김치 처음만들어 봤어요. 근데 꽤 맛있었어요. 쉐프가 됬었어야 했어.", en:"I made kimchi for the first time and it actually turned out pretty good. I should have become a chef."},
    {ko:"돈 다 사용했어. 버스카드 충전해야해.", en:"I used up all the money on my bus card. I need to top it up."},
    {ko:"드디어 2년 넘게 있었던 집에 있었던 모든 로보트들을 팔았어.", en:"I finally sold all the robots that had been sitting at home for over two years."},
    {ko:"우리는 케미가 없어. 그래서 할 말이 금방 없어져.", en:"We don't have chemistry so we run out of things to say pretty quickly."},
    {ko:"우리언니가 나이아가라를 처음 봤을때 그녀는 거대한 폭포에 놀랐어.", en:"When my sister saw Niagara Falls for the first time she was amazed by how huge it was."},
    {ko:"나는 항상 에어로라인을 타고 싱가폴을 가는데, 항상 옳아.", en:"I always take the bus service to Singapore. You can never go wrong with it."},
    {ko:"난 시험이 얼마나 어려웠었는지 몰라.", en:"I don't know how hard the test was."},
    {ko:"새로운 빌딩이 얼마나 높은지 알아?", en:"Do you know how tall the new building is?"},
    {ko:"어제 저녁에 얼마나 추웠는지 알아?", en:"Do you know how cold it was last night?"},
    {ko:"너 포르쉐가 얼마나 비싼지 알아?", en:"Do you know how expensive a Porsche is?"},
    {ko:"너 내일 미팅이 얼마나 할지 알아? 난 오래 있을 수 없는데.", en:"Do you know how long tomorrow's meeting will be? I can not stay long."},
    {ko:"여기서 싱가폴까지 얼마나 먼지 알아?", en:"Do you know how far it is from here to Singapore?"},
    {ko:"몰라 말레이시아에서 운전하는 것이 얼마나 어려운지.", en:"You don't know how hard it is to drive here."},
    {ko:"넌 불닭볶음면이 얼마나 매운지 모를 거야.", en:"You have no idea how spicy Buldak noodles are."},
    {ko:"왜 사람들이 말레이시아로 공부하러 오는지 알아?", en:"Do you know why people come abroad to study?"},
    {ko:"쥴리가 지갑 어디서 얼마주고 샀는지 알아?", en:"Do you know where Julie bought her wallet and how much she paid for it?"},
    {ko:"몰라 근데 나는 스칼렛이 가방을 얼마 주고 샀는지는 알아.", en:"I don't know but I do know how much Scarlett paid for her bag."},
    {ko:"말레이시아 무시하지마. 너 여기 오기만 하면 왜 사람들이 이렇게 좋아하는지 깨닫게 될꺼야.", en:"Don't underestimate here. Once you come here you will understand why people love it so much."},
    {ko:"넌 말레이시아 안 와보면 여기가 얼마나 좋은지 절대 몰라.", en:"You will never know how great it is unless you come here."},
  
    {ko:"나 기말고사 준비 다 됬어.", en:"I am all set for the final exam."},
    {ko:"나 인터뷰 준비 다 됬어.", en:"I am all set for the interview."},
    {ko:"나 떠날 준비 거의 다 됬어.", en:"I am almost set to go."},
    {ko:"모든게 예약됬어. 우리 출발할 준비 다 됬어.", en:"Everything is booked. We are all set to go."},
    {ko:"나 아직 준비 안됬어 왜냐면 티켓을 아직 사지 않았거든.", en:"I am not all set yet because I still haven't bought the tickets."},
    {ko:"나 인내심이 다 떨어져 가.", en:"I am running out of patience."},
    {ko:"나 캐리어 공간이 다 떨어져 가.", en:"I am running out of space in my suitcase."},
    {ko:"우리 음식 다 떨어졌어.", en:"We have run out of food."},
    {ko:"우리 아이디어 다 떨어졌어.", en:"We have run out of ideas."},
    {ko:"나 시간이 다 됬어.", en:"I have run out of time."},
    {ko:"우리 연료 다 됬어.", en:"We have run out of fuel."},
    {ko:"나는 변명이 다 떨어졌어.", en:"I have run out of excuses."},
    {ko:"우리 한국 드라마 다 봤어.", en:"We have run out of Korean dramas to watch."},
    {ko:"나 어제 인내심이 다 됐어.", en:"I ran out of patience yesterday."},
    {ko:"우리 어제 연료가 다 됐어.", en:"We ran out of fuel yesterday."},
    {ko:"나는 변명이 다 됐어.", en:"I ran out of excuses."},
    {ko:"우리 케찹이 다 떨어졌어.", en:"We ran out of ketchup."},
  
    {ko:"나 한국 음식 먹어본 적이 없어. 어디서 먹어볼 수 있는지 알아?", en:"I have never tried Korean food before. Do you know where I can try some?"},
    {ko:"나 원숭이 야생에서 직접 본 적 없어. 도대체 어디서 볼 수 있는거야?", en:"I have never seen a monkey in the wild. Where on earth can I find one?"},
    {ko:"나 말레이시아 오기 전에 두리안 먹어본 적이 없었어.", en:"I had never tried durian before I came abroad."},
    {ko:"나 너 만나기 전에 한국 음식 먹어본 적이 없었어.", en:"I had never tried Korean food before I met you."},
    {ko:"나 이 수업에 오기 전에 영어 배운 적이 없었어.", en:"I had never studied English before I came to this class."},
    {ko:"나 말레이시아 오기 전에 열대과일 먹어본 적이 없었어.", en:"I had never eaten tropical fruits before I moved abroad."},
    {ko:"다이어트 중인데 오늘 치킨을 거의 다 먹어버렸어. 의지력이 없나봐.", en:"I am on a diet but I ate almost an entire chicken today. I have no willpower."},
    {ko:"그 영화를 끝까지 거의 보지 않았어. 너무 지루해서 꺼버렸어.", en:"I barely made it through that movie. It was so boring I turned it off."},
    {ko:"나는 스타벅스를 거의 안 마셔. 커피값이 너무 비싸거든.", en:"I barely drink Starbucks. The coffee is just too expensive."},
    {ko:"우리 아들은 채소를 거의 먹지 않아. 매일 닭고기랑 밥만 먹어.", en:"My son barely eats vegetables. He just has chicken and rice every day."},
    {ko:"한국에서는 현금을 거의 안 써. 카드를 거의 다 써.", en:"In Korea people barely use cash. They almost always pay by card."},
    {ko:"그 영화 보다가 거의 잠들 뻔했어. 정말 너무 지루했어.", en:"I almost fell asleep during the movie. It was just so boring."},
    {ko:"거의 지각할 뻔했어. 다음부터 더 일찍 나와야겠어.", en:"I almost missed it. I need to leave earlier next time."},
    {ko:"그녀는 비밀을 거의 말할 뻔했어. 다행히 제때 멈췄어.", en:"She almost spilled the secret. Luckily she stopped herself just in time."},
    {ko:"아직도 잊지 못한 식당이 있어. 거기는 정말 너무 맛있었어.", en:"There is still a restaurant I have not been able to forget. The food there was just incredible."},
    {ko:"아직도 그 순간을 잊지 못해. 정말 내 인생에서 가장 행복한 순간 중 하나야.", en:"I still have not forgotten that moment. It was truly one of the happiest moments of my life."},
    {ko:"아직도 그가 한 말이 잊혀지지 않아. 정말 상처가 됐어.", en:"I still have not been able to forget what he said. It really hurt."},
    {ko:"드디어 집을 다 정리했어. 이사한 지 한 달도 넘었는데 이제야 집 같은 느낌이 나.", en:"I have finally finished setting up the house. It has been over a month since I moved in and it finally feels like home."},
    {ko:"나 드디어 운전면허 땄어! 첫 번째 시도에서는 떨어졌는데 두 번째에서는 합격했어.", en:"I finally got my driver's license. I failed the first time but I passed on the second try."},
    {ko:"드디어 영어로 말하는 게 자연스러워졌어. 처음에는 너무 어색했는데.", en:"I have finally started to feel natural speaking in English. It felt so awkward at first."},
  
    {ko:"넌 알아? 지금 말레이시아가 몇시인지?", en:"Do you know what time it is here right now?"},
    {ko:"모든 사람들은 본인만의 경주를 뛰고 있는 중이에요. 그들만의 시간 안에서.", en:"Everyone is running their own race on their own timeline."},
    {ko:"세상의 모든 사람들은 그들의 시간대를 기반으로 일하고 있어요.", en:"Everyone in the world is working on their own timeline."},
    {ko:"그냥 접촉사고 였어요. 심각한건 아니였어요.", en:"It was just a minor fender bender. It wasn't anything serious."},
    {ko:"내가 지난 주에 영화를 봤는데 너는 꼭 봐야해. 실화 바탕의 영화인데 너 실화 영화 좋아하잖아.", en:"I watched a movie last week and you have to see it. It is based on a true story and I know you like movies like that."},
    {ko:"볼 만한 가치가 있어. 넌 놓치면 안돼. 우리는 영화 취향이 비슷하잖아.", en:"It is definitely worth watching. You should not miss it. I highly recommend it because we have similar taste in movies."},
    {ko:"알았어 내일 볼께. 재밌어야 할꺼야. 아이맥스 티켓이 거의 두배잖아.", en:"Okay I will watch it tomorrow. It better be good because an IMAX ticket is almost twice the price."},
    {ko:"나는 너무 위로 받았어 우리 남편이 여기 있는 동안에.", en:"I felt so comforted while my husband was here. Being with him is such a comfort."},
    {ko:"내 생각에는 너는 여전히 그의 지지와 위로가 필요한 것 같아.", en:"I think you still need his support and comfort."},
    {ko:"그는 나를 편안하게 해주고 모든게 좋아질꺼라고 말해줬어요.", en:"He makes me feel at ease and tells me everything will be okay."},
    {ko:"고마워 너가 방금 말한게 나한테 진짜 위로가 됬어.", en:"Thank you. What you just said really comforted me."},
    {ko:"너는 생활비랑 학비를 고려해야해.", en:"You need to take the cost of living and school tuition into account."},
    {ko:"키미는 남편이 혼자 한국에 있는 것이 걱정이래. 너도 남편이 거기 혼자 있어서 걱정 되?", en:"Kimi is worried about her husband being alone in Korea. Are you also worried about your husband being there by himself?"},
  ],
  5: [
    {ko:"그래서 30분을 차에 갇혀있었어. 기다리게 해서 미안해. 새벽 5시에 나와야 했나봐.", en:"So I ended up stuck in my car for 30 minutes. I am so sorry for keeping you waiting. I guess I should have left the house at 5 AM."},
    {ko:"말레이시아 사람들은 와츠앱을 사용해요. 나는 카카오톡을 사용하는데 익숙한데 이제 와츠앱을 사용하는데 익숙해져야겠어요.", en:"Locals here mostly use WhatsApp. I am so used to KakaoTalk, but I guess it is time for me to get used to using WhatsApp now."},
    {ko:"몽키아라의 길은 좁고 많은 차들로 항상 붐벼요.", en:"The roads in our neighborhood are narrow and always gridlocked with heavy traffic."},
    {ko:"대학교 1학년때 클럽 매일 가던 그런 시간이 있었어.", en:"There was a time during my freshman year when I used to go clubbing every single day."},
    {ko:"이 주식 팔기만 하면 하남돼지집에 데려갈께.", en:"The moment I cash out this stock, I am taking you out for a treat at a Korean BBQ restaurant."},
    {ko:"그녀가 늦은게 이번이 처음이 아니야. 이번이 다섯번째야. 그녀를 절대안 만날꺼야.", en:"This is not even the first time she is late. It is the fifth. I am officially cutting her off."},
    {ko:"그만 지적해. 지겨워 죽겠어.", en:"Stop nitpicking already. I am sick and tired of it."},
    {ko:"나 어제 야생 원숭이 봤어 처음으로. 너무 무서웠어.", en:"I spotted a wild monkey for the first time yesterday, and it honestly scared the life out of me."},
    {ko:"넌 말레이시아 안 와보면 여기가 얼마나 좋은지 절대 몰라.", en:"Unless you visit here in person, you will never truly appreciate how amazing of a place it is."},
    {ko:"너의 증상이 계속 되나요 아니면 왔다갔다 하나요?", en:"Are your symptoms constant, or do they tend to come and go on and off?"},
    {ko:"나 오는길에 사고가 났어요. 교통체증에 30분 갇혀있었어요. 다행히도 아무도 안 다쳤대요.", en:"On my way here, an accident happened right in front of Plaza our neighborhood, leaving me stuck in gridlock traffic for 30 minutes. Thankfully, nobody was hurt."},
    {ko:"들었어? 말레이시아에서 차 사고가 있었는데, 차랑 호랑이가 부딪혔대.", en:"Did you hear? There was a bizarre car accident here where a vehicle hit a wild tiger."},
    {ko:"내가 트럭 뒤에 있었는데, 트럭이 후진해서 오는거에요. 결국에 내 차 옆부분을 박았어요.", en:"I was positioned right behind a truck when it suddenly started reversing toward me. It ended up sideswiping my car."},
    {ko:"내가 깜빡이 없이 우회전 하다가 오토바이를 쳤어요. 깜빡이를 켰었어야 하는데.", en:"I made a right turn without using my indicator and accidentally clipped a motorbike. I really should have used my turn signal."},
    {ko:"길 옆으로 차를 세우세요. 나 지금 너무 바빠서 빨리 가봐야 해요. 이거 내 연락처니깐 무슨일 있으면 메시지 남겨주세요.", en:"Please pull your car over to the side. I am in a huge rush right now, so here is my contact info. Just shoot me a text if anything comes up."},
    {ko:"내 친구가 자기 선을 따라서 쭉 가고 있었는데, 옆에 차가 자꾸 자기 선을 안 지키더니 결국에는 옆에 차를 긁었대.", en:"My friend was driving straight in her own lane, but the car next to her kept drifting out of bounds and eventually scraped the side of her car."},
    {ko:"여유 공간이 없는데 막 끼어들더니 결국에 내 차 앞 범퍼를 박았어. 다행히 내가 블랙박스가 있어서.", en:"He aggressively cut in even though there was barely any room, and ended up hitting my front bumper. Thankfully, I caught the whole thing on my dashcam."},
    {ko:"브래드피트랑 탐 크루즈가 나오고. 스토리는 별거 없는데, 끝에 반전이 있어.", en:"It stars Brad Pitt and Tom Cruise. The plot itself is nothing special, but there is a crazy plot twist at the end."},
    {ko:"볼 만한 가치가 있지. 넌 놓치면 안되. 너한테 완전 강추해. 우리는 영화 취향이 비슷하잖아.", en:"It is totally worth watching. You definitely should not miss out on it. I highly recommend it since we have identical tastes in movies."},
    {ko:"후회 안 할꺼야. 난 확실해 너가 완전 좋아할꺼야.", en:"You will not regret it. I am absolutely positive you are going to love it."},
    {ko:"모든 사람들은 본인만의 경주를 뛰고 있는 중이에요. 그들만의 시간 안에서.", en:"At the end of the day, everyone is running their own race, entirely in their own time zone."},
    {ko:"그녀가 우리의 약속을 잊어버린거야. 이런 일이 지속되서 일어나서 난 그녀를 손절했어.", en:"She completely forgot about our plans. Since this has become a recurring pattern, I decided it was time to cut ties with her."},
    {ko:"그녀가 늦는것이 지겨워, 근데 제일 싫은건 막판에 약속을 취소하는거야.", en:"I am sick and tired of her constantly running late, but my biggest pet peeve is when she cancels at the very last minute."},
    {ko:"너는 매일 30분씩 30일동안 운동해봐. 이 달 말 안에 너의 몸매가 달라진걸 알아차릴꺼야.", en:"If you challenge yourself to work out for 30 minutes every single day for a month, you will notice a massive transformation in your body shape by the end of the month."},
    {ko:"어떤 도시를 방문하려고 하는거야? 결정하면 나한테 말해. 내가 여행 계획 하는데 도움을 줄께.", en:"Which city are you planning to visit? Once you make up your mind, let me know so I can give you some useful tips and help you map out your itinerary."},
    {ko:"17살은 너무 어려 운전하기에. 게다가 말레이시아에서 운전하는것은 위험해.", en:"17 is way too young to drive. Plus, driving abroad can feel very different at first. You know how it is with so many motorbikes on the road."},
    {ko:"나도 너의 말에 동의해, 내가 그를 설득해야겠다. 운전을 하지 못하도록.", en:"I totally agree with you. I will have to talk him out of driving for now."},
    {ko:"문제는 내 친척집이 우리 식구가 머물기에 충분히 크지 않아. 그래서 아마 우리는 호텔에서 머물러야 할 것 같아.", en:"The only issue is that my relatives place is not spacious enough to accommodate my entire family. So we will probably have to put up at a hotel."},
    {ko:"나는 몇일전에 컴퓨터를 샀어요. 근처 apple store에서.", en:"I actually bought a new computer a few days ago, directly from the Apple Store."},
    {ko:"요새 마이딘에서 컴퓨터 세일 하던데. 같이 가 볼래? 얼마나 많은 사람이 올까?", en:"I noticed that Mydin is having a huge clearance sale on computers lately. Want to go check it out? I wonder how crowded it is going to be."},
    {ko:"이런 경험은 처음이야. 내가 어떻게 헤쳐 나가야 할까?", en:"This is uncharted territory for me. I am not quite sure how I should navigate through this situation."},
    {ko:"나 너 많은 곳 가본 것 알아. 어디가 너 생각에는 가장 살기 좋은 도시야?", en:"I know you have been all over the world. Which city do you think is honestly the most livable?"},
    {ko:"내가 이 주식 팔기만 하면 밤부힐에 하남돼지집에 데려갈께.", en:"The moment I cash out this stock, I am taking you out for a treat at a Korean BBQ restaurant in the mall."},
    {ko:"그녀는 그런 일을 겪은 적이 없어, 너는 그녀로부터 조언을 받으면 안되.", en:"She has never been through anything like that, so you probably should not take advice from her."},
    {ko:"나 말레이시아 처음 온 날 기억나. 완전 내 인생 최악의 날이었어.", en:"I still vividly remember my very first day living abroad. It was hands down the absolute worst day of my life."},
    {ko:"EJ가 나를 다오래에 데려간 후부터, 나는 다오래를 거의 매일가. 애초에 알지를 말았어야해.", en:"Ever since EJ took me to a Korean BBQ place, I go there almost every day. I should not have known about it in the first place."},
    {ko:"대한항공 항공권이 다 팔렸대. 에어아시아 타야해. 미리 예약할껄. 난 절대 에어아시아에 익숙해질 수 없어.", en:"Korean Air is fully booked, so I have to fly AirAsia. I should have booked in advance. I will never get used to AirAsia. It is so uncomfortable."},
    {ko:"에어아시아에 익숙해져봐. 잠들면 이게 대한항공 first class인지, 에어아시아인지 몰라.", en:"Just get used to AirAsia. Once you fall asleep, you will not even know if it is Korean Air first class or AirAsia."},
    {ko:"나는 그녀를 위로하기위해 최선을 다했어요.", en:"I did everything within my power to comfort her and cheer her up."},
    {ko:"너는 그녀가 고쳤으면 하는 것에 관해 얘기해야해, 친구관계를 유지하고 싶으면.", en:"You need to have an open conversation about the things you would like her to fix if you genuinely want to salvage this friendship."},
    {ko:"법적운전가능한 나이는 17살이래. 그래서 우리 아들이 어제 차를 빌려 달라고 묻는거야.", en:"I heard the legal driving age here is 17. That is why my son asked to borrow my car yesterday."},
  
    {ko:"난 처음에는 사람의 겉모습에 매력을 느끼는 경향이 있는데, 한번 얘기를 시작해 보면 더 가까워지길 원하는지 바로 알아.", en:"I tend to be attracted to looks at first but once we start talking I instantly know whether I want to get closer to them or not."},
    {ko:"난 그가 말하는 방식이 좋아. 특히 그의 목소리가 너무 좋아. 그는 성우를 했었어야해.", en:"I love the way he talks. Especially his voice it is amazing. He should have been a voice actor."},
    {ko:"내가 아는 한 a 하이웨이를 타면 너를 적어도 20분 빨리 도착할 수 있게 이끌어 줄꺼에요.", en:"As far as I know taking Highway A will get you there at least 20 minutes faster."},
    {ko:"말도 안되. 나 그 길 알아요. 몽키아라 끝까지 가서 가야하잖아요. 난 확실해요 더 오래 걸릴거에요.", en:"No way. I know that route. You have to go all the way to the end of our neighborhood. I am sure it will take longer."},
    {ko:"TRX가 슈퍼 럭셔리 브랜드가 있다면 미드밸리는 middle class brand가 있어. 내가 골라야 한다면 나는 미드밸리 갈꺼야.", en:"TRX has super luxury brands while Mid Valley has mid-range brands. If I had to choose I would go to Mid Valley."},
    {ko:"내가 TRX에서 어떤 여자를 봤는데 머리끝에서 발끝까지 샤넬을 입었더라고. 그녀는 내 나이 또래였어.", en:"I saw a woman at TRX who was dressed in Chanel from head to toe. She looked about my age."},
    {ko:"그녀의 집은 완전 깨끗해서 내가 왜 이렇게 깨끗하냐고 물으니 밤 낮으로 청소한대.", en:"Her place was so spotless that I asked how it stays so clean and she said she cleans day and night."},
    {ko:"내 친구가 TRX 오늘부터 세일 한다고 나한테 말해줬어. 내가 어제 알았으면 오늘 갔을껄.", en:"My friend told me TRX is having a sale starting today. If I had known yesterday I would have gone today."},
    {ko:"친구가 TRX 저번 주에 세일 한다고 했는데 어제 끝났대. 진작 알았으면 가 봤을 텐데.", en:"My friend said TRX was having a sale last week but it ended yesterday. If I had known sooner I would have checked it out."},
    {ko:"친구가 말레이시아에 오면 너의 집에서 머물게 해 줄꺼야?", en:"If your friend comes abroad would you let them stay at your place?"},
    {ko:"나의 부동산 중개업자가 집 값이 오를 것이라는 거야. 이렇게 떨어질 줄 알았다면 나는 사지 않았을 텐데.", en:"My realtor said house prices would go up. If I had known they would drop like this I would never have bought it."},
    {ko:"나의 전 남자친구가 나랑 항상 결혼 한다고 말했어. 내가 바람만 피지 않았다면 그와 결혼 했을 텐데.", en:"My ex-boyfriend and I broke up a long time ago. If things had been different we might have stayed together."},
    {ko:"집주인이 나를 한 달 더 머물게 안 할 이유가 없어. 왜냐면 렌트비가 최근에 내렸거든.", en:"There is no reason for my landlord not to let me stay another month since rent prices have dropped recently."},
    {ko:"같은 조건과 가격 이라면 난 더 큰 집에 살겠어.", en:"All else being equal in terms of condition and price I would choose the bigger house."},
    {ko:"그는 말이 많지는 않지만 우리는 계속 대화를 이어나갈 수 있어. 대화가 잘 흘러가.", en:"He does not talk much but we keep the conversation going smoothly. It just flows."},
    {ko:"지금 까지 난 그게 제일 빠른 길 인줄 알았어요.", en:"Up until now I thought that was the fastest way."},
    {ko:"나도 잘 모르겠어 집주인이 계약을 한달 연장 해줄 지 안 해줄지는.", en:"I am not sure if my landlord will extend the lease for another month."},
  
    {ko:"삼성은 더이상 1위 회사가 아니야.", en:"Samsung is no longer the number one company."},
    {ko:"삼성 주식은 더이상 가지고 있을 가치가 없어.", en:"Samsung stock is no longer worth holding onto."},
    {ko:"너 생각에는 이재용과 관련이 있는 것 같아?", en:"Do you think it has to do with Jay Y. Lee?"},
    {ko:"나는 이재용의 경영과 많은 관련이 있는것 같아.", en:"I think it has a lot to do with his management."},
    {ko:"옆집 사람들 싸우는 소리 들었어? 너무 시끄러워서 잠을 못잤어.", en:"Did you hear the neighbors fighting? It was so loud I could not sleep."},
    {ko:"내가 자세히 들어봤는데. 자식 교육 문제로 싸우는 것 같이 들리더라고.", en:"I listened closely and it sounded like they were arguing over their kids education."},
    {ko:"남편은 한국에 가길 원하고, 반면에 와이프는 여기 머물면서 자식 교육을 끝내길 원하더라고.", en:"The husband wants to go back to Korea while the wife wants to stay here and have the kids finish their education."},
    {ko:"완전 이해된다. 이건 환율이랑 많이 관련 있는것 같아.", en:"I totally get it. I think this has a lot to do with the exchange rate."},
    {ko:"말레이시아 링깃이 최근 많이 올랐고 이건 아마 그들의 결정에 영향을 미쳤을꺼야.", en:"The local currency has gone up a lot recently and that probably influenced their decision."},
    {ko:"사실 이건 우리 모두의 문제야. 나는 한국 원화가 일본 엔화만큼 낮아질까 걱정이야.", en:"Honestly this is a problem for all of us. I am worried the Korean Won will drop as low as the Japanese Yen."},
    {ko:"아무리 원화가 떨어져도 일본 엔화만큼 낮아지진 않을꺼야.", en:"No matter how much it drops it will not go as low as the Japanese Yen."},
    {ko:"내 생각에는 최근 계엄이 영부인 김건희 여사랑 관련된 것 같아.", en:"I think the recent martial law has something to do with the First Lady Kim Keon-hee."},
    {ko:"왜 그게 관련있다고 생각하게 되었어?", en:"What makes you think it is connected to that?"},
    {ko:"그는 김이 아마 곧 체포되게 될까봐 두려운것 같아.", en:"I think he is terrified that Kim might get arrested soon."},
    {ko:"난 윤에 투표했는데 뽑지 말았어야해. 이재명을 선택 했어야했어.", en:"I voted for Yoon but I should not have. I should have gone with Lee Jae-myung."},
    {ko:"나도 이가 더 낫다고 생각했었는데 이도 윤만큼 나빠.", en:"I used to think Lee was better too but he is just as bad as Yoon."},
    {ko:"내 생각에는 윤이 곧 탄핵될 것 같아.", en:"I think Yoon will be impeached soon."},
    {ko:"왜 1000 링깃이 공제되어졌는지 명확히 밝혀 줄 수 있나요?", en:"Could you clarify why 1000 Ringgit was deducted?"},
    {ko:"난 그 문제점은 이미 명확히 해결 됬다고 생각했는데.", en:"I thought that issue was already cleared up."},
    {ko:"아직 지불되지 않은 유틸리티 발란스가 있었고 의자들도 교체 되어져야 해요.", en:"There was an outstanding utility balance and the chairs needed to be replaced."},
    {ko:"만약 너가 해명이 더 필요하면 알려줘요. 내가 인보이스랑 영수증이랑 첨부할께요.", en:"If you need further clarification let me know. I will attach the invoices and receipts."},
    {ko:"남편이랑 얼마나 자주 통화 하는지?", en:"How often do you talk on the phone with your husband?"},
    {ko:"어떤 종류의 김치를 넌 만들 수 있어?", en:"What kind of Kimchi can you make?"},
  
    {ko:"헤어스타일에 변화를 주셨나요? 아주 잘 어울리십니다.", en:"Have you altered your hairstyle? It suits you very well."},
    {ko:"감사합니다. 최근에 스타일링을 새로 받았습니다.", en:"Thank you. I recently had it styled."},
    {ko:"이번 인터내셔널 데이에 참석하십니까?", en:"Will you be attending the upcoming International Day?"},
    {ko:"저희의 참석이 요구되는 사항인가요?", en:"Is our presence requested?"},
    {ko:"참석이 의무적인지 불확실합니다.", en:"I am uncertain whether our attendance is compulsory."},
    {ko:"개인적으로는 참석하지 않을 계획입니다.", en:"Personally I intend to decline."},
    {ko:"오랜만입니다. 한동안 뵙지 못했군요.", en:"It has been a long time. I have not seen you for quite a while."},
    {ko:"가디언 비자 갱신 절차로 분주했습니다.", en:"I have been occupied with the renewal process of my residency visa."},
    {ko:"매년 그 과정을 거쳐야 하는 것은 매우 번거로운 일입니다.", en:"Having to undergo that process annually is highly frustrating."},
    {ko:"문제는 6주가 경과했음에도 아직 통보를 받지 못했다는 점입니다.", en:"The issue is that six weeks have elapsed and I have received no notification yet."},
    {ko:"비자 대행사 측에 진행 상황을 확인해 보실 것을 권장합니다.", en:"I recommend that you verify the progress with your visa agent."},
  
    {ko:"나 일찍 올 수 있었는데, 오는길에 도로에 차 사고가 있었어. 그래서 30분을 차에 갇혀있었어. 기다리게 해서 미안해.", en:"I could have gotten here earlier but there was an accident on the way so I was stuck in traffic for 30 minutes. Sorry for keeping you waiting."},
    {ko:"나는 운전을 밤에 했었는데 이제 안해. 우리 남편은 내가 밤에 운전을 하지 않았으면 좋겠다고 해요.", en:"I used to drive at night but I don't anymore because my husband doesn't want me driving at night."},
    {ko:"EJ가 나를 다오래에 데려간 후부터, 나는 다오래를 거의 매일가. 애초에 알지를 말았어야해.", en:"Ever since EJ took me to a Korean BBQ place I have been going there almost every day. I should never have found out about that place."},
    {ko:"우리 점심약속 2틀만 땡기면 안될까? 나는 다음주 화요일 수요일 다 되는데 어떤날이 괜찮은지 알려줘.", en:"Could we move our lunch up by two days? I am free next Tuesday or Wednesday so let me know which day works best for you."},
  
    {ko:"그녀가 늦은게 이번이 처음이 아니야. 이번이 다섯번째야. 그녀를 절대안 만날꺼야.", en:"This is not the first time she has been late. It is the fifth time. I am never meeting her again."},
    {ko:"대한항공 항공권이 다 팔렸대. 에어아시아 타야해. 미리 예약할껄.", en:"Korean Air tickets are all sold out so I have to fly AirAsia. I should have booked earlier."},
    {ko:"에어아시아에 익숙해져봐. 너가 잠들면 몰라 이게 대한항공 퍼스트 클래스인지 에어아시아인지.", en:"Try to get used to AirAsia. Once you fall asleep you won't know whether you are on Korean Air first class or AirAsia."},
    {ko:"나도 한번도 가본적이 없어서 몰라. 내가 아는한 여기서 조호바루까지는 4시간 걸려.", en:"I don't know because I have never been there either. As far as I know it takes about four hours from here to Johor Bahru."},
    {ko:"나 불닭볶음면 한번도 먹어본 적이 없어. 먹어봤어? 나 얼마나 매운지 알고싶어.", en:"I have never tried Buldak noodles. Have you? How spicy are they? I want to know how spicy they are."},
    {ko:"무엇이 주된 문제인가요?", en:"What is your main concern?"},
    {ko:"어떤 느낌인가요?", en:"What does it feel like?"},
    {ko:"언제 시작 되었나요?", en:"When did it start?"},
    {ko:"얼마나 됬나요?", en:"How long has this been going on?"},
  
    {ko:"줄리는 말레이시아 오기 전에 한 번도 해외에서 살아본 적이 없었어. 처음에는 완전 힘들었겠다.", en:"Julie had never lived abroad before she came abroad. It must have been really tough at first."},
    {ko:"내가 말레이시아에 오기 전에는 두리안을 한번도 먹어본 적이 없었는데 이제는 매주 먹어.", en:"I had never eaten durian before I came abroad but now I eat it every week."},
    {ko:"나 오늘 길에서 넘어질 뻔했어. 누가 바나나 껍질을 길에 버려놨더라고. 미끄러지는 순간 누군가가 나를 잡아줬어.", en:"I almost fell on the street today. Someone had left a banana peel on the ground and just as I slipped someone caught me."},
    {ko:"10년이 지났는데도 아직도 그 식당 생각이 나. 언젠가 꼭 다시 가야지.", en:"It has been ten years and I still have not forgotten that restaurant. I really have to go back someday."},
    {ko:"드디어 말레이시아 운전 면허증을 땄어. 한국에서 살던 동안에는 운전 할 필요가 없었는데 여기서는 차 없이는 아무데도 못 가더라고.", en:"I finally got my local driver's license. I never needed to drive when I was living in Korea but here you just can not go anywhere without a car."},
  
    {ko:"나 오는길에 플라자 몽키아라 앞에서 사고가 났어요. 교통체증에 30분 갇혀있었어요. 오토바이랑 SUV랑 충돌했는데 다행히 아무도 안 다쳤대요.", en:"There was an accident in front of Plaza our neighborhood on my way here so I was stuck in traffic for 30 minutes. I heard a motorcycle and an SUV collided. Thankfully no one was hurt."},
    {ko:"들었어? 말레이시아에서 차랑 호랑이가 부딪혔대. 웃긴건 이런일이 꽤 있대.", en:"Did you hear? There was a car accident here where a car hit a tiger. The funny thing is apparently this happens pretty often."},
    {ko:"내가 트럭 뒤에 있었는데 트럭이 후진해서 오더니 결국 내 차 옆부분을 박았어요.", en:"I was behind a truck and it started backing up toward me. I honked but it kept coming and eventually hit the side of my car."},
    {ko:"내가 깜빡이 없이 우회전 하다가 오토바이를 쳤어요. 깜빡이를 켰었어야 하는데.", en:"I hit a motorcycle while turning right without signaling. I should have used my turn signal."},
    {ko:"길 옆으로 차를 세우세요. 나 지금 바빠서 빨리 가봐야 해요. 내 연락처니깐 무슨일 있으면 메시지 남겨주세요.", en:"Please pull over to the side of the road. I am really busy right now. Here is my contact information so please message me if anything comes up."},
    {ko:"내 친구가 자기 선을 따라서 가고 있었는데 옆 차가 자꾸 선을 안 지키더니 결국 내 친구 차 옆을 긁었대.", en:"My friend was staying in her lane but the car next to her kept drifting out and eventually scraped the side of her car."},
    {ko:"여유 공간이 없는데 막 끼어들더니 내 차 앞 범퍼를 박았어. 다행히 블랙박스가 있어서 경찰서에 제출했어.", en:"There wasn't enough space but he cut in anyway and hit my front bumper. Luckily I had dashcam footage so I submitted it to the police station."},
    {ko:"브래드피트랑 탐 크루즈가 나오고 또 익숙한 얼굴인데 이름이 생각이 안나. 스토리는 별거 없는데 끝에 반전이 있어.", en:"Brad Pitt and Tom Cruise are in it and there is another familiar face but I can not remember their name. The story is not anything special but there is a twist at the end."},
  
    {ko:"이 프로젝트의 예산이 빡빡해서 우리가 어디서 비용을 절감할 수 있는지 알아봐야 할 것 같아요.", en:"The budget for this project is tight so we need to figure out where we can cut costs."},
    {ko:"어제 발표가 정말 인상적이었어요. 어떻게 그렇게 짧은 시간 안에 준비했어요?", en:"The presentation yesterday was really impressive. How did you manage to put it together in such a short amount of time?"},
    {ko:"우리 팀이 마감 기한을 맞추려고 엄청 고생하고 있어요. 추가 지원이 필요할 수도 있을 것 같아요.", en:"Our team is really struggling to meet the deadline. We might need some additional support."},
    {ko:"이 계약이 확정되면 우리 회사에 엄청난 기회가 될 것 같아요.", en:"If this contract goes through it will be a huge opportunity for our company."},
    {ko:"요즘 업무량이 너무 많아서 번아웃이 올 것 같아요. 잠깐 쉬어야 할 것 같아요.", en:"The workload has been so heavy lately that I feel like I am heading toward burnout. I think I need to take a break."},
  
    {ko:"말레이시아에서 운전하는 것이 처음에는 정말 어려웠어. 특히 도로 표지판이 영어랑 말레이어가 섞여 있어서 헷갈렸어.", en:"Driving in a new place was really hard at first. Especially because the road signs were different from what I was used to."},
    {ko:"이 근처에 좋은 한국 식당이 있는데 거기 불고기가 한국에서 먹던 것보다 더 맛있어. 어떻게 이게 가능한지 모르겠어.", en:"There is a great Korean restaurant near here and their bulgogi is actually better than what I had in Korea. I have no idea how that is possible."},
    {ko:"말레이시아에서 살다 보니까 영어가 얼마나 중요한지 새삼 느껴. 여기서는 영어를 못 하면 정말 아무것도 못 해.", en:"Living here has made me realize just how important English is. Here if you can not speak English you really can not do anything."},
    {ko:"나 드디어 가디언 비자 받았어. 비자 에이전트가 서류 다 챙겨줘서 생각보다 훨씬 빨리 됐어. 진작 에이전트 쓸 걸 그랬어.", en:"I finally got my residency visa. The visa agent handled all the documents so it was done much faster than I expected. I should have used an agent from the beginning."},
    {ko:"우리 아이 학교에서 인터내셔널 데이가 있었는데 각 나라 전통 의상을 입고 오라고 했어. 한복을 챙겨오길 잘했다고 생각했어.", en:"Our school had an International Day where they asked everyone to wear their country's traditional clothing. I was glad I brought my hanbok."},
    {ko:"말레이시아 음식은 처음에 너무 매워서 못 먹겠다고 생각했는데 지금은 없으면 섭섭할 정도로 좋아졌어.", en:"At first I thought local food was too spicy and I could not eat it but now I would actually miss it if it was gone."},
    {ko:"몽키아라에 새로 생긴 카페가 있는데 거기 분위기가 너무 좋아서 공부하거나 미팅 할 때 자주 가. 커피도 맛있고.", en:"There is a new cafe in our neighborhood and the atmosphere is so nice that I often go there to study or have meetings. The coffee is good too."},
    {ko:"말레이시아에 온 지 벌써 2년이 됐는데 아직도 가끔 한국 음식이 너무 그리워. 특히 찌개 종류가 제일 보고 싶어.", en:"It has already been two years since I came abroad but I still sometimes really miss Korean food. Especially jjigae."},
    {ko:"요즘 말레이시아 물가가 많이 올랐어. 예전에는 여기가 한국보다 훨씬 싸다고 했는데 이제는 그 차이가 별로 안 나는 것 같아.", en:"The cost of living here has gone up a lot lately. People used to say it was much cheaper than Korea but now the difference does not seem that big anymore."},
    {ko:"아이들이 여기서 외국 친구들이랑 놀다 보니까 영어 실력이 정말 빠르게 늘더라고. 역시 환경이 제일 중요한 것 같아.", en:"Since the kids have been playing with foreign friends here their English has improved really quickly. It just goes to show that environment is what matters most."},
  
    {ko:"말레이시아에서 살면서 제일 힘든 건 가족들이랑 멀리 떨어져 있다는 거야. 특히 명절이 되면 더 그리워.", en:"The hardest part about living here is being far from my family. I miss them even more during the holidays."},
    {ko:"여기 와서 영어를 쓸 기회가 많아져서 좋긴 한데 아직도 영어로 감정을 표현하는 게 어려워.", en:"It is great that I have more opportunities to use English here but I still find it hard to express my emotions in English."},
    {ko:"말레이시아에서 운전하는 게 이제 좀 익숙해졌는데 아직도 고속도로 진입할 때는 긴장돼.", en:"I have gotten somewhat used to driving here but I still get nervous when merging onto the highway."},
    {ko:"우리 아이들이 여기 학교에 잘 적응하고 있어서 다행이야. 처음에는 친구를 못 사귈까봐 걱정했어.", en:"I am relieved that our kids are adapting well to school here. At first I was worried they would not be able to make friends."},
    {ko:"말레이시아 생활비가 한국보다 싸다고 들었는데 막상 살아보니까 생각만큼 차이가 크지 않더라.", en:"I heard the cost of living here is cheaper than Korea but now that I actually live here the difference is not as big as I expected."},
    {ko:"여기서 영어를 매일 써야 하다 보니까 영어 실력이 조금씩 늘고 있는 게 느껴져. 특히 말하는 게 편해진 것 같아.", en:"Having to use English every day here I can feel my English slowly improving. Especially speaking feels more natural now."},
    {ko:"말레이시아에 처음 왔을 때는 모든 게 낯설었는데 이제는 여기가 제2의 고향 같아.", en:"When I first came abroad everything felt unfamiliar but now it feels like a second home."},
    {ko:"가디언 비자 갱신할 때마다 스트레스를 많이 받아. 서류 준비도 귀찮고 결과가 나올 때까지 기다리는 것도 너무 힘들어.", en:"I get so stressed every time I have to renew my residency visa. Preparing the documents is a hassle and waiting for the results is really tough."},
    {ko:"몽키아라에 있는 한국 마트에서 한국 식재료를 구할 수 있어서 정말 다행이야. 없었으면 진짜 힘들었을 거야.", en:"I am so glad I can get Korean ingredients at the Korean mart in our neighborhood. Without it things would have been really difficult."},
    {ko:"말레이시아에서 살면서 제일 좋은 건 날씨야. 사계절이 없으니까 옷도 간편하고 겨울 없이 사는 게 이렇게 편한 줄 몰랐어.", en:"The best thing about living here is the weather. There are no four seasons so dressing is simple and I never knew living without winter could be this comfortable."},
    {ko:"나 요즘 줌바 수업 다니는데 운동도 되고 스트레스도 풀리고 새로운 친구도 사귀게 돼서 완전 만족이야.", en:"I have been going to Zumba class lately and I am totally satisfied because I get exercise stress relief and even make new friends."},
    {ko:"영어를 배우면서 제일 어려운 부분이 뭐냐고 물어보면 나는 항상 듣기라고 해. 원어민들이 너무 빨리 말해서 따라가기가 힘들어.", en:"If you ask me what the hardest part of learning English is I always say listening. Native speakers talk so fast that it is hard to keep up."},
    {ko:"말레이시아에서 2년 살면서 깨달은 건 언어보다 태도가 더 중요하다는 거야. 영어를 못해도 친절하게 대하면 사람들이 다 도와줘.", en:"After living here for two years I have realized that attitude matters more than language. Even if you can not speak English well if you are kind people will help you."},
    {ko:"요즘 쿠알라룸푸르 부동산 가격이 많이 올랐대. 예전에 샀더라면 지금쯤 꽤 올랐을 텐데.", en:"I heard property prices in the city have gone up a lot lately. If I had bought earlier it would have gone up quite a bit by now."},
    {ko:"말레이시아에서 가장 좋아하는 음식이 뭐냐고 물어보면 나는 무조건 나시르막이야. 처음에는 낯설었는데 지금은 없으면 안 돼.", en:"If you ask me what my favorite food here is I always say nasi lemak. At first it was unfamiliar but now I can not live without it."},
    {ko:"아이들 학교 픽업 때마다 교통체증 때문에 스트레스를 받아. 조금만 늦게 나와도 주차 자리가 없어서 멀리서 걸어와야 해.", en:"I get stressed every time I pick up the kids from school because of the traffic. If I leave even a little late there are no parking spots and I have to walk from far away."},
    {ko:"말레이시아에서 오래 살다 보면 한국에서는 당연하다고 생각했던 것들이 사실 엄청 편리했던 거라는 걸 알게 돼.", en:"After living here for a long time you start to realize that things you took for granted in Korea were actually incredibly convenient."},
    {ko:"여기서 영어를 쓰다 보면 가끔 하고 싶은 말이 있는데 영어로 어떻게 표현해야 할지 몰라서 답답할 때가 있어.", en:"Sometimes when using English here there are things I want to say but I feel frustrated because I do not know how to express them in English."},
    {ko:"말레이시아 음식이 다양해서 좋아. 말레이 음식, 중국 음식, 인도 음식을 다 맛볼 수 있어서 매일 다른 음식을 먹어도 질리지 않아.", en:"I love how diverse the food options are here. You can try so many different cuisines all in one place so even if you eat something different every day you never get tired of it."},
    {ko:"처음에는 말레이시아 날씨가 너무 덥고 습해서 힘들었는데 이제는 완전히 적응됐어. 오히려 에어컨 없으면 못 살 것 같아.", en:"At first the the weather here was so hot and humid that it was hard to bear but now I have completely adapted. If anything I think I could not live without air conditioning now."},
    {ko:"영어를 배우면서 가장 뿌듯할 때는 원어민이랑 대화가 자연스럽게 됐을 때야. 그 순간이 오면 정말 달라진 게 느껴져.", en:"The most rewarding moment when learning English is when you can have a natural conversation with a native speaker. When that moment comes you can really feel how much you have changed."},
  
    {ko:"말레이시아에서 살다 보니까 영어가 얼마나 중요한지 느껴. 여기서는 영어를 못 하면 정말 아무것도 못 해.", en:"Living here has made me realize just how important English is. Here if you cannot speak English you really cannot do anything."},
    {ko:"나 드디어 가디언 비자 받았어. 비자 에이전트가 서류 다 챙겨줘서 생각보다 훨씬 빨리 됐어.", en:"I finally got my residency visa. The visa agent handled all the documents so it was done much faster than I expected."},
    {ko:"우리 아이 학교에서 인터내셔널 데이가 있었는데 각 나라 전통 의상을 입고 오라고 했어. 한복을 챙겨오길 잘했다고 생각했어.", en:"Our school had an International Day where they asked everyone to wear their traditional clothing. I was glad I brought my hanbok."},
    {ko:"몽키아라에 새로 생긴 카페가 있는데 거기 분위기가 너무 좋아서 공부하거나 미팅 할 때 자주 가.", en:"There is a new cafe in our neighborhood and the atmosphere is so nice that I often go there to study or have meetings."},
    {ko:"말레이시아에서 2년 살면서 깨달은 건 언어보다 태도가 더 중요하다는 거야. 영어를 못해도 친절하게 대하면 사람들이 다 도와줘.", en:"After living here for two years I have realized that attitude matters more than language. Even if you cannot speak English well if you are kind people will help you."},
    {ko:"말레이시아에서 가장 좋아하는 음식이 뭐냐고 물어보면 나는 무조건 나시르막이야. 처음에는 낯설었는데 지금은 없으면 안 돼.", en:"If you ask me what my favorite food here is I always say nasi lemak. At first it was unfamiliar but now I cannot live without it."},
    {ko:"말레이시아에 처음 왔을 때 제일 힘들었던 건 운전이었어. 오른쪽에서 운전하는 데다가 도로가 좁고 오토바이가 너무 많아서 매일 식은땀이 났어.", en:"The hardest thing when I first came abroad was driving. Not only did I have to drive on the right side but the roads were narrow and there were so many motorcycles that I broke out in a cold sweat every day."},
    {ko:"말레이시아에서 살면서 제일 감사한 건 다양한 문화를 직접 경험할 수 있다는 거야. 음식만 해도 말레이 중국 인도 음식이 다 있잖아.", en:"What I am most grateful for about living abroad is being able to directly experience diverse cultures. Even just with food you have so many different cuisines all available."},
    {ko:"아이들이 여기서 영어로 수업을 받다 보니까 한국어가 조금씩 약해지는 것 같아서 걱정이야. 집에서라도 한국어로 많이 얘기해줘야 할 것 같아.", en:"I am worried that my kids' Korean is getting a little weaker since they are taking classes in English here. I think I need to make sure we speak Korean at home as much as possible."},
    {ko:"말레이시아에서 사귄 한국인 친구들 덕분에 여기 생활이 훨씬 편해졌어. 혼자였으면 정말 많이 힘들었을 거야.", en:"Thanks to the Korean friends I have made here my life here has become much easier. If I had been alone it would have been really tough."},
    {ko:"영어 공부를 하면 할수록 느끼는 건 문법보다 표현이 더 중요하다는 거야. 문법이 좀 틀려도 표현이 자연스러우면 대화가 돼.", en:"The more I study English the more I feel that expressions matter more than grammar. Even if your grammar is a little off if your expressions are natural you can have a conversation."},
    {ko:"말레이시아에서 살면서 제일 아쉬운 건 한국 방송을 실시간으로 못 본다는 거야. 항상 다음날 OTT로 봐야 해서 스포일러가 걱정돼.", en:"The thing I miss most about living here is not being able to watch Korean TV in real time. I always have to watch it the next day on OTT so I am always worried about spoilers."},
    {ko:"나 요즘 영어 공부에 재미가 붙었어. 원어민이랑 대화하다 보면 내가 하고 싶은 말을 영어로 할 수 있을 때 진짜 뿌듯해.", en:"I have been really enjoying studying English lately. When I am talking with a native speaker and I can say what I want to say in English I feel genuinely proud of myself."},
    {ko:"말레이시아에 살면서 영어를 쓰다 보면 발음 때문에 상대방이 못 알아들을 때가 있어. 그럴 때마다 더 열심히 연습해야겠다는 생각이 들어.", en:"When I use English here there are times when the other person cannot understand me because of my pronunciation. Every time that happens it makes me think I need to practice harder."},
    {ko:"말레이시아에서 살다 보면 한국에서는 몰랐던 나 자신을 발견하게 돼. 낯선 환경에서 적응하다 보니까 내가 이렇게 강한 사람이었나 싶어.", en:"Living here I discover things about myself that I never knew in Korea. Going through the process of adapting to an unfamiliar environment makes me think wow I am actually a strong person."},
    {ko:"영어 때문에 창피했던 순간들이 있었는데 지금 생각해보면 그게 다 성장의 과정이었던 것 같아. 실수를 해봐야 늘지.", en:"There were moments when I felt embarrassed because of my English but looking back now I think it was all part of the growth process. You have to make mistakes to improve."},
    {ko:"말레이시아에 살면서 제일 뿌듯했던 순간은 영어로 복잡한 상황을 해결했을 때야. 처음에는 그런 상황이 너무 무서웠는데.", en:"The proudest moment I have had living here was when I successfully handled a complicated situation in English. At first situations like that were terrifying."},
    {ko:"말레이시아 생활이 처음에는 너무 낯설었는데 이제는 여기가 없으면 안 될 것 같아. 돌아가기 싫다는 말이 절로 나와.", en:"At first life here felt so unfamiliar but now I feel like I cannot live without this place. The words I do not want to go back come out naturally."},
    {ko:"여기서 살다 보니까 한국에서 너무 당연하게 여겼던 것들이 사실 엄청 좋은 거였다는 걸 알게 됐어. 예를 들면 배달 문화나 대중교통 같은 거.", en:"Living here I have come to realize that things I took for granted in Korea were actually amazing. For example delivery culture and public transportation."},
    {ko:"아이들이 말레이시아에서 다양한 친구들이랑 지내다 보니까 훨씬 열린 마음을 가지게 된 것 같아. 그게 제일 큰 수확인 것 같아.", en:"Since my kids have been spending time with diverse friends here they seem to have developed a much more open mindset. I think that is the biggest takeaway."},
    {ko:"말레이시아에서 살면서 가장 힘들었던 건 아플 때야. 낯선 병원에서 영어로 증상을 설명해야 하는데 그게 정말 쉽지 않았어.", en:"The hardest times living here were when I was sick. I had to explain my symptoms in English at an unfamiliar hospital and that was really not easy."},
    {ko:"영어 공부를 하면서 느끼는 건 꾸준히 하는 게 제일 중요하다는 거야. 하루에 조금씩이라도 매일 하다 보면 어느 순간 달라져 있어.", en:"What I feel from studying English is that consistency is the most important thing. If you do even a little bit every day at some point you will notice you have changed."},
    {ko:"말레이시아에서 살다 보니까 다양한 문화를 접하면서 내 생각이 많이 넓어진 것 같아. 한국에만 있었다면 몰랐을 것들이 너무 많아.", en:"Living here and encountering diverse cultures I feel like my perspective has broadened a lot. There are so many things I would not have known if I had only stayed in Korea."},
  
    {ko:"말레이시아에서 처음으로 혼자 병원에 갔을 때 영어로 증상을 설명하는 게 너무 힘들었어. 그 이후로 의료 영어를 따로 공부하게 됐어.", en:"The first time I went to the hospital alone here it was so hard to explain my symptoms in English. After that I started studying medical English separately."},
    {ko:"여기서 살다 보니까 영어로 농담을 하거나 유머를 이해하는 게 제일 어렵다는 걸 알게 됐어. 언어는 배워도 문화는 따로 배워야 해.", en:"Living here I have come to realize that making jokes or understanding humor in English is the hardest part. You can learn the language but culture is something you have to learn separately."},
    {ko:"말레이시아 생활 초반에는 슈퍼마켓에서 물건 사는 것도 긴장됐어. 영어로 가격 물어보거나 봉투 달라는 말도 못 해서 그냥 손짓으로 했었어.", en:"In the early days of living here I was even nervous buying things at the supermarket. I could not ask for the price or a bag in English so I just used hand gestures."},
    {ko:"지금은 영어로 전화 통화도 하고 불만도 제기하고 협상도 할 수 있는데 처음에는 전화기만 봐도 심장이 두근거렸어.", en:"Now I can make phone calls in English file complaints and even negotiate but at first just looking at the phone made my heart race."},
    {ko:"말레이시아에서 살면서 제일 놀라웠던 건 여기 사람들이 영어 억양이 다 달라도 서로 잘 이해한다는 거야. 완벽한 발음보다 자신감이 더 중요하다는 걸 느꼈어.", en:"The most surprising thing about living here is that people here understand each other even with completely different English accents. I realized that confidence matters more than perfect pronunciation."},
    {ko:"말레이시아에서 영어를 쓰다 보면 내가 하고 싶은 말의 절반도 못 표현할 때가 있어. 그럴 때마다 더 공부해야겠다는 동기가 생겨.", en:"When using English here there are times when I cannot express even half of what I want to say. Every time that happens it motivates me to study more."},
    {ko:"여기서 아이를 키우다 보니까 부모인 내가 먼저 영어를 잘해야 아이에게도 도움을 줄 수 있다는 걸 깨달았어. 그래서 더 열심히 공부하게 됐어.", en:"Raising a child here I realized that I need to be good at English first in order to help my child. That is why I have been studying even harder."},
    {ko:"말레이시아에서 살면서 영어가 단순히 언어가 아니라 삶의 도구라는 걸 느꼈어. 영어를 잘하면 기회가 훨씬 많아지고 생활이 편해져.", en:"Living here I have come to feel that English is not just a language but a tool for life. If you are good at English you have far more opportunities and life becomes easier."},
    {ko:"나 요즘 영어로 꿈을 꿔. 처음에는 신기했는데 이제는 내 영어 실력이 늘고 있다는 증거인 것 같아서 기뻐.", en:"I have been dreaming in English lately. At first it felt strange but now I think it is proof that my English is improving and it makes me happy."},
    {ko:"말레이시아에서 살다 보면 영어를 못 해서 손해 볼 때가 많아. 흥정할 때나 민원 넣을 때 영어를 잘하는 사람이 훨씬 유리해.", en:"Living here there are many times you lose out because of poor English. When bargaining or filing a complaint the person who speaks English better has a huge advantage."},
    {ko:"여기서 살면서 깨달은 건 영어는 완벽하게 해야 하는 게 아니라 소통이 되면 된다는 거야. 틀려도 말하는 용기가 제일 중요해.", en:"What I have realized from living here is that English does not have to be perfect it just needs to communicate. The courage to speak even if you make mistakes is the most important thing."},
    {ko:"말레이시아에 처음 왔을 때는 영어로 말하면 틀릴까봐 너무 무서웠어. 근데 여기 사람들이 친절하게 이해해줘서 점점 자신감이 생겼어.", en:"When I first came abroad I was so scared of making mistakes when speaking English. But the people here were kind enough to understand me and I gradually gained confidence."},
    {ko:"나는 말레이시아에 오기 전에는 영어 공부를 거의 안 했는데 여기 와서 필요에 의해 배우다 보니까 훨씬 빨리 늘더라고.", en:"Before coming abroad I barely studied English but once I came here and started learning out of necessity I improved much faster."},
    {ko:"말레이시아에서 살면서 가장 보람 있었던 건 영어로 누군가를 도와줬을 때야. 처음에는 내가 도움받는 입장이었는데 이제는 도움을 줄 수 있는 사람이 됐어.", en:"The most fulfilling moment living here was when I was able to help someone in English. At first I was the one needing help but now I have become someone who can offer it."},
    {ko:"말레이시아에서 2년 넘게 살다 보니까 이제는 여기가 내 생활 터전이 된 것 같아. 언제 한국에 돌아갈지 생각도 안 하게 됐어.", en:"After living here for over two years it feels like this has become my home base. I have stopped even thinking about when I will return to Korea."},
    {ko:"여기서 살면서 영어 때문에 울었던 적도 있어. 하고 싶은 말을 못 해서 오해가 생겼을 때 정말 속상하더라고. 근데 그게 다 성장이었어.", en:"There were times I cried because of English while living here. When misunderstandings arose because I could not say what I wanted it was really upsetting. But all of that was growth."},
    {ko:"말레이시아 생활에서 영어는 이제 두려움이 아니야. 처음에는 영어만 들리면 도망치고 싶었는데 이제는 기회라고 생각해.", en:"English is no longer something I fear in my life here. At first whenever I heard English I wanted to run away but now I think of it as an opportunity."},
    {ko:"말레이시아에서 살면서 배운 게 있다면 낯선 것에 도전하는 게 나를 성장시킨다는 거야. 영어도 그렇고 새로운 문화도 그렇고.", en:"If there is something I have learned from living here it is that challenging myself with unfamiliar things helps me grow. That applies to English and to new cultures as well."},
    {ko:"여기서 살면서 가장 많이 성장한 건 영어 실력이 아니라 마음이야. 낯선 환경에서 혼자 버티다 보니까 멘탈이 강해진 것 같아.", en:"What has grown the most from living here is not my English but my mindset. Going through tough times alone in an unfamiliar environment has made me mentally stronger."},
    {ko:"말레이시아에서의 생활이 쉽지는 않았지만 돌아보면 감사한 경험들이 훨씬 많아. 여기서의 시간이 내 인생에서 가장 소중한 추억이 될 것 같아.", en:"Life here has not been easy but looking back there are far more experiences to be grateful for. I think the time I have spent here will become the most precious memories of my life."},
    {ko:"말레이시아에서 살면서 제일 많이 들은 말이 뭐냐면 그냥 말해봐야 늘어 야. 맞아 경험이 최고의 선생님이더라.", en:"The thing I heard most while living here was just speak and you will improve. And it is true. Experience is the best teacher."},
    {ko:"영어 공부를 오래 해도 실전에서 막히는 경우가 많은데 그 이유는 외웠던 표현이 실제 대화에서는 달리 들리기 때문이야. 그래서 듣기 연습이 중요해.", en:"Even after studying English for a long time you often get stuck in real situations and the reason is that the expressions you memorized sound different in actual conversation. That is why listening practice is so important."},
    {ko:"말레이시아에서 살면서 영어가 조금씩 늘 때마다 세상이 더 넓어지는 느낌이 들어. 언어 하나가 이렇게 많은 걸 바꿔놓을 줄은 몰랐어.", en:"Every time my English improves a little while living here I feel like my world is getting bigger. I never knew that one language could change so much."},
  ],
};

const VOCAB_DB = {
  business: [
    {en:"Circle back", ko:"나중에 다시 이야기하다", example:"Let us circle back to this later."},
    {en:"Touch base", ko:"연락을 취하다, 상황 확인하다", example:"Let us touch base next week."},
    {en:"Deep dive", ko:"심층 분석", example:"We need a deep dive into the data."},
    {en:"Low-hanging fruit", ko:"쉽게 달성할 수 있는 목표", example:"Let us start with the low-hanging fruit."},
    {en:"Bandwidth", ko:"일을 처리할 여유", example:"I do not have the bandwidth for this right now."},
    {en:"Action item", ko:"실행 과제, 조치 사항", example:"The main action item is to follow up with the client."},
    {en:"Move the needle", ko:"눈에 띄는 변화를 만들다", example:"This campaign really moved the needle."},
    {en:"Alignment", ko:"방향성 정렬, 합의", example:"We need alignment on this project before moving forward."},
    {en:"Table this", ko:"논의를 다음으로 미루다", example:"Let us table this for the next meeting."},
    {en:"Take it offline", ko:"나중에 따로 얘기하다", example:"Let us take this offline after the meeting."},
    {en:"Buy-in", ko:"동의, 지지", example:"We need the CEO's buy-in before we proceed."},
    {en:"Best practice", ko:"모범 사례", example:"This is considered a best practice in our industry."},
    {en:"Think outside the box", ko:"고정관념에서 벗어나 창의적으로 생각하다", example:"We need to think outside the box on this one."},
    {en:"Hard stop", ko:"반드시 끝내야 하는 시간", example:"I have a hard stop at 3 PM today."},
    {en:"Keep someone in the loop", ko:"상황을 계속 공유해 주다", example:"Please keep me in the loop on any updates."},
    {en:"Game changer", ko:"판도를 바꾸는 것", example:"This new feature is a total game changer."},
    {en:"Bottom line", ko:"핵심, 최종 결론", example:"The bottom line is we need to cut costs."},
    {en:"Streamline", ko:"간소화하다, 능률화하다", example:"We need to streamline our onboarding process."},
    {en:"Take ownership", ko:"책임감을 가지고 주도하다", example:"I will take ownership of this project."},
    {en:"Pain point", ko:"불편함을 느끼는 부분", example:"What are the main pain points for your customers?"},
    {en:"Win-win situation", ko:"모두에게 유익한 결과", example:"This deal is a win-win situation for both sides."},
    {en:"Leverage", ko:"활용하다", example:"We should leverage our existing network."},
    {en:"Pivot", ko:"사업 방향을 전환하다", example:"We decided to pivot our strategy after the feedback."},
    {en:"Scalable", ko:"확장 가능한", example:"We need a scalable solution for this problem."},
    {en:"Scope creep", ko:"프로젝트 범위가 야금야금 늘어나는 것", example:"We need to watch out for scope creep on this project."},
    {en:"ROI", ko:"투자 대비 수익률", example:"What is the expected ROI on this campaign?"},
    {en:"Pipeline", ko:"진행 중인 프로젝트들", example:"We have a strong pipeline of clients this quarter."},
    {en:"Stakeholder", ko:"이해관계자", example:"We need to get all stakeholders on the same page."},
    {en:"Drill down", ko:"더 깊이 파고들다", example:"Let us drill down into the numbers."},
    {en:"Fast-track", ko:"신속하게 처리하다", example:"Can we fast-track this approval?"},
  
    {en:"I intend to decline", ko:"참석하지 않을 계획입니다", example:"Personally I intend to decline the invitation."},
    {en:"Attendance is compulsory", ko:"참석이 의무적인", example:"I am uncertain whether our attendance is compulsory."},
    {en:"Our presence is requested", ko:"참석이 요구됩니다", example:"Is our presence requested at the meeting?"},
    {en:"Verify the progress", ko:"진행 상황을 확인하다", example:"I recommend that you verify the progress with your visa agent."},
    {en:"Received no notification", ko:"통보를 받지 못하다", example:"Six weeks have elapsed and I have received no notification yet."},
    {en:"Finalize our appointment", ko:"일정을 최종 확정하다", example:"Let us finalize our appointment for Friday."},
    {en:"Pencil it in", ko:"일단 스케줄에 잡아두다", example:"I will pencil it in for Friday for now."},
    {en:"Inquire if she is free", ko:"시간이 되는지 물어보다", example:"I will inquire if she is free this Friday."},
    {en:"Had it styled", ko:"스타일링을 받다", example:"Thank you. I recently had it styled."},
    {en:"Suits you very well", ko:"매우 잘 어울리다", example:"Have you altered your hairstyle? It suits you very well."},
  
    {en:"reschedule for either Tuesday or Thursday", ko:"화요일이나 목요일로 일정 다시 잡다", example:"I would like to reschedule for either Tuesday or Thursday."},
    {en:"the day we had our first job interview", ko:"처음 면접 봤던 날", example:"Do you remember the day we had our first job interview?"},
    {en:"how long tomorrow's meeting will be", ko:"내일 미팅이 얼마나 걸릴지", example:"Do you know how long tomorrow's meeting will be? I can not stay long."},
    {en:"works for me", ko:"나한테 괜찮아", example:"Thursday works for me. Does it work for you?"},
    {en:"move the date up", ko:"날짜를 앞당기다", example:"Can we move the date up a bit?"},
    {en:"reschedule", ko:"일정을 다시 잡다", example:"I would like to reschedule for either Tuesday or Thursday."},
    {en:"make it to the meeting", ko:"미팅에 참석하다", example:"I don't think I can make it to the meeting."},
    {en:"move our lunch up by two days", ko:"점심 약속을 이틀 앞당기다", example:"Could we move our lunch up by two days?"},
    {en:"which day works best for you", ko:"어떤 날이 제일 좋아요", example:"Let me know which day works best for you."},
  
    {en:"reached out to", ko:"연락하다", example:"Have you reached out to your visa agent?"},
    {en:"have never tried before", ko:"한번도 해본 적 없다", example:"I had never tried durian before I came abroad."},
    {en:"barely made it through", ko:"겨우 끝까지 보다", example:"I barely made it through that movie. It was so boring."},
    {en:"failed the first time", ko:"첫 번째 시도에서 떨어지다", example:"I failed the first time but I passed on the second try."},
    {en:"passed on the second try", ko:"두 번째에 합격하다", example:"I failed the first time but I passed on the second try."},
  
    {en:"take into account", ko:"고려하다", example:"You need to take the cost of living and school tuition into account."},
    {en:"on the expensive side", ko:"비싼 편이다", example:"the supermarket is on the expensive side."},
    {en:"become CEOs at 25", ko:"25세에 CEO가 되다", example:"Some people become CEOs at 25."},
    {en:"running their own race", ko:"자기만의 경주를 뛰다", example:"Everyone is running their own race on their own timeline."},
    {en:"working on their own timeline", ko:"자기만의 시간표로 일하다", example:"Everyone in the world is working on their own timeline."},
    {en:"dashcam footage", ko:"블랙박스 영상", example:"Luckily I had dashcam footage so I submitted it to the police station."},
    {en:"submitted it to the police", ko:"경찰서에 제출했다", example:"I had dashcam footage so I submitted it to the police station."},
    {en:"pull over to the side", ko:"길 옆으로 차를 세우다", example:"Please pull over to the side of the road."},
    {en:"minor fender bender", ko:"가벼운 접촉사고", example:"It was just a minor fender bender. It wasn't anything serious."},
    {en:"need his support", ko:"그의 지지가 필요하다", example:"I think you still need his support and comfort."},
  
    {en:"budget is tight", ko:"예산이 빡빡하다", example:"The budget for this project is tight so we need to figure out where we can cut costs."},
    {en:"cut costs", ko:"비용을 절감하다", example:"We need to figure out where we can cut costs."},
    {en:"really impressive", ko:"정말 인상적이다", example:"The presentation yesterday was really impressive."},
    {en:"put it together", ko:"준비하다, 만들다", example:"How did you manage to put it together in such a short amount of time?"},
    {en:"meet the deadline", ko:"마감 기한을 맞추다", example:"Our team is really struggling to meet the deadline."},
    {en:"additional support", ko:"추가 지원", example:"We might need some additional support."},
    {en:"contract goes through", ko:"계약이 확정되다", example:"If this contract goes through it will be a huge opportunity for our company."},
    {en:"heading toward burnout", ko:"번아웃이 올 것 같다", example:"The workload has been so heavy that I feel like I am heading toward burnout."},
    {en:"take a break", ko:"잠깐 쉬다", example:"I think I need to take a break."},
    {en:"workload has been heavy", ko:"업무량이 많다", example:"The workload has been so heavy lately."},
  
    {en:"could we reschedule", ko:"일정을 다시 잡을 수 있을까요", example:"Could we reschedule our meeting to next Thursday?"},
    {en:"follow up on", ko:"후속 조치를 취하다", example:"I just wanted to follow up on the email I sent last week."},
    {en:"get back to you", ko:"다시 연락 드리겠습니다", example:"Let me check with my team and I will get back to you."},
    {en:"looking forward to", ko:"기대하고 있습니다", example:"I am looking forward to working with you on this project."},
    {en:"as per our discussion", ko:"논의한 대로", example:"As per our discussion I will send over the documents by Friday."},
    {en:"touch base", ko:"연락하다, 확인하다", example:"Let us touch base next week to see how things are going."},
    {en:"loop you in", ko:"참여시키다, 공유하다", example:"I will loop you in on the email thread so you are up to date."},
    {en:"moving forward", ko:"앞으로는, 이제부터는", example:"Moving forward please send all requests directly to me."},
    {en:"take this offline", ko:"따로 이야기하다", example:"This is getting complicated. Let us take this offline."},
    {en:"circle back", ko:"나중에 다시 얘기하다", example:"I do not have an answer right now but I will circle back to you."},
    {en:"bandwidth", ko:"여유, 시간적 여유", example:"I do not have the bandwidth to take on another project right now."},
    {en:"deliverables", ko:"결과물, 납품물", example:"Let us agree on the deliverables before we start."},
    {en:"on the same page", ko:"같은 생각이다", example:"I just want to make sure we are all on the same page."},
    {en:"bottom line", ko:"결론, 핵심", example:"The bottom line is we need to cut costs by 20 percent."},
    {en:"at your earliest convenience", ko:"가능한 한 빨리", example:"Please send me the report at your earliest convenience."},
    {en:"going forward", ko:"앞으로는", example:"Going forward all approvals need to come from the director."},
    {en:"heads up", ko:"미리 알려주다", example:"Just wanted to give you a heads up that the meeting has been moved."},
    {en:"bring to the table", ko:"기여하다, 제공하다", example:"What skills can you bring to the table for this project?"},
    {en:"value add", ko:"부가 가치", example:"How does this feature add value to our customers?"},
    {en:"key takeaway", ko:"핵심 내용", example:"The key takeaway from today's meeting is that we need more data."},
    {en:"pain point", ko:"불편한 점, 문제점", example:"What are the main pain points our customers are experiencing?"},
    {en:"leverage", ko:"활용하다", example:"We need to leverage our existing relationships to grow faster."},
    {en:"synergy", ko:"시너지", example:"The merger will create synergy between the two teams."},
    {en:"scalable", ko:"확장 가능한", example:"We need a solution that is scalable as we grow."},
    {en:"pivot", ko:"방향을 바꾸다", example:"After the market research we decided to pivot our strategy."},
    {en:"stakeholders", ko:"이해관계자", example:"We need to get buy-in from all the key stakeholders."},
  ],
  mz: [
    {en:"No cap", ko:"진짜로, 거짓말 안 하고", example:"This is the best pizza I have ever had, no cap."},
    {en:"Bet", ko:"당근이지, 좋았어", example:"Can you help me move this weekend? Bet."},
    {en:"Rizz", ko:"이성을 유혹하는 매력", example:"He has so much rizz, everyone loves talking to him."},
    {en:"Slay", ko:"완전 멋지게 해내다", example:"She absolutely slayed that presentation."},
    {en:"Ate and left no crumbs", ko:"완벽하게 찢었다", example:"She ate and left no crumbs with that performance."},
    {en:"Ghost", ko:"갑자기 잠수 타다", example:"He ghosted me after our third date."},
    {en:"Sus", ko:"수상쩍다", example:"That excuse sounds really sus to me."},
    {en:"Spill the tea", ko:"가십을 털어놓다", example:"Come on, spill the tea — what happened at the party?"},
    {en:"Main character energy", ko:"어디서나 돋보이는 당당한 아우라", example:"She walked in with total main character energy."},
    {en:"Low-key", ko:"은근히", example:"I low-key want to cancel my plans and stay home."},
    {en:"High-key", ko:"대놓고, 확실히", example:"I high-key love this new album."},
    {en:"Rent-free", ko:"머릿속에 계속 맴도는", example:"That song lives in my head rent-free."},
    {en:"Salty", ko:"속이 좁은, 삐진", example:"Why are you so salty? It was just a joke."},
    {en:"Bussin", ko:"음식이 진짜 맛있다", example:"This ramen is absolutely bussin."},
    {en:"GOAT", ko:"역대 최고", example:"Michael Jordan is the GOAT, no debate."},
    {en:"Situationship", ko:"썸과 연애 사이의 애매한 관계", example:"I am tired of this situationship. I want a real relationship."},
    {en:"Delulu", ko:"망상증적인, 김칫국 마시는", example:"She thinks he likes her back — she is so delulu."},
    {en:"Glow up", ko:"외모나 환경이 엄청나게 업그레이드됨", example:"Have you seen her lately? Total glow up."},
    {en:"Era", ko:"요즘 꽂혀 있는 모드", example:"I am in my healthy-eating era right now."},
    {en:"It is giving", ko:"어떤 분위기를 풍긴다", example:"That outfit is giving total summer vibes."},
    {en:"Understood the assignment", ko:"요구 사항을 완벽하게 해내다", example:"She really understood the assignment tonight."},
    {en:"Mid", ko:"그저 그런, 평범한", example:"Honestly the movie was pretty mid."},
    {en:"Vibe check", ko:"분위기 파악하기", example:"This party is not passing the vibe check."},
    {en:"Caught in 4K", ko:"현행범으로 딱 걸린", example:"He was caught in 4K stealing the last slice."},
    {en:"Touch grass", ko:"현실 자각 좀 해라", example:"You have been online all day. Go touch grass."},
    {en:"Gatekeep", ko:"정보를 남들에게 안 알려주려고 숨기다", example:"Stop gatekeeping that restaurant and tell us where it is."},
    {en:"NPC", ko:"존재감 없고 기계적인 사람", example:"He just stands there doing nothing — total NPC."},
    {en:"Out of pocket", ko:"선을 넘은", example:"That comment was completely out of pocket."},
    {en:"total W", ko:"완전 대박, 승리", example:"Getting free tickets was a total W."},
    {en:"Stan", ko:"극성팬, 엄청나게 덕질하다", example:"I totally stan this artist — she is incredible."},
  
    {en:"Is it a must?", ko:"그거 필수임?", example:"Wait is it a must? Do we really have to go?"},
    {en:"Gonna skip out", ko:"쨀래, 튈래", example:"Yeah I am gonna skip out on that one."},
    {en:"I had no idea", ko:"몰랐어, 전혀 몰랐네", example:"I had no idea you could use Waze instead of Google Maps."},
    {en:"Stuck at home", ko:"집에 처박혀 있어", example:"I have been stuck at home all day. So bored."},
    {en:"Keep it up", ko:"계속 유지하다", example:"Let us see how long you can keep it up."},
    {en:"Drinking buddy", ko:"술친구", example:"I feel like I lost my drinking buddy."},
    {en:"Rip-off", ko:"바가지, 완전 사기", example:"Isn't this a total rip-off? Why is it so expensive?"},
    {en:"Haven't noticed", ko:"눈치 못 챘어?", example:"Haven't you noticed I got a haircut?"},
    {en:"As in", ko:"~할 때의 (스펠링 설명할 때)", example:"L as in lamp. That is how you say it."},
    {en:"Were a millionaire", ko:"백만장자라도", example:"I would not marry you even if you were a millionaire."},
  
    {en:"Let us hang out when our final exams are", ko:"우리 기말고사 끝났을 때, 놀자", example:"Let us hang out when our final exams are over."},
    {en:"You look so beautiful today. You look ju", ko:"너 오늘 너무 예쁘다. 꼭 슈퍼스타 같아.", example:"You look so beautiful today. You look just like a superstar."},
    {en:"We should just send our kids to school w", ko:"우리는 아이들이 아프던지 말던지 학교로 보내버려야해.", example:"We should just send our kids to school whether they are sick or not."},
  
    {en:"farted in front of", ko:"~앞에서 방구 뀌다", example:"When was the last time you farted in front of your husband?"},
    {en:"went clubbing", ko:"클럽 갔었어", example:"Did you go clubbing every day in your twenties?"},
    {en:"go clubbing every day", ko:"매일 클럽에 가다", example:"There was a time when I went clubbing almost every day."},
    {en:"don't have chemistry", ko:"케미가 없다", example:"We don't have chemistry so we run out of things to say quickly."},
    {en:"run out of things to say", ko:"할 말이 없어지다", example:"We run out of things to say pretty quickly."},
    {en:"pointing everything out", ko:"다 지적하다", example:"Stop pointing everything out. I am so sick of it."},
    {en:"straight-A student", ko:"전과목 A를 받는 학생", example:"Yehee is a straight-A student. She is always at the top of her class."},
    {en:"can never go wrong", ko:"항상 믿을 수 있다", example:"I always take the bus service to Singapore. You can never go wrong with it."},
  
    {en:"no willpower", ko:"의지력이 없다", example:"I am on a diet but I ate almost an entire chicken. I have no willpower."},
    {en:"already drooling", ko:"벌써 군침 돌다", example:"Wow this looks so good. I am already drooling."},
    {en:"spilled the secret", ko:"비밀을 말하다", example:"She almost spilled the secret. Luckily she stopped herself just in time."},
    {en:"leave earlier next time", ko:"다음번엔 더 일찍 나오다", example:"I almost missed it. I need to leave earlier next time."},
  
    {en:"a twist at the end", ko:"끝에 반전이 있다", example:"The story is not anything special but there is a twist at the end."},
    {en:"worth watching", ko:"볼 만한 가치가 있다", example:"It is definitely worth watching. You should not miss it."},
    {en:"won't regret it", ko:"후회 안 할꺼야", example:"You won't regret it. I am sure you will absolutely love it."},
    {en:"based on a true story", ko:"실화 바탕의", example:"It is based on a true story and I know you like movies like that."},
    {en:"it better be good", ko:"재밌어야 할꺼야", example:"It better be good because an IMAX ticket is almost twice the price."},
    {en:"have similar taste", ko:"취향이 비슷하다", example:"I highly recommend it because we have similar taste in movies."},
    {en:"have jet lag", ko:"시차증이 있다", example:"Do you have jet lag?"},
    {en:"adjusting to the time difference", ko:"시차 적응 중이다", example:"I am still adjusting to the time difference."},
    {en:"cut in anyway", ko:"어쨌든 끼어들다", example:"There wasn't enough space but he cut in anyway."},
    {en:"almost got into an accident", ko:"사고 날 뻔했다", example:"I almost got into an accident."},
  
    {en:"stay home", ko:"집에 있다", example:"I am not sure yet. I will probably stay home."},
    {en:"feet are really sore", ko:"발이 너무 아프다", example:"I walked a lot yesterday. My feet are really sore."},
    {en:"call you later", ko:"나중에 전화할게", example:"I am busy right now so I will call you later."},
  
    {en:"no cap", ko:"진짜로, 거짓말 아니고", example:"No cap that was the best meal I have ever had."},
    {en:"lowkey", ko:"은근히, 살짝", example:"I am lowkey obsessed with this new cafe in our neighborhood."},
    {en:"highkey", ko:"완전히, 확실히", example:"I highkey need a vacation right now."},
    {en:"it is giving", ko:"~느낌이다, ~같다", example:"This outfit is giving main character energy."},
    {en:"main character energy", ko:"주인공 에너지", example:"She walked in and had total main character energy."},
    {en:"slay", ko:"잘하다, 완전 멋지다", example:"You absolutely slayed that presentation."},
    {en:"understood the assignment", ko:"분위기 파악했다", example:"She really understood the assignment with that outfit."},
    {en:"rent free", ko:"머릿속에서 떠나지 않다", example:"That song has been living in my head rent free all week."},
    {en:"the ick", ko:"갑자기 싫어지는 느낌", example:"He said something so cringe and I got the ick immediately."},
    {en:"that is so real", ko:"공감돼, 진짜 그렇지", example:"I hate Mondays. That is so real."},
    {en:"hits different", ko:"다르게 느껴지다, 특별하다", example:"Coffee hits different when you are exhausted."},
    {en:"I am dead", ko:"너무 웃겨서 죽을 것 같아", example:"He tripped in front of everyone. I am dead."},
    {en:"big yikes", ko:"대박 민망하다, 어이없다", example:"She texted her boss instead of her friend. Big yikes."},
    {en:"vibe check", ko:"분위기 파악", example:"Vibe check. Is everyone okay with the plan?"},
    {en:"it is not giving", ko:"별로다, 아닌 것 같다", example:"That haircut is not giving what you think it is giving."},
    {en:"periodt", ko:"확실해, 맞아 딱", example:"She is the most talented person in the room periodt."},
    {en:"say less", ko:"알겠어, 더 설명 안 해도 돼", example:"You want to leave early? Say less I will cover for you."},
    {en:"ate and left no crumbs", ko:"완벽하게 해냈다", example:"She ate and left no crumbs with that performance."},
    {en:"that girl", ko:"완벽한 여자, 자기관리하는 여자", example:"She wakes up at 5am and goes to the gym. She is that girl."},
    {en:"era", ko:"시기, 단계", example:"I am in my healing era right now. No drama allowed."},
    {en:"gatekeeping", ko:"혼자만 알고 안 알려주다", example:"Stop gatekeeping that restaurant. Tell me where it is."},
    {en:"girl math", ko:"여자들의 논리적 소비 합리화", example:"I saved money on one thing so I can spend it on this. Girl math."},
    {en:"brain rot", ko:"질 낮은 콘텐츠에 빠지다", example:"I have been watching short videos all day. Total brain rot."},
    {en:"delulu", ko:"망상적인, 현실 모르는", example:"She thinks he likes her back. She is so delulu."},
    {en:"rizz", ko:"이성을 끌어당기는 매력", example:"He has so much rizz. Everyone loves him."},
    {en:"caught in 4K", ko:"딱 걸리다", example:"He said he was busy but was caught in 4K at the party."},
    {en:"touch grass", ko:"현실로 돌아와라", example:"You have been on your phone all day. Go touch grass."},
    {en:"roman empire", ko:"자주 생각하는 것", example:"The time I said something embarrassing is my Roman Empire."},
    {en:"situationship", ko:"썸 관계, 애매한 사이", example:"We are not dating but we are not just friends. It is a situationship."},
    {en:"red flag", ko:"위험 신호", example:"He never texts back. That is a red flag."},
    {en:"green flag", ko:"좋은 신호", example:"He remembered my favorite food. Total green flag."},
    {en:"glow up", ko:"외모나 삶이 좋아지다", example:"She had a massive glow up since high school."},
  ],
  drama: [
    {en:"Beats me", ko:"전혀 모르겠어", example:"Beats me why she would do that."},
    {en:"Call it a day", ko:"오늘 일은 이만 마치다", example:"We have done enough work — let us call it a day."},
    {en:"On the fence", ko:"결정을 못 내리고 애매한 상태인", example:"I am still on the fence about taking the job."},
    {en:"Under the weather", ko:"몸 상태가 좋지 않은", example:"I am feeling a bit under the weather today."},
    {en:"Hit the jackpot", ko:"대박 터지다", example:"She hit the jackpot with that investment."},
    {en:"Bite the bullet", ko:"악물고 버티다", example:"Just bite the bullet and go to the dentist."},
    {en:"Spill the beans", ko:"비밀을 누설하다", example:"Who spilled the beans about the surprise party?"},
    {en:"Piece of cake", ko:"식은 죽 먹기", example:"The interview was a piece of cake."},
    {en:"Out of the blue", ko:"뜬금없이, 갑자기", example:"He called me out of the blue after two years."},
    {en:"Costs an arm and a leg", ko:"너무 비싸다", example:"Rent in this city costs an arm and a leg."},
    {en:"See eye to eye", ko:"의견이 완전히 일치하다", example:"We do not always see eye to eye but we respect each other."},
    {en:"Pull someone's leg", ko:"농담하다, 장난치다", example:"Are you serious? Or are you pulling my leg?"},
    {en:"Once in a blue moon", ko:"아주 드물게", example:"She calls me once in a blue moon."},
    {en:"Cut to the chase", ko:"본론만 말하다", example:"Let us cut to the chase — what do you actually want?"},
    {en:"Hit the sack", ko:"잠자리에 들다", example:"I am exhausted. I am going to hit the sack."},
    {en:"Jump on the bandwagon", ko:"유행에 편승하다", example:"Everyone is jumping on the AI bandwagon these days."},
    {en:"Long story short", ko:"긴 얘기 생략하고 요약하자면", example:"Long story short, I quit my job and moved abroad."},
    {en:"Miss the boat", ko:"기회를 놓치다", example:"I missed the boat on investing in that company."},
    {en:"Ring a bell", ko:"들어본 적이 있는 것 같다", example:"That name rings a bell — do I know her?"},
    {en:"Sleep on it", ko:"하룻밤 자면서 신중히 고민해 보다", example:"Do not decide now — sleep on it and let me know tomorrow."},
    {en:"Up in the air", ko:"아직 미정인", example:"Our travel plans are still up in the air."},
    {en:"Burn the midnight oil", ko:"밤샘 야근을 하다", example:"I was burning the midnight oil to finish the report."},
    {en:"Keep a straight face", ko:"포커페이스를 유지하다", example:"I could not keep a straight face when she told the joke."},
    {en:"Rule of thumb", ko:"대략적인 상식적 기준", example:"As a rule of thumb, save at least 10 percent of your income."},
    {en:"Catch-22", ko:"진퇴양난, 딜레마", example:"It is a catch-22 — you need experience to get the job but need the job to get experience."},
    {en:"Off the hook", ko:"위기를 모면한", example:"The lawyer got him off the hook."},
    {en:"Same page", ko:"동의하는, 같은 생각인", example:"Are we on the same page about the deadline?"},
    {en:"Break a leg", ko:"행운을 빌어!", example:"Break a leg at your audition tonight!"},
    {en:"Through thick and thin", ko:"좋을 때나 힘들 때나", example:"She has been with me through thick and thin."},
    {en:"Drive someone up the wall", ko:"누구를 미치게 만들다", example:"That noise is driving me up the wall."},
  
    {en:"Left in the dark", ko:"아무것도 모르는 상태로 남겨지다", example:"It has been six weeks and I am still left in the dark."},
    {en:"Swamped with", ko:"~때문에 눈코 뜰 새 없이 바쁘다", example:"I have been swamped with my residency visa renewal."},
    {en:"Such a pain", ko:"진짜 골칫덩어리야", example:"Doing that every year is such a pain."},
    {en:"If I were in your shoes", ko:"내가 네 입장이라면", example:"If I were in your shoes I would forgive him."},
    {en:"Let me make it clear", ko:"딱 잘라 말할게", example:"Let me make it clear. We are completely done."},
    {en:"Give him one more chance", ko:"한 번 더 기회를 주다", example:"I think you should give him one more chance."},
    {en:"What is that supposed to mean", ko:"그게 무슨 뜻이야?", example:"What is that supposed to mean? Am I not pretty?"},
    {en:"Look even prettier", ko:"훨씬 더 예뻐 보이다", example:"I think you would look even prettier with earrings."},
    {en:"It has been forever", ko:"진짜 오랜만이다", example:"It has been forever! I haven't seen you in so long."},
    {en:"A huge hassle", ko:"엄청난 번거로움", example:"Renewing the visa every year is a huge hassle."},
    {en:"Dragging on forever", ko:"끝도 없이 늘어지다", example:"Why is this dragging on forever? I don't get it."},
    {en:"Make sure to bring", ko:"반드시 챙겨와", example:"Just in case make sure to bring bear spray."},
    {en:"Skip camping", ko:"캠핑을 빠지다", example:"If I see a bear I would rather skip camping entirely."},
    {en:"Could have married", ko:"결혼할 수도 있었을텐데", example:"If we had met earlier things might have been different."},
    {en:"Lost my drinking buddy", ko:"술친구를 잃은 기분", example:"I am so sad I feel like I lost my drinking buddy."},
  
    {en:"I won't tell anyone. Trust me.", ko:"나 아무에게도 말 안할꺼야. 날 믿어", example:"I won't tell anyone. Trust me."},
    {en:"Let me tell you what I heard.", ko:"내가 무슨소리 들었는지 말해줄께.", example:"Let me tell you what I heard."},
    {en:"But when they are at home they watch TV ", ko:"근데 애가 집에 있을때는 하루종일 티비를 봐요.", example:"But when they are at home they watch TV all day long."},
    {en:"Have you ever dated a foreign guy when y", ko:"캐나다에 있을때 외국남자 만나 본 적 있어요?", example:"Have you ever dated a foreign guy when you were in Canada?"},
    {en:"When we hang out let us go to a pub.", ko:"우리 놀 때, 우리 pub에 가자", example:"When we hang out let us go to a pub."},
    {en:"When I first met him he was 30. So he lo", ko:"내가 그를 처음 만났을때, 그는 30 이었어. 그래서 엄청 어려보였어.", example:"When I first met him he was 30. So he looked so young."},
    {en:"When I saw his bank account I decided to", ko:"내가 그의 계좌를 봤을때, 난 그와 결혼해야겠다고 결정했어.", example:"When I saw his bank account I decided to marry him."},
    {en:"Actually he proposed to me that evening ", ko:"사실 우리가 만난 그날 저녁 그는 나에게 프로포즈 했어", example:"Actually he proposed to me that evening we met."},
    {en:"That is romantic. Were you touched when ", ko:"로맨틱하다. 그가 너에게 프로포즈 했을때 넌 감동받았어?", example:"That is romantic. Were you touched when he proposed to you?"},
    {en:"You are lying. You must have cried becau", ko:"넌 거짓말이야. 넌 분명 감동받아서 울었을꺼야.", example:"You are lying. You must have cried because you were touched."},
    {en:"How do I look today?", ko:"나 오늘 어때 보여?", example:"How do I look today?"},
    {en:"You must have been so shocked when you h", ko:"너는 소식을 들었을 때, 엄청 놀랐겠다. 태국 가본 것 처음이었어?", example:"You must have been so shocked when you heard the news. Was it your first time visiting Thailand?"},
    {en:"The kids must have been disappointed.", ko:"아이들은 분명 실망했겠다.", example:"The kids must have been disappointed."},
    {en:"Actually my husband didn't want to go to", ko:"사실, 우리 남편은 애초에 태국에 가고싶어 하지 않았었어. 가지 말았어야", example:"Actually my husband didn't want to go to Thailand in the first place. We shouldn't have gone."},
    {en:"You should have listened to your husband", ko:"넌 남편 말을 들었어야 했어. 그럼 돈을 아꼈었을 텐데.", example:"You should have listened to your husband. Then you would have saved money."},
    {en:"I waited for more than an hour but he di", ko:"나 한시간 보다 더 기다렸었어. 근데 그가 나타나지 않았어.", example:"I waited for more than an hour but he didn't show up."},
    {en:"This looks very familiar to you doesn't ", ko:"너 이거 많이 본거 같지?", example:"This looks very familiar to you doesn't it?"},
    {en:"It looks like my wallet. I lost it a few", ko:"내 지갑 같아. 나 몇일 전에 잊어버렸는데.", example:"It looks like my wallet. I lost it a few days ago."},
    {en:"The necklace is so beautiful. It looks g", ko:"목걸이 너무 예쁘다. 너에게 잘 어울려.", example:"The necklace is so beautiful. It looks good on you."},
    {en:"I saw a man snatch someone's necklace an", ko:"나 어떤 남자가 어떤 사람의 목걸이를 낚아채고 도망가는 것을 보았어.", example:"I saw a man snatch someone's necklace and run away last time."},
    {en:"I saw a woman blocking the road on my wa", ko:"나는 여자가 도로를 막고 있는걸 봤어 오는길에", example:"I saw a woman blocking the road on my way here."},
    {en:"I didn't see anyone blocking the road on", ko:"나는 누군가가 길을 막고 있는 걸 못봤어 오는길에.", example:"I didn't see anyone blocking the road on my way here."},
    {en:"I saw a man hitting a woman on the news ", ko:"난 뉴스에서 남자가 여자를 때리는 걸 봤어. 그리고 난 그녀의 비명소리를", example:"I saw a man hitting a woman on the news and I heard her scream."},
    {en:"People didn't help her and I saw them fi", ko:"사람들은 그녀를 돕지 않았고, 난 그들이 장면을 카메라로 찍는 걸 봤어.", example:"People didn't help her and I saw them filming the scene."},
    {en:"But I love this coffee shop so much. I c", ko:"근데 나 이 커피샵 너무 좋아. 음악도 들을 수 있고, 사람들이 그들의 ", example:"But I love this coffee shop so much. I can hear the music and I can see people enjoying their time. It is perfect."},
  
    {en:"the worst day of my life", ko:"내 인생 최악의 날", example:"It was literally the worst day of my life."},
    {en:"first time trying", ko:"처음 먹어보다", example:"This is my first time trying Vietnamese food. It is so good."},
    {en:"should have become a chef", ko:"쉐프가 됐어야 했어", example:"I made kimchi for the first time and it turned out great. I should have become a chef."},
    {en:"top it up", ko:"충전하다", example:"I used up all the money on my bus card. I need to top it up."},
    {en:"used up all the money", ko:"돈을 다 써버리다", example:"I used up all the money on my bus card."},
    {en:"never been there either", ko:"나도 한번도 가본 적 없어", example:"I don't know because I have never been there either."},
    {en:"get used to AirAsia", ko:"에어아시아에 익숙해지다", example:"Try to get used to AirAsia. Once you fall asleep you won't know the difference."},
    {en:"understand why people love it", ko:"왜 사람들이 좋아하는지 이해하다", example:"Once you come here you will understand why people love it so much."},
    {en:"how spicy Buldak noodles are", ko:"불닭볶음면이 얼마나 매운지", example:"You have no idea how spicy Buldak noodles are."},
    {en:"where I parked", ko:"어디에 주차했는지", example:"I don't even know where I parked."},
    {en:"not exactly the same", ko:"완전히 똑같지는 않은", example:"They are not exactly the same."},
    {en:"the last time we met", ko:"마지막으로 만난 때", example:"I can not remember the last time we met."},
  
    {en:"never been there", ko:"한번도 가본 적 없다", example:"I have never been there. Do you know where I can try some?"},
    {en:"barely slept last night", ko:"어젯밤에 거의 못 잤다", example:"I barely slept last night. I am so tired today."},
    {en:"still have not forgotten", ko:"아직도 잊지 못하다", example:"I still have not forgotten that moment. It was one of the happiest moments of my life."},
    {en:"finally came through", ko:"드디어 나오다", example:"My visa finally came through. I can really live here now."},
    {en:"finally feels like home", ko:"드디어 집 같은 느낌이 나다", example:"It has been over a month since I moved in and it finally feels like home."},
    {en:"almost fell on the street", ko:"길에서 넘어질 뻔하다", example:"I almost fell on the street today. Someone had left a banana peel on the ground."},
    {en:"never needed to drive", ko:"운전할 필요가 없었다", example:"I never needed to drive when I was living in Korea."},
    {en:"a single Korean drama", ko:"한국 드라마 한편도", example:"I have not watched a single Korean drama yet."},
  
    {en:"backing up toward me", ko:"나를 향해 후진하다", example:"The truck started backing up toward me and eventually hit my car."},
    {en:"staying in her lane", ko:"자기 차선을 지키다", example:"My friend was staying in her lane but the car next to her kept drifting."},
    {en:"scraped the side of her car", ko:"차 옆을 긁다", example:"The car drifted out of its lane and scraped the side of her car."},
    {en:"makes me feel at ease", ko:"나를 편안하게 해주다", example:"He makes me feel at ease and tells me everything will be okay."},
    {en:"really comforted me", ko:"정말 위로가 됐다", example:"Thank you. What you just said really comforted me."},
    {en:"doesn't comfort me at all", ko:"전혀 위로가 안된다", example:"This doesn't comfort me at all."},
    {en:"money doesn't grow on trees", ko:"돈은 나무에서 자라지 않는다", example:"Money doesn't grow on trees."},
    {en:"at the top of my travel list", ko:"여행 리스트 최상위", example:"The Maldives is at the top of my travel list."},
    {en:"miss my family and friends", ko:"가족과 친구가 그립다", example:"I miss my family and friends in Korea."},
    {en:"turning right without signaling", ko:"깜빡이 없이 우회전하다", example:"I hit a motorcycle while turning right without signaling."},
  ],
};

const SPEAKING_TOPICS = [
  
  ...BASIC_SPEAKING_DATA.map(t => ({ ...t, icon: SPEAKING_ICON_MAP[t.icon_name] || BookOpen })),
];

/* ----------------------------- Speech recognition --------------------------- */

// ── Level definitions ──
const LEVELS = [
  {n:1, label:"Lv 1 — 천천히", badge:"🟢", speed:0.82, desc:"천천히, 또렷하게", dictation:false},
  {n:2, label:"Lv 2 — 자연스럽게", badge:"🔵", speed:0.94, desc:"자연스러운 속도", dictation:false},
  {n:3, label:"Lv 3 — 살짝 빠름", badge:"💜", speed:1.05, desc:"살짝 빠른 속도", dictation:false},
  {n:4, label:"Lv 4 — 연음·축약", badge:"🟠", speed:1.15, desc:"연음과 축약 포함", dictation:false},
  {n:5, label:"Lv 5 — 원어민 속도", badge:"🔴", speed:1.25, desc:"원어민 풀스피드", dictation:false},
];


function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/* ------------------------------ Pattern / Drill ----------------------------- */


function quickCheckSystem(anchorText) {
  return `You are a friendly English coach. The learner is practicing using: "${anchorText}". They wrote their own sentence trying to use it naturally. Return ONLY valid JSON, no markdown fences:
{"good":true/false,"feedback_ko:"짧고 따뜻한 한국어 피드백 한 줄"}
Be encouraging but accurate.`;
}

function scaffoldedCheckSystem(anchor, questionKo) {
  return `You are helping a Korean adult learner practice writing an English sentence about: "${anchor}". Prompt: "${questionKo}".
Evaluate their sentence and return ONLY valid JSON, no markdown fences:
{"good":true/false,"corrected":"the corrected/improved version (even if good, show the most natural form)","feedback_ko:"1-2 따뜻한 한국어 피드백 문장","alternatives":[{"en:"another natural way to say this","ko:"한국어로 짧게 어떻게 다른지 설명"},{"en:"a second natural variation","ko:"설명"},{"en:"a third variation (different register or context)","ko:"설명"}]}
Always provide exactly 3 alternatives that feel genuinely different — vary the structure, formality, or context. Keep all English sentences short and natural.`;
}



const TABS = [
  { id: "map", label: "Listen", icon: MapIcon },
  { id: "situation", label: "Scenario", icon: Zap },
  { id: "speaking", label: "Real Life", icon: Mic },
  { id: "my", label: "My", icon: Users },
];

function suggestSpeakingTopic(focusAreas) {
  if (!focusAreas || !focusAreas.length) return null;
  const text = focusAreas.join(" ");
  // Map focus areas to SPEAKING_TOPICS by keyword matching on label_ko
  return SPEAKING_TOPICS.find(t =>
    text.includes("관사") && t.id === "abbreviations" ||
    text.includes("전치사") && (t.id === "preposition-noun" || t.id === "preposition-by") ||
    text.includes("시제") && t.id === "should-have" ||
    text.includes("가정") && t.id === "would-could-should-have" ||
    text.includes("조건") && t.id === "would-could-should-have" ||
    text.includes("희망") && t.id === "hope-wish" ||
    text.includes("의문") && t.id === "question-tense" ||
    text.includes("phrasal") && t.id === "phrasal-verbs-out"
  ) || SPEAKING_TOPICS[0] || null;
}

/* --------------------------- Listening & Shadowing -------------------------- */

let cachedEnglishVoice = null;
// Eagerly cache English voice as soon as voices are available
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  function _cacheVoice() {
    const vs = window.speechSynthesis.getVoices();
    cachedEnglishVoice = vs.find(v => v.lang === "en-US" && v.name.includes("Google"))
      || vs.find(v => v.lang === "en-US")
      || vs.find(v => (v.lang || "").startsWith("en"))
      || vs[0] || null;
  }
  _cacheVoice();
  window.speechSynthesis.onvoiceschanged = _cacheVoice;
}

let _ttsQueue = Promise.resolve();

// ── Convert numbers to English words for TTS ──
function numberToWords(num) {
  const ones = ["","one","two","three","four","five","six","seven","eight","nine",
    "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  if (num === 0) return "zero";
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] : "");
  if (num < 1000) return ones[Math.floor(num/100)] + " hundred" + (num%100 ? " " + numberToWords(num%100) : "");
  if (num < 10000) return ones[Math.floor(num/1000)] + " thousand" + (num%1000 ? " " + numberToWords(num%1000) : "");
  return String(num);
}

function prepareTextForTTS(text) {
  // Convert standalone numbers to words
  return text
    .replace(/(\d+)/g, (match, num) => {
      const n = parseInt(num);
      if (n <= 10000) return numberToWords(n);
      return match;
    })
    // Fix common TTS issues
    .replace(/KL/g, "K L")
    .replace(/OK/g, "okay")
    .replace(/Dr\./g, "Doctor")
    .replace(/Mr\./g, "Mister")
    .replace(/Mrs\./g, "Missus")
    .replace(/St\./g, "Street")
    .replace(/gonna/g, "going to")
    .replace(/wanna/g, "want to")
    .replace(/gotta/g, "got to");
}


function speakText(rawText, rate = 1.15) {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  const text = prepareTextForTTS(rawText);
  const cleaned = cleanForSpeech(text);
  if (!cleaned || cleaned.length < 1) return Promise.resolve();

  try { window.speechSynthesis.cancel(); } catch(e) {}
  _ttsQueue = Promise.resolve();

  _ttsQueue = _ttsQueue.then(() => new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(cleaned);
      u.lang = "en-US";
      u.rate = Math.max(0.4, Math.min(2.0, rate));
      u.volume = 1.0;
      u.pitch = 1.0;

      const doSpeak = () => {
        const voices = synth.getVoices();
        const enVoice =
          voices.find(v => v.lang === "en-US" && v.name.includes("Samantha")) ||
          voices.find(v => v.lang === "en-US") ||
          voices.find(v => v.lang === "en-GB") ||
          voices.find(v => v.lang.startsWith("en"));
        if (enVoice) u.voice = enVoice;

        // iOS: resume if paused
        const resumeInterval = setInterval(() => {
          if (synth.paused) synth.resume();
        }, 250);

        u.onend = () => { clearInterval(resumeInterval); resolve(); };
        u.onerror = (e) => { clearInterval(resumeInterval); resolve(); };

        // iOS Safari needs a tiny delay after cancel
        setTimeout(() => {
          try { synth.speak(u); } catch(e) { resolve(); }
        }, 50);

        // Fallback timeout
        setTimeout(() => { clearInterval(resumeInterval); resolve(); }, 15000);
      };

      const voices = synth.getVoices();
      if (voices.length > 0) {
        doSpeak();
      } else {
        synth.onvoiceschanged = () => { synth.onvoiceschanged = null; doSpeak(); };
        setTimeout(doSpeak, 500);
      }
    } catch(e) { resolve(); }
  }));
  return _ttsQueue;
}

let _koQueue = Promise.resolve();

function speakKorean(text, rate = 1.05) {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  const cleaned = cleanForKoreanSpeech(text);
  if (!cleaned || cleaned.length < 1) return Promise.resolve();

  _koQueue = _koQueue.then(() => new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(cleaned);
      u.lang = "ko-KR";
      u.rate = Math.max(0.8, Math.min(1.8, rate));
      u.volume = 1.0;

      const trySpeak = () => {
        const voices = synth.getVoices();
        const koVoice = voices.find(v => v.lang === "ko-KR" || v.lang === "ko");
        if (koVoice) u.voice = koVoice;
        const resumeInterval = setInterval(() => { if (synth.paused) synth.resume(); }, 500);
        u.onend = () => { clearInterval(resumeInterval); resolve(); };
        u.onerror = () => { clearInterval(resumeInterval); resolve(); };
        synth.speak(u);
        setTimeout(() => { clearInterval(resumeInterval); resolve(); }, 12000);
      };

      const voices = synth.getVoices();
      if (voices.length > 0) { trySpeak(); }
      else { synth.addEventListener("voiceschanged", trySpeak, { once: true }); setTimeout(trySpeak, 1000); }
    } catch(e) { resolve(); }
  }));
  return _koQueue;
}


function cleanForSpeech(text) {
  return (text || "")
    .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[🎉🎊🎯🎤🔊📖✍️🔍📝✓✗★☆→←↑↓]/gu, " ") // emojis/icons
    .replace(/\s*\/\s*/g, ", ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[\[\]{}⟨⟩<>]/g, " ")
    .replace(/[#*@→←↑↓…—–_~`^\\|+]/g, " ")
    .replace(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]+/g, "")
    .replace(/\d+\./g, m => m.replace(".", ""))
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanForKoreanSpeech(text) {
  return (text || "")
    .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[🎉🎊🎯🎤🔊📖✍️🔍📝✓✗★☆→←↑↓]/gu, " ") // emojis
    .replace(/[\[\]{}()\*#→←↑↓…—–_~`^\\|<>+@!]/g, " ")
    .replace(/\d+\./g, m => m.replace(".", ""))
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Shared mic helper — continuous mode so full sentences get captured.
function startRecognition(onTranscript, onEnd) {
  const SpeechRec = getSpeechRecognition();
  if (!SpeechRec) return null;
  try {
    let finalText = "";
    let active = true;
    const r = new SpeechRec();
    r.lang = "en-US";
    r.continuous = false;    // false is more compatible across browsers
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      onTranscript((finalText + interim).trim());
    };

    r.onerror = (ev) => {
      if (ev.error === "no-speech") {
        // restart silently on silence
        if (active) try { r.start(); } catch(e2) { active = false; onEnd && onEnd(); }
      } else {
        active = false;
        onEnd && onEnd();
      }
    };

    r.onend = () => {
      if (active) {
        // auto-restart to simulate continuous
        try { r.start(); } catch(e2) { active = false; onEnd && onEnd(); }
      } else {
        onEnd && onEnd();
      }
    };

    // patch stop to set active=false first
    const origStop = r.stop.bind(r);
    r.stop = () => { active = false; try { origStop(); } catch(e2) {} };

    r.start();
    return r;
  } catch(e) {
    onEnd && onEnd();
    return null;
  }
}

// Sound effects for quiz feedback
function playSound(correct) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (correct) {
      // ding-dong: two rising tones
      [[523.25, 0], [659.25, 0.18]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.35, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.45);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.5);
      });
    } else {
      // buzz: low sawtooth
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.value = 120;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    }
  } catch(e) {}
}


const LISTENING_STEP_DEFS = [
  { key: "pre", label: "사전학습" },
  { key: "listen", label: "듣기" },
  { key: "shadow", label: "쉐도잉" },
  { key: "check", label: "확인" },
  { key: "chat", label: "AI 대화" },
];


/* ------------------------------ Theme Talk -------------------------------- */

function themeRoleplaySystem(theme) {
  const vocab = (theme.vocab || []).map(v => v.en).filter(Boolean).slice(0,8).join(", ") || "general English expressions";
  const patterns = (theme.patterns || []).map(p => p.pattern_en).filter(Boolean).slice(0,4).join(", ") || "";
  return `You are a friendly English conversation coach doing a 10-question interview with a Korean adult learner.
Topic they just studied: "${theme.label_ko}"
Key expressions to elicit: ${vocab}
Key patterns to use: ${patterns}

RULES:
1. Ask ONE question per turn in natural English
2. Questions must naturally lead the learner to USE the vocab and patterns above
3. After each answer, give 1-2 sentences of feedback in Korean (encourage + fix grammar gently)
4. Then ask the next question
5. Count questions internally — after 10 questions say "오늘 정말 잘하셨어요! 🎉" + brief Korean summary
6. Keep questions real and relevant (Korean adult life, here, daily situations)
7. If learner uses a target expression correctly, praise specifically in Korean

Example flow:
- You: "Have you ever been to a restaurant here here?" 
- After answer: "잘 하셨어요! '~에 가본 적 있어요'를 잘 쓰셨네요. 그런데..."
- Next question using another target expression

Ask your first question directly. No introduction needed.`;
}

// Per-item vocab examples — called for ONE vocab item at a time to stay within token limits
function vocabItemSystem(topicLabel, vocabEn, vocabKo) {
  return `Generate English example sentences for ONE vocabulary item from a lesson about: ${topicLabel}.
Expression: "${vocabEn}" (Korean meaning: ${vocabKo})
IMPORTANT: ALL examples must be in ENGLISH only. No Korean in examples.
Return ONLY valid JSON, no markdown fences:
{"examples":["Short English example 1.","Short English example 2.","Short English example 3."],"speaking_ko:"한국어로 학습자에게 주는 말하기 지시 (예: '카페에서 예약할 때 써보세요')","scaffold":[{"en:"useful English phrase","ko:"한국어 뜻"},{"en:"another phrase","ko:"뜻"}]}
All 3 examples must be natural English sentences. Short and conversational.`;
}

function quizGenerateSystem(theme) {
  const vocab = (theme.vocab || []).map(v => v.en.split("/")[0].trim()).slice(0, 6).join(", ");
  const pats = (theme.patterns || []).map(p => p.pattern_en || p.explain_ko || "").filter(Boolean).slice(0, 3).join(", ");
  const name = theme.label_ko || theme.label || "English";
  return `Generate 6 English grammar exercises. Theme: ${name}. Vocab: ${vocab}. Patterns: ${pats}.
Return ONLY valid JSON (no markdown, no extra text):
{"exercises":[
{"type:"find_errors","prompt":"Short English sentence with ONE grammar error","hint_ko:"힌트","reference":"corrected sentence","error_explanation_ko:"왜 틀렸는지 한 문장"},
{"type:"find_errors","prompt":"Another short sentence with ONE error","hint_ko:"힌트","reference":"corrected","error_explanation_ko:"설명"},
{"type:"fill_blank","prompt":"English sentence with ___","hint_ko:"힌트","reference":"missing word","options":["correct","wrong1","wrong2","wrong3"]},
{"type:"fill_blank","prompt":"Another sentence with ___","hint_ko:"힌트","reference":"answer","options":["correct","wrong1","wrong2","wrong3"]},
{"type:"complete","prompt":"한국어 상황 (짧게) → write English","hint_ko:"힌트","reference":"English answer"},
{"type:"complete","prompt":"Another 한국어 상황","hint_ko:"힌트","reference":"answer"}
]}
Exactly 6 exercises. All based on today's vocab/patterns above.`;
}


const THEME_STAGE_TABS = [
  { id: "vocab", label: "표현" },
  { id: "pattern", label: "패턴" },
  { id: "quiz", label: "연습" },
  { id: "roleplay", label: "🎤 인터뷰" },
];

const QUIZ_TYPE_LABELS = {
  find_errors: "오류 찾기",
  unscramble: "문장 배열",
  fill_blank: "빈칸 채우기",
  complete: "문장 완성",
};

const SITUATION_CATEGORIES = [];

const THEME_TALKS = [
  {
    id: "restaurant-reservation",
    label_ko: "식당 예약 · 취소 · 변경",
    emoji: "📞",
    iconA: MessageSquare, iconB: Zap,
    context_en: "Booking, canceling, or changing a restaurant reservation.",
    vocab: [
      {en:"make a reservation",ko:"예약하다"},
      {en:"reserve a table",ko:"테이블을 예약하다"},
      {en:"book a table",ko:"테이블을 예약하다"},
      {en:"cancel a reservation",ko:"예약을 취소하다"},
      {en:"reschedule a reservation",ko:"예약을 변경하다"},
      {en:"available table",ko:"빈 테이블"},
      {en:"table for {number}",ko:"{number}명 테이블"},
      {en:"under my name",ko:"내 이름으로"},
      {en:"contact number",ko:"연락처"},
      {en:"this Saturday at {time}",ko:"이번 토요일 {time}시에"},
    ],
    patterns: [
      {pattern_en:"I would like to V.",explain_ko:"~하고 싶어요 — 정중한 요청",examples:[
        {ko:"예약하고 싶어요.",en:"I would like to make a reservation."},
        {ko:"테이블 예약하고 싶어요.",en:"I would like to reserve a table."},
        {ko:"예약을 취소하고 싶어요.",en:"I would like to cancel my reservation."},
      ]},
      {pattern_en:"I would like to V for {number} on {date} at {time}.",explain_ko:"인원·날짜·시간 한 문장에",examples:[
        {ko:"7월 1일 12시에 5명 예약하고 싶어요.",en:"I would like to book a table for 5 on July 1 at 12."},
        {ko:"월요일 10시에 3명 예약하고 싶어요.",en:"I would like to reserve a table for 3 on Monday at 10."},
        {ko:"이번 토요일 6시에 8명 예약하고 싶어요.",en:"I would like to make a reservation for 8 this Saturday at 6."},
      ]},
      {pattern_en:"Can I V?",explain_ko:"~할 수 있을까요?",examples:[
        {ko:"2명 테이블 예약할 수 있을까요?",en:"Can I book a table for 2?"},
        {ko:"4명 예약할 수 있을까요?",en:"Can I reserve a table for 4?"},
        {ko:"예약을 변경할 수 있을까요?",en:"Can I reschedule my reservation?"},
      ]},
      {pattern_en:"Do you have any N available for {number}?",explain_ko:"~명 자리 있나요?",examples:[
        {ko:"8명 자리 있나요?",en:"Do you have any tables available for 8?"},
        {ko:"5명 자리 있나요?",en:"Do you have any seats available for 5?"},
        {ko:"3명 자리 있나요?",en:"Do you have anything available for 3?"},
      ]},
      {pattern_en:"I have a reservation under {name}.",explain_ko:"~이름으로 예약했어요",examples:[
        {ko:"그레이스 이름으로 예약했어요.",en:"I have a reservation under Grace."},
        {ko:"김 이름으로 예약했어요.",en:"I have a reservation under Kim."},
        {ko:"제 이름으로 예약했어요.",en:"I have a reservation under my name."},
      ]},
    ],
    expressions: [
      {en:"I would like to make a reservation.",ko:"예약하고 싶어요."},
      {en:"I would like to book a table for {number} on {date} at {time}.",ko:"{date} {time}에 {number}명 예약하고 싶어요."},
      {en:"Can I reschedule my reservation?",ko:"예약을 변경할 수 있을까요?"},
      {en:"Can I cancel my reservation?",ko:"예약을 취소할 수 있을까요?"},
      {en:"Do you have any tables available for {number}?",ko:"{number}명 자리 있나요?"},
      {en:"I have a reservation under {name}.",ko:"{name} 이름으로 예약했어요."},
      {en:"There will be {number} people.",ko:"{number}명이 갈 거예요."},
      {en:"My contact number is {number}.",ko:"제 연락처는 {number}예요."},
    ]
  },
  {
    id: "restaurant-ordering",
    label_ko: "식당 자리 & 주문하기",
    emoji: "🍽",
    iconA: Zap, iconB: Users,
    context_en: "Getting seated, waiting, and ordering food.",
    vocab: [
      {en:"table for {number}",ko:"{number}명 테이블"},
      {en:"party of {number}",ko:"{number}명이요"},
      {en:"{number} of us",ko:"저희 {number}명이요"},
      {en:"waiting list",ko:"웨이팅 명단"},
      {en:"a few more minutes",ko:"조금 더 시간"},
      {en:"ready to order",ko:"주문 준비됨"},
      {en:"bring it to the table",ko:"테이블로 가져다주다"},
      {en:"pick it up",ko:"가지러 가다"},
      {en:"go with {dish}",ko:"{dish}로 할게요"},
      {en:"recommend something popular",ko:"인기 메뉴 추천"},
    ],
    patterns: [
      {pattern_en:"Table for {number}.",explain_ko:"{number}명이요 — 제일 간단한 표현",examples:[
        {ko:"5명이요.",en:"Table for 5."},
        {ko:"3명이요.",en:"Table for 3."},
        {ko:"2명이요.",en:"Table for 2, please."},
      ]},
      {pattern_en:"Can I have N?",explain_ko:"~주세요 — 요청할 때",examples:[
        {ko:"조금 더 시간 주세요.",en:"Can I have a few more minutes?"},
        {ko:"메뉴판 주세요.",en:"Can I have a menu?"},
        {ko:"4명 테이블 주세요.",en:"Can I have a table for four?"},
      ]},
      {pattern_en:"We are not ready to V yet.",explain_ko:"아직 ~할 준비가 안 됐어요",examples:[
        {ko:"아직 주문 준비가 안 됐어요.",en:"We are not ready to order yet."},
        {ko:"아직 결정을 못 했어요.",en:"We are not ready to decide yet."},
        {ko:"아직 고르지 못했어요.",en:"We are not ready to choose yet."},
      ]},
      {pattern_en:"I will go with N.",explain_ko:"~로 할게요 — 주문할 때",examples:[
        {ko:"치킨라이스로 할게요.",en:"I will go with chicken rice."},
        {ko:"매운 국수로 할게요.",en:"I will go with spicy noodles."},
        {ko:"마르게리타 피자로 할게요.",en:"I will go with the margarita pizza."},
      ]},
    ],
    expressions: [
      {en:"Table for {number}.",ko:"{number}명이요."},
      {en:"There are {number} of us.",ko:"저희 {number}명이요."},
      {en:"How long is the wait?",ko:"얼마나 기다려요?"},
      {en:"Can you put my name on the waiting list?",ko:"웨이팅 명단에 올려주세요."},
      {en:"Can I have a few more minutes?",ko:"조금 더 시간 주세요."},
      {en:"We are not ready to order yet.",ko:"아직 주문 준비가 안 됐어요."},
      {en:"I will go with {dish}.",ko:"{dish}로 할게요."},
      {en:"Can you recommend something popular?",ko:"인기 메뉴 추천해주세요."},
    ]
  },
  {
    id: "restaurant-complaint",
    label_ko: "식당 요청 & 변경",
    emoji: "🍜",
    iconA: Zap, iconB: Zap,
    context_en: "Making special requests while ordering food.",
    vocab: [
      {en:"extra plate",ko:"추가 접시"},
      {en:"share plate",ko:"나눠먹을 접시"},
      {en:"extra sauce",ko:"소스 추가"},
      {en:"on the side",ko:"따로"},
      {en:"split into two plates",ko:"두 접시로 나누기"},
      {en:"divide into two servings",ko:"두 인분으로 나누기"},
      {en:"cut in half",ko:"반으로 자르기"},
      {en:"substitute A for B",ko:"A 대신 B"},
      {en:"instead of",ko:"대신에"},
      {en:"without {ingredient}",ko:"{ingredient} 빼고"},
    ],
    patterns: [
      {pattern_en:"Can I get extra N?",explain_ko:"~추가로 주세요",examples:[
        {ko:"소스 더 주세요.",en:"Can I get extra sauce?"},
        {ko:"접시 더 주세요.",en:"Can I get extra plates?"},
        {ko:"치즈 더 주세요.",en:"Can I get extra cheese?"},
      ]},
      {pattern_en:"Can you put N on the side?",explain_ko:"~따로 주세요",examples:[
        {ko:"소스 따로 주세요.",en:"Can you put the sauce on the side?"},
        {ko:"드레싱 따로 주세요.",en:"Can you put the dressing on the side?"},
        {ko:"얼음 따로 주세요.",en:"Can you put the ice on the side?"},
      ]},
      {pattern_en:"Can you split this into {number} plates?",explain_ko:"{number} 접시로 나눠주세요",examples:[
        {ko:"두 접시로 나눠주세요.",en:"Can you split this into two plates?"},
        {ko:"두 인분으로 나눠주세요.",en:"Can you divide this into two servings?"},
        {ko:"세 조각으로 잘라주세요.",en:"Can you cut this into three pieces?"},
      ]},
      {pattern_en:"I would like my N without N.",explain_ko:"~없이 주세요",examples:[
        {ko:"파스타에 양파 빼주세요.",en:"I would like my pasta without onion."},
        {ko:"샐러드에 드레싱 빼주세요.",en:"I would like my salad without dressing."},
        {ko:"국수에 파 빼주세요.",en:"I would like my noodles without green onion."},
      ]},
    ],
    expressions: [
      {en:"Can I get extra sauce?",ko:"소스 더 주세요."},
      {en:"Can you put the sauce on the side?",ko:"소스 따로 주세요."},
      {en:"Can you split this into two plates?",ko:"두 접시로 나눠주세요."},
      {en:"Is it possible to substitute fries for salad?",ko:"감자튀김 대신 샐러드로 바꿀 수 있나요?"},
      {en:"I would like my pasta without onion.",ko:"파스타에 양파 빼주세요."},
      {en:"Is there an extra charge for that?",ko:"추가 요금이 있나요?"},
    ]
  },
  {
    id: "restaurant-questions",
    label_ko: "주문 실수 · 포장 · 계산",
    emoji: "🧾",
    iconA: Briefcase, iconB: Zap,
    context_en: "Wrong orders, delayed food, packing, and payment.",
    vocab: [
      {en:"wrong order",ko:"잘못된 주문"},
      {en:"not what I ordered",ko:"내가 주문한 게 아닌"},
      {en:"without onion",ko:"양파 빼고"},
      {en:"my order went in",ko:"주문이 들어갔다"},
      {en:"how much longer",ko:"얼마나 더"},
      {en:"undercooked",ko:"덜 익은"},
      {en:"not fresh",ko:"신선하지 않은"},
      {en:"a fresh one",ko:"새것"},
      {en:"take this home",ko:"포장해가다"},
      {en:"split the bill",ko:"계산서 나누기"},
    ],
    patterns: [
      {pattern_en:"I ordered A, but B.",explain_ko:"~주문했는데 다르게 왔어요",examples:[
        {ko:"치킨 주문했는데 새우가 왔어요.",en:"I ordered chicken, but this is shrimp."},
        {ko:"양파 빼달라고 했는데 들어있어요.",en:"I ordered it without onion, but it has onion."},
        {ko:"고구마튀김 주문했는데 감자튀김이 왔어요.",en:"I ordered sweet potato fries, but these are French fries."},
      ]},
      {pattern_en:"Can you check if S + V?",explain_ko:"~인지 확인해주세요",examples:[
        {ko:"주문이 들어갔는지 확인해주세요.",en:"Can you check if my order went in?"},
        {ko:"음식이 거의 다 됐는지 확인해주세요.",en:"Can you check if my food is almost ready?"},
        {ko:"이게 제가 주문한 게 맞는지 확인해주세요.",en:"Can you check if this is what I ordered?"},
      ]},
      {pattern_en:"It has been {number} minutes.",explain_ko:"{number}분이 지났어요",examples:[
        {ko:"20분이 지났어요.",en:"It has been 20 minutes."},
        {ko:"20분도 넘게 지났어요.",en:"It has been more than 20 minutes."},
        {ko:"오래 지났어요.",en:"It has been a long time."},
      ]},
      {pattern_en:"Can you V this?",explain_ko:"~해주세요",examples:[
        {ko:"포장해주세요.",en:"Can you wrap this?"},
        {ko:"담아주세요.",en:"Can you pack this?"},
        {ko:"계산서 가져다주세요.",en:"Can you bring the bill?"},
      ]},
    ],
    expressions: [
      {en:"This is not what I ordered.",ko:"이건 제가 주문한 게 아니에요."},
      {en:"Can you check if my order went in?",ko:"주문이 들어갔는지 확인해주세요."},
      {en:"It has been 20 minutes.",ko:"20분이 지났어요."},
      {en:"Can I get a fresh one?",ko:"새것으로 주세요."},
      {en:"Can you wrap this?",ko:"포장해주세요."},
      {en:"Can we split the bill?",ko:"계산서 나눠주세요."},
    ]
  },
  {
    id: "coffee-ordering",
    label_ko: "카페 · 진열대 주문",
    emoji: "☕",
    iconA: Zap, iconB: Zap,
    context_en: "Choosing items from a display case and ordering cafe food/drinks.",
    vocab: [
      {en:"the one in the middle",ko:"가운데 것"},
      {en:"the one on the right",ko:"오른쪽 것"},
      {en:"the one in the front",ko:"앞쪽 것"},
      {en:"the one in the back",ko:"뒤쪽 것"},
      {en:"the top shelf",ko:"위 칸"},
      {en:"the bottom shelf",ko:"아래 칸"},
      {en:"the second one from the right",ko:"오른쪽에서 두 번째"},
      {en:"the one with {noun}",ko:"{noun} 있는 것"},
      {en:"iced latte",ko:"아이스 라떼"},
      {en:"to go",ko:"포장"},
    ],
    patterns: [
      {pattern_en:"The one + preposition.",explain_ko:"~에 있는 것 — 진열대에서 고를 때",examples:[
        {ko:"가운데 것이요.",en:"The one in the middle."},
        {ko:"오른쪽 것이요.",en:"The one on the right."},
        {ko:"아래쪽 것이요.",en:"The one at the bottom."},
      ]},
      {pattern_en:"The {order} one from the {direction}.",explain_ko:"~쪽에서 ~번째 것",examples:[
        {ko:"오른쪽에서 두 번째요.",en:"The second one from the right."},
        {ko:"위에서 세 번째요.",en:"The third one from the top."},
        {ko:"아래에서 두 번째요.",en:"The second one from the bottom."},
      ]},
      {pattern_en:"Can I have the one with N?",explain_ko:"~있는 것으로 주세요",examples:[
        {ko:"휘핑크림 있는 것으로 주세요.",en:"Can I have the one with whipped cream?"},
        {ko:"딸기 있는 것으로 주세요.",en:"Can I have the one with strawberries?"},
        {ko:"스프링클 있는 것으로 주세요.",en:"Can I have the one with sprinkles?"},
      ]},
      {pattern_en:"Can you V it?",explain_ko:"~해주세요",examples:[
        {ko:"데워주세요.",en:"Can you heat it up?"},
        {ko:"따뜻하게 해주세요.",en:"Can you warm it up?"},
        {ko:"잘라주세요.",en:"Can you slice it for me?"},
      ]},
    ],
    expressions: [
      {en:"The one in the middle.",ko:"가운데 것이요."},
      {en:"The second one from the right.",ko:"오른쪽에서 두 번째요."},
      {en:"Can I have the one with whipped cream?",ko:"휘핑크림 있는 것으로 주세요."},
      {en:"What is in this?",ko:"이 안에 뭐가 들어있나요?"},
      {en:"Can you heat it up?",ko:"데워주세요."},
      {en:"To go, please.",ko:"포장이요."},
    ]
  },
  {
    id: "custom-order",
    label_ko: "메뉴 질문 & 추천",
    emoji: "📋",
    iconA: MessageSquare, iconB: Zap,
    context_en: "Asking about ingredients, size, portion, and recommendations.",
    vocab: [
      {en:"come with {item}",ko:"{item} 같이 나오다"},
      {en:"included in {dish}",ko:"{dish}에 포함된"},
      {en:"ingredients",ko:"재료"},
      {en:"how spicy",ko:"얼마나 매운"},
      {en:"how sweet",ko:"얼마나 단"},
      {en:"portion size",ko:"양"},
      {en:"enough for {number}",ko:"{number}명 충분"},
      {en:"extra charge",ko:"추가 요금"},
      {en:"not too spicy",ko:"너무 맵지 않은"},
      {en:"without cilantro",ko:"고수 없이"},
    ],
    patterns: [
      {pattern_en:"Does it come with N?",explain_ko:"~같이 나오나요?",examples:[
        {ko:"밥이 같이 나오나요?",en:"Does it come with rice?"},
        {ko:"감자튀김이 같이 나오나요?",en:"Does it come with fries?"},
        {ko:"크림치즈가 같이 나오나요?",en:"Does it come with cream cheese?"},
      ]},
      {pattern_en:"Is there any N in it?",explain_ko:"~가 들어있나요?",examples:[
        {ko:"양파가 들어있나요?",en:"Is there any onion in it?"},
        {ko:"고수가 들어있나요?",en:"Is there any cilantro in it?"},
        {ko:"파가 들어있나요?",en:"Is there any green onion in it?"},
      ]},
      {pattern_en:"How ADJ is it?",explain_ko:"얼마나 ~해요?",examples:[
        {ko:"얼마나 매워요?",en:"How spicy is it?"},
        {ko:"얼마나 달아요?",en:"How sweet is it?"},
        {ko:"얼마나 커요?",en:"How big is it?"},
      ]},
      {pattern_en:"Could you recommend something ADJ?",explain_ko:"~한 거 추천해주세요",examples:[
        {ko:"너무 맵지 않은 거 추천해주세요.",en:"Could you recommend something not too spicy?"},
        {ko:"가벼운 거 추천해주세요.",en:"Could you recommend something light?"},
        {ko:"덜 단 거 추천해주세요.",en:"Could you recommend something less sweet?"},
      ]},
    ],
    expressions: [
      {en:"Does it come with rice?",ko:"밥이 같이 나오나요?"},
      {en:"Is there any onion in it?",ko:"양파가 들어있나요?"},
      {en:"How spicy is it?",ko:"얼마나 매워요?"},
      {en:"Is it enough for 3 people?",ko:"3명이 먹기 충분한가요?"},
      {en:"Could you recommend something not too spicy?",ko:"너무 맵지 않은 거 추천해주세요."},
      {en:"Is there an extra charge for that?",ko:"추가 요금이 있나요?"},
    ]
  },
  {
    id: "hotel-service",
    label_ko: "호텔 체크인 · 체크아웃 · 시설",
    emoji: "🏨",
    iconA: Briefcase, iconB: Zap,
    context_en: "Checking in/out and asking about hotel facilities or room issues.",
    vocab: [
      {en:"check-in time",ko:"체크인 시간"},
      {en:"check-out time",ko:"체크아웃 시간"},
      {en:"breakfast hours",ko:"조식 시간"},
      {en:"swimming pool hours",ko:"수영장 시간"},
      {en:"early check-in",ko:"얼리 체크인"},
      {en:"late check-out",ko:"늦은 체크아웃"},
      {en:"under my name",ko:"내 이름으로"},
      {en:"included with my room",ko:"룸 포함"},
      {en:"extra towels",ko:"수건 추가"},
      {en:"locked out of my room",ko:"방에 못 들어가다"},
    ],
    patterns: [
      {pattern_en:"What time is N?",explain_ko:"~는 몇 시예요?",examples:[
        {ko:"체크인은 몇 시예요?",en:"What time is check-in?"},
        {ko:"체크아웃은 몇 시예요?",en:"What time is check-out?"},
        {ko:"조식은 몇 시예요?",en:"What time is breakfast?"},
      ]},
      {pattern_en:"Is N included with my room?",explain_ko:"~가 룸에 포함돼 있나요?",examples:[
        {ko:"조식이 포함돼 있나요?",en:"Is breakfast included with my room?"},
        {ko:"세탁 서비스가 포함돼 있나요?",en:"Is laundry service included with my room?"},
        {ko:"키즈 클럽이 포함돼 있나요?",en:"Is the kids club included with my room?"},
      ]},
      {pattern_en:"Can I request N?",explain_ko:"~요청할 수 있나요?",examples:[
        {ko:"얼리 체크인 요청할 수 있나요?",en:"Can I request early check-in?"},
        {ko:"최대한 늦은 체크아웃 요청할 수 있나요?",en:"Can I request the latest check-out?"},
        {ko:"업그레이드 요청할 수 있나요?",en:"Can I request an upgrade?"},
      ]},
      {pattern_en:"There is no N in my room.",explain_ko:"방에 ~가 없어요",examples:[
        {ko:"방에 뜨거운 물이 안 나와요.",en:"There is no hot water in my room."},
        {ko:"방에 에어컨이 안 돼요.",en:"There is no air conditioning in my room."},
        {ko:"방에 수건이 없어요.",en:"There is no towel in my room."},
      ]},
    ],
    expressions: [
      {en:"What time is check-in?",ko:"체크인은 몇 시예요?"},
      {en:"Is breakfast included with my room?",ko:"조식이 포함돼 있나요?"},
      {en:"Can I request early check-in?",ko:"얼리 체크인 요청할 수 있나요?"},
      {en:"Can I have two extra towels?",ko:"수건 두 장 더 주세요."},
      {en:"There is no hot water in my room.",ko:"방에 뜨거운 물이 안 나와요."},
      {en:"I am locked out of my room.",ko:"방에 못 들어가고 있어요."},
    ]
  },
  {
    id: "theme-park",
    label_ko: "티켓 · 입장 · 관광",
    emoji: "🎡",
    iconA: MapPin, iconB: MapPin,
    context_en: "Online tickets, QR codes, entrance rules, and rentals.",
    vocab: [
      {en:"online booking",ko:"온라인 예약"},
      {en:"separate entrance",ko:"별도 입구"},
      {en:"QR code",ko:"QR 코드"},
      {en:"annual pass",ko:"연간 패스"},
      {en:"re-entry",ko:"재입장"},
      {en:"outside food",ko:"외부 음식"},
      {en:"kids under {number}",ko:"{number}세 미만 어린이"},
      {en:"height requirement",ko:"키 제한"},
      {en:"group discount",ko:"단체 할인"},
      {en:"lost and found",ko:"분실물 센터"},
    ],
    patterns: [
      {pattern_en:"I booked N through N.",explain_ko:"~통해서 예약했어요",examples:[
        {ko:"Klook으로 예약했어요.",en:"I booked this through Klook."},
        {ko:"온라인으로 티켓 예약했어요.",en:"I booked my ticket online."},
        {ko:"앱으로 입장권 예약했어요.",en:"I booked the admission through the app."},
      ]},
      {pattern_en:"Is N allowed inside?",explain_ko:"~가 안에서 허용되나요?",examples:[
        {ko:"재입장 가능한가요?",en:"Is re-entry allowed inside?"},
        {ko:"외부 음식 반입 가능한가요?",en:"Is outside food allowed inside?"},
        {ko:"킥보드 가지고 들어갈 수 있나요?",en:"Is a scooter allowed inside?"},
      ]},
      {pattern_en:"Are kids under {number} free?",explain_ko:"{number}세 미만 어린이 무료인가요?",examples:[
        {ko:"3세 미만 무료인가요?",en:"Are kids under 3 free?"},
        {ko:"4세 미만 무료인가요?",en:"Are kids under 4 free?"},
        {ko:"5세 미만 무료인가요?",en:"Are kids under 5 free?"},
      ]},
      {pattern_en:"Where can I V N?",explain_ko:"~어디서 할 수 있나요?",examples:[
        {ko:"튜브 어디서 빌릴 수 있나요?",en:"Where can I rent a tube?"},
        {ko:"지도 어디서 받을 수 있나요?",en:"Where can I get a map?"},
        {ko:"분실물 센터 어디 있나요?",en:"Where can I find lost and found?"},
      ]},
    ],
    expressions: [
      {en:"I booked this through Klook.",ko:"Klook으로 예약했어요."},
      {en:"Is there a separate entrance for online booking?",ko:"온라인 예약 별도 입구 있나요?"},
      {en:"Is outside food allowed inside?",ko:"외부 음식 반입 가능한가요?"},
      {en:"Are kids under 4 free?",ko:"4세 미만 무료인가요?"},
      {en:"Where can I rent a tube?",ko:"튜브 어디서 빌릴 수 있나요?"},
    ]
  },
  {
    id: "shopping-refund",
    label_ko: "쇼핑 · 피팅룸 · 교환환불",
    emoji: "🛍",
    iconA: ShoppingBag, iconB: Zap,
    context_en: "Shopping, trying clothes on, asking for size/color.",
    vocab: [
      {en:"just browsing",ko:"그냥 보는 중"},
      {en:"looking for {item}",ko:"{item} 찾고 있어요"},
      {en:"another size",ko:"다른 사이즈"},
      {en:"another color",ko:"다른 색"},
      {en:"fitting room",ko:"피팅룸"},
      {en:"too tight",ko:"너무 꽉 낌"},
      {en:"too loose",ko:"너무 헐렁함"},
      {en:"one size smaller",ko:"한 사이즈 작은"},
      {en:"inside out",ko:"뒤집힘"},
      {en:"button it up",ko:"단추 잠그기"},
    ],
    patterns: [
      {pattern_en:"I am looking for N.",explain_ko:"~찾고 있어요",examples:[
        {ko:"양말 찾고 있어요.",en:"I am looking for socks."},
        {ko:"핑크 치마 찾고 있어요.",en:"I am looking for a pink skirt."},
        {ko:"무선 브라 찾고 있어요.",en:"I am looking for wireless bras."},
      ]},
      {pattern_en:"Do you have this in N?",explain_ko:"이거 ~있나요?",examples:[
        {ko:"이거 미디움 있나요?",en:"Do you have this in medium?"},
        {ko:"이거 6사이즈 있나요?",en:"Do you have this in size 6?"},
        {ko:"이거 다른 색 있나요?",en:"Do you have this in another color?"},
      ]},
      {pattern_en:"It is too ADJ on me.",explain_ko:"저한테 너무 ~해요",examples:[
        {ko:"저한테 너무 꽉 껴요.",en:"It is too tight on me."},
        {ko:"저한테 너무 헐렁해요.",en:"It is too loose on me."},
        {ko:"저한테 너무 커요.",en:"It is too big on me."},
      ]},
    ],
    expressions: [
      {en:"I am just browsing.",ko:"그냥 보는 중이에요."},
      {en:"Do you have this in medium?",ko:"이거 미디움 있나요?"},
      {en:"Where is the fitting room?",ko:"피팅룸 어디 있나요?"},
      {en:"It is too tight on me.",ko:"저한테 너무 꽉 껴요."},
      {en:"Can I try this on?",ko:"이거 입어볼 수 있나요?"},
    ]
  },
  {
    id: "doctor",
    label_ko: "병원 · 약국 · 증상",
    emoji: "🏥",
    iconA: Zap, iconB: Zap,
    context_en: "Describing symptoms and asking about medicine.",
    vocab: [
      {en:"headache",ko:"두통"},
      {en:"sore throat",ko:"목 아픔"},
      {en:"runny nose",ko:"콧물"},
      {en:"stuffy nose",ko:"코막힘"},
      {en:"fever",ko:"열"},
      {en:"cough",ko:"기침"},
      {en:"feel dizzy",ko:"어지러움"},
      {en:"prescription",ko:"처방전"},
      {en:"dosage",ko:"복용량"},
      {en:"side effect",ko:"부작용"},
    ],
    patterns: [
      {pattern_en:"I have N.",explain_ko:"~이 있어요 / ~해요",examples:[
        {ko:"두통이 있어요.",en:"I have a headache."},
        {ko:"목이 아파요.",en:"I have a sore throat."},
        {ko:"열이 있어요.",en:"I have a fever."},
      ]},
      {pattern_en:"I have had N for {period}.",explain_ko:"{period} 동안 ~이 있었어요",examples:[
        {ko:"이틀 동안 기침을 했어요.",en:"I have had a cough for two days."},
        {ko:"3일 동안 코가 막혔어요.",en:"I have had a stuffy nose for three days."},
        {ko:"어제부터 열이 있었어요.",en:"I have had a fever since yesterday."},
      ]},
      {pattern_en:"Can I take this with N?",explain_ko:"~랑 같이 먹어도 되나요?",examples:[
        {ko:"다른 약이랑 같이 먹어도 되나요?",en:"Can I take this with other medicine?"},
        {ko:"멀티비타민이랑 같이 먹어도 되나요?",en:"Can I take this with multivitamins?"},
        {ko:"항생제랑 같이 먹어도 되나요?",en:"Can I take this with antibiotics?"},
      ]},
    ],
    expressions: [
      {en:"I have a headache.",ko:"두통이 있어요."},
      {en:"I have had a fever since yesterday.",ko:"어제부터 열이 있었어요."},
      {en:"It hurts when I swallow.",ko:"삼킬 때 아파요."},
      {en:"Should I take it before or after a meal?",ko:"밥 먹기 전에 먹어야 하나요, 후에?"},
      {en:"Can I take this with other medicine?",ko:"다른 약이랑 같이 먹어도 되나요?"},
      {en:"Are there any side effects?",ko:"부작용이 있나요?"},
    ]
  },
  {
    id: "pharmacy",
    label_ko: "방향 찾기 · 여행 스몰톡",
    emoji: "🗺",
    iconA: MapPin, iconB: Zap,
    context_en: "Checking lines, entrances, exits, and travel small talk.",
    vocab: [
      {en:"the right line",ko:"맞는 줄"},
      {en:"the entrance",ko:"입구"},
      {en:"the exit",ko:"출구"},
      {en:"the way to {place}",ko:"{place} 가는 길"},
      {en:"line up here",ko:"여기서 줄 서다"},
      {en:"right place",ko:"맞는 곳"},
      {en:"get off here",ko:"여기서 내리다"},
      {en:"take a picture",ko:"사진 찍다"},
      {en:"one more picture",ko:"한 장 더"},
      {en:"Grab area",ko:"그랩 타는 곳"},
    ],
    patterns: [
      {pattern_en:"Is this the N for N?",explain_ko:"이게 ~를 위한 ~인가요?",examples:[
        {ko:"이게 롤러코스터 줄인가요?",en:"Is this the line for the roller coaster?"},
        {ko:"이게 온라인 예약 입구인가요?",en:"Is this the entrance for online booking?"},
        {ko:"여기가 그랩 타는 곳인가요?",en:"Is this the Grab area?"},
      ]},
      {pattern_en:"Am I in the right N?",explain_ko:"제가 맞는 ~에 있나요?",examples:[
        {ko:"제가 맞는 줄에 있나요?",en:"Am I in the right line?"},
        {ko:"제가 맞는 곳에 있나요?",en:"Am I in the right place?"},
        {ko:"제가 맞는 구역에 있나요?",en:"Am I in the right area?"},
      ]},
      {pattern_en:"Can you take a picture?",explain_ko:"사진 찍어주세요",examples:[
        {ko:"저희 사진 찍어주세요.",en:"Can you take a picture of us?"},
        {ko:"한 장 더 찍어주세요.",en:"Can you take one more picture?"},
        {ko:"다시 한번 찍어주세요.",en:"Can you try one more?"},
      ]},
    ],
    expressions: [
      {en:"Is this the right line?",ko:"이게 맞는 줄인가요?"},
      {en:"Do I need to line up here?",ko:"여기서 줄 서야 하나요?"},
      {en:"Am I in the right place?",ko:"제가 맞는 곳에 있나요?"},
      {en:"Do I get off here?",ko:"여기서 내려요?"},
      {en:"Can you take a picture of us?",ko:"저희 사진 찍어주세요."},
    ]
  },
  {
    id: "bank-dispute",
    label_ko: "길 찾기 · 장소 안내",
    emoji: "🗺",
    iconA: MapPin, iconB: MapPin,
    context_en: "Asking for and giving directions around town and malls.",
    vocab: [
      {en:"around here",ko:"이 근처"},
      {en:"from here",ko:"여기서"},
      {en:"go straight",ko:"직진하다"},
      {en:"turn left",ko:"왼쪽으로 돌다"},
      {en:"turn right",ko:"오른쪽으로 돌다"},
      {en:"across from {place}",ko:"{place} 맞은편"},
      {en:"next to {place}",ko:"{place} 옆"},
      {en:"behind {place}",ko:"{place} 뒤"},
      {en:"at the corner",ko:"모퉁이에"},
      {en:"on your right",ko:"오른쪽에"},
    ],
    patterns: [
      {pattern_en:"Is there N around here?",explain_ko:"이 근처에 ~있나요?",examples:[
        {ko:"이 근처에 은행 있나요?",en:"Is there a bank around here?"},
        {ko:"이 근처에 ATM 있나요?",en:"Is there an ATM around here?"},
        {ko:"이 근처에 슈퍼마켓 있나요?",en:"Is there a supermarket around here?"},
      ]},
      {pattern_en:"It is PREP N.",explain_ko:"~에 있어요 — 위치 설명",examples:[
        {ko:"버스 정류장 맞은편에 있어요.",en:"It is across from the bus stop."},
        {ko:"인쇄소 옆에 있어요.",en:"It is next to the print shop."},
        {ko:"Maybank 뒤에 있어요.",en:"It is behind Maybank."},
      ]},
      {pattern_en:"V and V.",explain_ko:"~하고 ~하세요 — 방향 알려줄 때",examples:[
        {ko:"직진하다가 오른쪽으로 도세요.",en:"Go straight and turn right."},
        {ko:"길 건너서 직진하세요.",en:"Cross the street and go straight."},
        {ko:"스타벅스 지나서 왼쪽으로 도세요.",en:"Pass Starbucks and turn left."},
      ]},
    ],
    expressions: [
      {en:"Where is the restroom?",ko:"화장실 어디 있나요?"},
      {en:"Is there an ATM around here?",ko:"이 근처에 ATM 있나요?"},
      {en:"It is across from the bus stop.",ko:"버스 정류장 맞은편에 있어요."},
      {en:"Go straight and turn right.",ko:"직진하다가 오른쪽으로 도세요."},
    ]
  },
  {
    id: "school-meeting",
    label_ko: "학부모 스몰톡 · 학교 상담",
    emoji: "🏫",
    iconA: BookOpen, iconB: Users,
    context_en: "Talking with parents or teachers about school and children.",
    vocab: [
      {en:"by the way",ko:"그런데"},
      {en:"phone number",ko:"전화번호"},
      {en:"this school",ko:"이 학교"},
      {en:"what year",ko:"몇 학년"},
      {en:"school event",ko:"학교 행사"},
      {en:"struggling with {subject}",ko:"{subject}을 힘들어하다"},
      {en:"extra support",ko:"추가 도움"},
      {en:"follow the rules",ko:"규칙을 따르다"},
      {en:"get along with friends",ko:"친구들과 잘 지내다"},
      {en:"encourage my child",ko:"아이를 격려하다"},
    ],
    patterns: [
      {pattern_en:"Do you know WH + S + V?",explain_ko:"~인지 아세요?",examples:[
        {ko:"상담이 언제인지 아세요?",en:"Do you know when the conference is?"},
        {ko:"몇 학년인지 아세요?",en:"Do you know what year she is in?"},
        {ko:"간식 준비해야 하는지 아세요?",en:"Do you know if we need to prepare snacks?"},
      ]},
      {pattern_en:"I wonder if S + V.",explain_ko:"~인지 궁금해요",examples:[
        {ko:"수업 중에 집중을 잘하는지 궁금해요.",en:"I wonder if she focuses well in class."},
        {ko:"추가 도움이 필요한지 궁금해요.",en:"I wonder if she needs extra support."},
        {ko:"친구들과 잘 지내는지 궁금해요.",en:"I wonder if she gets along with friends."},
      ]},
      {pattern_en:"I would appreciate it if you could V.",explain_ko:"~해주시면 감사하겠어요",examples:[
        {ko:"원어민 친구와 짝지어 주시면 감사하겠어요.",en:"I would appreciate it if you could pair her with a native friend."},
        {ko:"격려해 주시면 감사하겠어요.",en:"I would appreciate it if you could encourage him."},
        {ko:"알려주시면 감사하겠어요.",en:"I would appreciate it if you could let me know."},
      ]},
    ],
    expressions: [
      {en:"How long have you been at this school?",ko:"이 학교 다닌 지 얼마나 됐어요?"},
      {en:"Do you know when the conference is?",ko:"상담이 언제인지 아세요?"},
      {en:"My child is struggling with math.",ko:"우리 아이가 수학을 힘들어해요."},
      {en:"I wonder if she focuses well in class.",ko:"수업 중에 집중을 잘하는지 궁금해요."},
      {en:"I would appreciate it if you could let me know.",ko:"알려주시면 감사하겠어요."},
    ]
  },
  {
    id: "bank-basics",
    label_ko: "은행 · ATM · 결제 문제",
    emoji: "🏦",
    iconA: Briefcase, iconB: Zap,
    context_en: "Bank statements, ATM problems, refunds, and transaction disputes.",
    vocab: [
      {en:"open an account",ko:"계좌 개설"},
      {en:"bank statement",ko:"은행 내역서"},
      {en:"transaction history",ko:"거래 내역"},
      {en:"daily limit",ko:"하루 한도"},
      {en:"withdraw cash",ko:"현금 인출"},
      {en:"deposit cash",ko:"현금 입금"},
      {en:"transfer money",ko:"송금"},
      {en:"card stuck in the ATM",ko:"ATM에 카드 걸림"},
      {en:"unauthorized charge",ko:"부정 결제"},
      {en:"double charged",ko:"이중 결제"},
    ],
    patterns: [
      {pattern_en:"I would like to V.",explain_ko:"~하고 싶어요",examples:[
        {ko:"계좌를 개설하고 싶어요.",en:"I would like to open an account."},
        {ko:"은행 내역서를 요청하고 싶어요.",en:"I would like to request my bank statement."},
        {ko:"이 거래에 이의를 제기하고 싶어요.",en:"I would like to dispute this transaction."},
      ]},
      {pattern_en:"I am here because S + V.",explain_ko:"~때문에 왔어요",examples:[
        {ko:"카드가 막혀서 왔어요.",en:"I am here because my card is blocked."},
        {ko:"부정 결제가 있어서 왔어요.",en:"I am here because I found an unauthorized charge."},
        {ko:"이중 결제가 됐어서 왔어요.",en:"I am here because I was charged twice."},
      ]},
      {pattern_en:"How long will it take to V?",explain_ko:"~하는 데 얼마나 걸려요?",examples:[
        {ko:"해결하는 데 얼마나 걸려요?",en:"How long will it take to resolve this?"},
        {ko:"환불받는 데 얼마나 걸려요?",en:"How long will it take to get my money back?"},
        {ko:"이 문제 해결하는 데 얼마나 걸려요?",en:"How long will it take to fix this issue?"},
      ]},
    ],
    expressions: [
      {en:"I would like to open an account.",ko:"계좌를 개설하고 싶어요."},
      {en:"My card is stuck in the ATM.",ko:"ATM에 카드가 걸렸어요."},
      {en:"I was charged twice.",ko:"이중 결제가 됐어요."},
      {en:"What is my daily withdrawal limit?",ko:"하루 인출 한도가 얼마예요?"},
      {en:"How long will it take to resolve this?",ko:"해결하는 데 얼마나 걸려요?"},
    ]
  },
  {
    id: "car-accident",
    label_ko: "차 사고 대처",
    emoji: "🚗",
    iconA: Zap, iconB: Zap,
    context_en: "Reporting and describing a car accident.",
    vocab: [
      {en:"take photos",ko:"사진 찍다"},
      {en:"the damage",ko:"피해"},
      {en:"the scene",ko:"현장"},
      {en:"report an accident",ko:"사고 신고"},
      {en:"send assistance",ko:"도움 보내다"},
      {en:"minor collision",ko:"접촉사고"},
      {en:"hit my car from behind",ko:"뒤에서 박다"},
      {en:"cut in front of me",ko:"앞에 끼어들다"},
      {en:"without signaling",ko:"깜빡이 없이"},
      {en:"rear bumper",ko:"뒤 범퍼"},
    ],
    patterns: [
      {pattern_en:"I am reporting N.",explain_ko:"~을 신고하는 중이에요",examples:[
        {ko:"사고를 신고하는 중이에요.",en:"I am reporting an accident."},
        {ko:"뺑소니를 신고하는 중이에요.",en:"I am reporting a hit-and-run."},
        {ko:"접촉사고를 신고하는 중이에요.",en:"I am reporting a minor collision."},
      ]},
      {pattern_en:"The car V my car.",explain_ko:"그 차가 내 차를 ~했어요",examples:[
        {ko:"그 차가 제 차를 박았어요.",en:"The car hit my car."},
        {ko:"그 차가 제 차 옆을 박았어요.",en:"The car hit the side of my car."},
        {ko:"그 차가 뒤에서 제 차를 박았어요.",en:"The car hit my car from behind."},
      ]},
      {pattern_en:"My N is damaged.",explain_ko:"제 ~이 파손됐어요",examples:[
        {ko:"뒤 범퍼가 찌그러졌어요.",en:"My rear bumper is dented."},
        {ko:"문이 긁혔어요.",en:"My door is scratched."},
        {ko:"범퍼가 파손됐어요.",en:"My bumper is damaged."},
      ]},
    ],
    expressions: [
      {en:"I am reporting an accident.",ko:"사고를 신고하는 중이에요."},
      {en:"Nobody is hurt.",ko:"다친 사람은 없어요."},
      {en:"The car hit my car from behind.",ko:"뒤에서 제 차를 박았어요."},
      {en:"My rear bumper is dented.",ko:"뒤 범퍼가 찌그러졌어요."},
      {en:"Please send assistance as soon as possible.",ko:"최대한 빨리 도움을 보내주세요."},
    ]
  },
  {
    id: "email-symbols",
    label_ko: "돈 · 결제 · 숫자 · 기호",
    emoji: "💰",
    iconA: Briefcase, iconB: Zap,
    context_en: "Payment, debt, numbers, symbols, and scores.",
    vocab: [
      {en:"a $10 bill",ko:"10달러 지폐"},
      {en:"change for {amount}",ko:"{amount} 잔돈"},
      {en:"pay with credit card",ko:"카드로 결제"},
      {en:"short on cash",ko:"현금 부족"},
      {en:"lend me money",ko:"돈 빌려주다"},
      {en:"owe you {amount}",ko:"{amount} 빚지다"},
      {en:"due date",ko:"기한"},
      {en:"overdue payment",ko:"연체"},
      {en:"take out a loan",ko:"대출 받다"},
      {en:"on a scale of 1 to 10",ko:"1점에서 10점 척도로"},
    ],
    patterns: [
      {pattern_en:"Can you give me change for N?",explain_ko:"~잔돈 주실 수 있어요?",examples:[
        {ko:"10달러 잔돈 주실 수 있어요?",en:"Can you give me change for a $10 bill?"},
        {ko:"100달러 잔돈 주실 수 있어요?",en:"Can you give me change for a $100 bill?"},
        {ko:"이 지폐 잔돈으로 바꿔주실 수 있어요?",en:"Can you break this bill?"},
      ]},
      {pattern_en:"I owe you N.",explain_ko:"~빚졌어요",examples:[
        {ko:"50달러 빚졌어요.",en:"I owe you $50."},
        {ko:"티켓값 빚졌어요.",en:"I owe you money for the tickets."},
        {ko:"그녀한테 100달러 빚졌어요.",en:"I owe her 100 dollars."},
      ]},
      {pattern_en:"I will pay with N.",explain_ko:"~로 결제할게요",examples:[
        {ko:"카드로 결제할게요.",en:"I will pay with my credit card."},
        {ko:"현금으로 결제할게요.",en:"I will pay with cash."},
        {ko:"직불카드로 결제할게요.",en:"I will pay with my debit card."},
      ]},
    ],
    expressions: [
      {en:"Can you give me change for a $10 bill?",ko:"10달러 잔돈 주실 수 있어요?"},
      {en:"I will pay with my credit card.",ko:"카드로 결제할게요."},
      {en:"I am short on cash.",ko:"현금이 부족해요."},
      {en:"I owe you $50.",ko:"50달러 빚졌어요."},
      {en:"When is the due date?",ko:"기한이 언제예요?"},
    ]
  },
  {
    id: "fractions-scores",
    label_ko: "헤어살롱 · 음식 맛 표현",
    emoji: "✂️",
    iconA: Zap, iconB: Zap,
    context_en: "Hair salon requests and describing food taste and texture.",
    vocab: [
      {en:"a haircut",ko:"머리 자르기"},
      {en:"a trim",ko:"다듬기"},
      {en:"shoulder length",ko:"어깨 길이"},
      {en:"layered hair",ko:"레이어드 컷"},
      {en:"trim my bangs",ko:"앞머리 다듬기"},
      {en:"side part",ko:"가르마"},
      {en:"tastes like {food}",ko:"{food} 맛이 나다"},
      {en:"smells like {food}",ko:"{food} 냄새가 나다"},
      {en:"reminds me of {food}",ko:"{food}이 생각나다"},
      {en:"crispy on the outside",ko:"겉은 바삭"},
    ],
    patterns: [
      {pattern_en:"I would like N.",explain_ko:"~하고 싶어요",examples:[
        {ko:"머리 자르고 싶어요.",en:"I would like a haircut."},
        {ko:"다듬고 싶어요.",en:"I would like a trim."},
        {ko:"파마하고 싶어요.",en:"I would like a perm."},
      ]},
      {pattern_en:"Can you make it ADJ?",explain_ko:"~하게 해주세요",examples:[
        {ko:"더 짧게 해주세요.",en:"Can you make it shorter?"},
        {ko:"좀 더 짧게 해주세요.",en:"Can you make it a bit shorter?"},
        {ko:"어깨 길이로 해주세요.",en:"Can you make it shoulder length?"},
      ]},
      {pattern_en:"It tastes/smells like N.",explain_ko:"~맛/냄새가 나요",examples:[
        {ko:"고기 맛이 나요.",en:"It tastes like meat."},
        {ko:"고수 냄새가 나요.",en:"It smells like cilantro."},
        {ko:"칼국수 맛이 나요.",en:"It tastes like kalguksu."},
      ]},
      {pattern_en:"It reminds me of N.",explain_ko:"~이 생각나요",examples:[
        {ko:"칼국수가 생각나요.",en:"It reminds me of kalguksu."},
        {ko:"갈비탕이 생각나요.",en:"It reminds me of galbitang."},
        {ko:"한국 국물 요리가 생각나요.",en:"It reminds me of Korean soup."},
      ]},
    ],
    expressions: [
      {en:"I would like a trim.",ko:"다듬고 싶어요."},
      {en:"Can you cut it to shoulder length?",ko:"어깨 길이로 잘라주세요."},
      {en:"Can you trim my bangs?",ko:"앞머리 다듬어 주세요."},
      {en:"It tastes like kalguksu.",ko:"칼국수 맛이 나요."},
      {en:"It reminds me of galbitang.",ko:"갈비탕이 생각나요."},
      {en:"It is crispy on the outside.",ko:"겉은 바삭해요."},
    ]
  }
];



/* -------------------------------- Pieces --------------------------------- */

function GateMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="4" width="5" height="24" rx="1.5" fill="#B8ADFF" />
      <rect x="23" y="4" width="5" height="24" rx="1.5" fill="#B8ADFF" />
      <circle cx="16" cy="14" r="5" fill="#7C6EE8" />
    </svg>
  );
}

const SCENE_ACCENTS = ["#B8ADFF", "#7C6EE8", "#9B8EF5"];

function SceneCard({ iconA: IconA, iconB: IconB, index = 0 }) {
  const accent = SCENE_ACCENTS[index % SCENE_ACCENTS.length];
  return (
    <div className="mm-scene-card">
      <IconA size={26} color="#FFFFFF" strokeWidth={1.8} />
      <div className="mm-scene-badge" style={{ background: accent }}>
        <IconB size={13} color="#16203A" strokeWidth={2.2} />
      </div>
    </div>
  );
}

function Spinner({ label }) {
  return (
    <div className="mm-flex-center" style={{ gap: 10, padding: "32px 0" }}>
      <Loader2 className="animate-spin" size={20} color="#B8ADFF" />
      <span className="mm-muted">{label}</span>
    </div>
  );
}

function ErrorBox({ message, onRetry }) {
  return (
    <div className="mm-error-box">
      <p>{message}</p>
      <button className="mm-btn-ghost" onClick={onRetry}>
        <RefreshCw size={14} /> 다시 시도
      </button>
    </div>
  );
}


function SpeakButton({ text, size = 14 }) {
  function handleClick(e) {
    e.stopPropagation();
    speakText(text, 1.0);
  }
  return (
    <button className="mm-speak-btn" onClick={handleClick} aria-label="발음 듣기" type="button">
      <Volume2 size={size} />
    </button>
  );
}

function AlternativeSpeakDrill({ alt }) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);
  const SpeechRec = getSpeechRecognition();

  function toggle() {
    if (listening) {
      if (recogRef.current) try { recogRef.current.stop(); } catch(e) {}
      setListening(false);
    } else {
      setTranscript("");
      const r = startRecognition(
        (t) => setTranscript(t),
        () => setListening(false)
      );
      if (r) { recogRef.current = r; setListening(true); }
    }
  }

  const isAltObj = typeof alt === "object" && alt !== null && alt.en;
  const displayText = isAltObj ? alt.en : alt;

  return (
    <div style={{ background: "#F8F8FC", borderRadius: 10, padding: "8px 12px" }}>
      <div className="mm-row" style={{ gap: 6, marginBottom: 2 }}>
        <SpeakButton text={displayText} size={12} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{displayText}</span>
      </div>
      {isAltObj && alt.ko && <div className="mm-muted" style={{ fontSize: 13, marginBottom: 6 }}>{alt.ko}</div>}
      {SpeechRec && (
        <button className={"mm-btn-ghost " + (listening ? "mm-mic-active" : "")} style={{ fontSize: 13 }} onClick={toggle}>
          {listening ? <MicOff size={11} /> : <Mic size={11} />} {listening ? "중지" : "따라 말하기"}
        </button>
      )}
      {transcript && <div className="mm-muted" style={{ fontSize: 13, marginTop: 4 }}>🎤 {transcript}</div>}
    </div>
  );
}

function MakeSentenceBox({ anchor, questionKo, scaffoldWords, useScaffolded }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function check() {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const system = useScaffolded
        ? scaffoldedCheckSystem(anchor, questionKo || anchor)
        : quickCheckSystem(anchor);
      const res = await askClaudeJSON(system, `Learner's sentence: ${text}`);
      setResult(res);
    } catch (e) {
      setResult({ good: false, corrected: "", feedback_ko: "확인하지 못했어요. 다시 시도해주세요.", alternatives: [] });
    } finally {
      setLoading(false);
    }
  }

  const prompt = questionKo || `"${cleanForSpeech(anchor)}"를 사용해서 문장을 써보세요`;

  return (
    <div className="mm-make-sentence" onClick={(e) => e.stopPropagation()}>
      <div className="mm-muted" style={{ fontSize: 13, marginBottom: 6 }}>✏️ {prompt}</div>

      {/* Scaffold chips */}
      {scaffoldWords?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="mm-muted" style={{ fontSize: 13, marginBottom: 4 }}>📌 이런 표현도 필요해요</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {scaffoldWords.map((w, i) => (
              <div key={i} style={{
                background: "#FFF8E8", border: "1px solid #B8ADFF", borderRadius: 8,
                padding: "3px 9px", fontSize: 13, display: "flex", gap: 5, alignItems: "center"
              }}>
                <SpeakButton text={w.en} size={11} />
                <span style={{ fontWeight: 700 }}>{w.en}</span>
                <span className="mm-muted" style={{ fontSize: 13 }}>{w?.ko || ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scaffolded writing    */}
      {!result ? (
        <div className="mm-row" style={{gap:6}}><input className="mm-input mm-input-sm" value={text} placeholder="영어로 써보세요..." onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} /><button className="mm-btn-ghost" onClick={check} disabled={loading||!text.trim()}>확인</button></div>
      ) : (
        <>
          {/* My sentence */}
          <div style={{ background: "#F8F8FC", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginBottom: 8 }}>
            📝 {text}
          </div>

          {/* Feedback + corrected */}
          <div className={"mm-sentence-feedback " + (result.good ? "mm-sentence-good" : "mm-sentence-fix")} style={{ marginBottom: 10 }}>
            {result.good ? "✓ " : "💡 "}{result.feedback_ko}
            {!result.good && result.corrected && (
              <div style={{ marginTop: 5, fontWeight: 600 }}>
                <SpeakButton text={result.corrected} size={12} /> {result.corrected}
              </div>
            )}
          </div>

          {/* Alternative expressions with speaking practice */}
          {result.alternatives?.length > 0 && (
            <>
              <div className="mm-muted" style={{ fontSize: 13, marginBottom: 6 }}>🔄 이렇게도 말할 수 있어요 — 따라 말해보세요</div>
              <div className="mm-col" style={{ gap: 8 }}>
                {result.alternatives.map((alt, i) => (
                  <AlternativeSpeakDrill key={i} alt={alt} />
                ))}
              </div>
            </>
          )}

          <button
            className="mm-btn-ghost"
            style={{ marginTop: 10, fontSize: 13 }}
            onClick={() => { setText(""); setResult(null); }}
          >
            <RefreshCw size={11} /> 다시 써보기
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Diagnose tab ------------------------------ */

/* -------------------------- Vocab / Grammar / Idiom ------------------------ */

/* -------------------------------- Pattern ---------------------------------- */

function PatternCard({ pattern, withSentenceBox }) {
  return (
    <div className="mm-grammar-card">
      <div className="mm-row" style={{ gap: 4 }}>
        <div className="mm-serif" style={{ fontSize: 18, fontWeight: 700 }}>{pattern.pattern_en}</div>
        <SpeakButton text={pattern.pattern_en} size={14} />
      </div>
      <div className="mm-muted" style={{ fontSize: 14, margin: "4px 0 8px" }}>{pattern.meaning_ko}</div>
      <div className="mm-col" style={{ gap: 4 }}>
        {(pattern.examples || []).map((ex, i) => (
          <div key={i} className="mm-row" style={{ gap: 4 }}>
            <span className="mm-muted" style={{ fontSize: 13 }}>· {ex.en}</span>
            <SpeakButton text={ex.en} size={11} />
          </div>
        ))}
      </div>
      {withSentenceBox && <MakeSentenceBox anchor={pattern.pattern_en} />}
    </div>
  );
}

/* ---------------------------------- Drill ----------------------------------- */

/* ------------------------------ Your English Map ----------------------------- */

const MAP_SECTIONS = [
  { id: "vocab", label: "보카", icon: BookOpen },
  { id: "grammar", label: "문법", icon: Languages },
  { id: "idiom", label: "숙어", icon: Quote },
  { id: "pattern", label: "패턴", icon: Layers },
  { id: "drill", label: "드릴", icon: Target },
];

function dateKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dailyGenerateSystem(focusAreas) {
  const focusText =
    focusAreas && focusAreas.length
      ? `Their known weak areas so far: ${focusAreas.join(", ")}. Keep targeting these, but vary the words/phrases/patterns so it doesn't repeat what they've already seen.`
      : "They don't have any prior data yet, so keep it useful and concrete for an everyday beginner-to-intermediate Korean learner.";
  return `You are an English coach building today's study session for a Korean adult learner, without doing a new interview. ${focusText} Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{"weakness_summary_ko:"2-3 friendly Korean sentences on what to focus on today","grammar_focus_ko:"one short Korean title naming ONE big-picture grammar area to focus on","grammar_focus_explanation_ko:"one or two simple, easy Korean sentences on why this matters","today_vocab":[{"word:"...","meaning_ko:"..."}],"today_phrases":[{"phrase":"...","meaning_ko:"..."}],"patterns":[{"pattern_en:"...","meaning_ko:"...","examples":[{"en:"...","ko:"..."}]}],"focus_areas":["짧은 한국어 태그 2~4개"]}
"today_vocab" must have exactly 4 items, "today_phrases" exactly 3, "patterns" exactly 2 each with exactly 2 examples. Keep everything concise and warm so this generates quickly.`;
}

function freeTalkChatSystem() {
  return `You are a warm, curious English conversation partner chatting with a Korean adult living here. Your ONLY job right now is to have a genuinely natural conversation — NOT to teach, correct, or evaluate. Ask simple questions about their life, week, opinions, or surroundings. Keep your replies short (1-3 sentences). React naturally to what they say. Ask one follow-up question. Topics can include: their week, family, food, plans, feelings, here life, K-drama, shopping — anything natural. This conversation will last about 5 minutes. After about 8-10 exchanges, gently wrap up: "Thanks for chatting! I really enjoyed our conversation." Do NOT correct grammar. Do NOT teach. Just be a friend.`;
}

function freeTalkAnalysisSystem() {
  return `You are an expert English coach analyzing a conversation transcript between an AI and a Korean adult learner. Your job is to identify their English strengths and weaknesses from how they actually spoke — not from a test.

Analyze the transcript carefully for:
- Grammar patterns used correctly vs incorrectly
- Tense consistency (do they mix past/present?)
- Sentence complexity (simple only? or varied?)
- Vocabulary range (limited? natural? formal/informal?)
- Expressions that felt natural vs awkward
- What they AVOIDED (sign of uncertainty)

Return ONLY valid JSON, no markdown fences:
{
  "weakness_summary_ko": "3-4 warm, specific Korean sentences describing what needs work — be concrete, not generic. Mention actual patterns you noticed.",
  "strength_summary_ko": "2-3 Korean sentences on what they did WELL — genuine praise for real evidence.",
  "grammar_focus_ko": "ONE specific grammar area to focus on (e.g. '과거시제 일관성' not just '문법')",
  "grammar_focus_explanation_ko": "1-2 sentences on why this matters and what you noticed",
  "today_vocab": [{"word": "...", "meaning_ko": "..."}],
  "today_phrases": [{"phrase": "...", "meaning_ko": "..."}],
  "patterns": [{"pattern_en": "...", "meaning_ko": "...", "examples": [{"en": "...", "ko": "..."}, {"en": "...", "ko": "..."}]}],
  "focus_areas": ["구체적인 태그 2-4개"],
  "journey_note_ko": "한 문장 — 오늘 이 학습자의 영어 여정에서 발견한 가장 중요한 것. 진심 어린 개인적인 문장으로."
}
"today_vocab" exactly 4, "today_phrases" exactly 3, "patterns" exactly 2 with 2 examples each. All targeted at the weaknesses found in THIS specific conversation.`;
}



function CalendarPanel({ active, focusAreas, mergeTodayContent, goTo }) {
  const todayStr = dateKey(new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [recordedDates, setRecordedDates] = useState(new Set());
  const [loadingList, setLoadingList] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [calMode, setCalMode] = useState("weekly"); // "weekly" | "monthly"
  
  async function loadList() {
    setLoadingList(true);
    let dates = new Set();
    try {
      const res = await window.storage.list("study-day:", false);
      const keys = (res && res.keys) || [];
      dates = new Set(keys.map((k) => k.replace("study-day:", "")));
    } catch (e) { dates = new Set(); }
    setRecordedDates(dates);
    setLoadingList(false);
    return dates;
  }

  async function loadRecord(d) {
    setLoadingRecord(true);
    try {
      const res = await window.storage.get("study-day:" + dateKey(d), false);
      setSelectedRecord(res ? JSON.parse(res.value) : null);
    } catch (e) { setSelectedRecord(null); }
    finally { setLoadingRecord(false); }
  }

  useEffect(() => {
    if (active) {
      loadList().then(dates => {
        if (dates.has(dateKey(selectedDate))) loadRecord(selectedDate);
        else setSelectedRecord(null);
      });
    }
    // eslint-disable-next-line
  }, [active]);

  async function selectDate(d) {
    setSelectedDate(d);
    setSelectedRecord(null);
    setShowDetail(true);
    if (recordedDates.has(dateKey(d))) await loadRecord(d);
  }

  async function generateTodayStudy() {
    setGenerating(true); setGenerateError("");
    try {
      const result = await askClaudeJSON(dailyGenerateSystem(focusAreas), "Generate today's study session now.");
      try { await window.storage.set("study-day:" + todayStr, JSON.stringify(result), false); } catch (e) {}
      setRecordedDates(prev => new Set([...prev, todayStr]));
      setSelectedRecord(result);
      setShowDetail(true);
      mergeTodayContent(result);
    } catch (e) { setGenerateError("학습을 만들지 못했어요. 다시 시도해주세요."); }
    finally { setGenerating(false); }
  }

  const selectedKey = dateKey(selectedDate);
  const isSelectedToday = selectedKey === todayStr;
  const suggestedTopic = suggestSpeakingTopic(focusAreas);

  // Build weekly cells — Mon to Sun of the week containing selectedDate
  const weekCells = (() => {
    const d = new Date(selectedDate);
    const day = d.getDay(); // 0=Sun
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const cell = new Date(monday);
      cell.setDate(monday.getDate() + i);
      return cell;
    });
  })();

  const DAY_LABELS = ["월","화","수","목","금","토","일"];

  // Navigate week
  function prevWeek() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
    setSelectedRecord(null);
    if (recordedDates.has(dateKey(d))) loadRecord(d);
  }
  function nextWeek() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
    setSelectedRecord(null);
    if (recordedDates.has(dateKey(d))) loadRecord(d);
  }

  const weekLabel = (() => {
    const start = weekCells[0];
    const end = weekCells[6];
    return `${start.getMonth()+1}/${start.getDate()} – ${end.getMonth()+1}/${end.getDate()}`;
  })();

  // Weekly cells — 7 days of current week
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
  const weekDays = Array.from({length:7}, (_,i) => { const d=new Date(weekStart); d.setDate(weekStart.getDate()+i); return d; });

  function prevWeek() { const d=new Date(viewDate); d.setDate(d.getDate()-7); setViewDate(d); setSelectedDate(d); }
  function nextWeek() { const d=new Date(viewDate); d.setDate(d.getDate()+7); setViewDate(d); setSelectedDate(d); }

  return (
    <div className="mm-card">
      {/* Header with mode toggle */}
      <div className="mm-row mm-space-between" style={{ marginBottom: 10 }}>
        <h2 className="mm-serif" style={{ fontSize: 19, margin: 0 }}>학습 달력</h2>
        <div className="mm-row" style={{ gap: 4 }}>
          <button onClick={() => setCalMode("weekly")}
            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "none", cursor: "pointer",
              background: calMode==="weekly" ? "#2D2B55" : "#F8F8FC",
              color: calMode==="weekly" ? "#FFFFFF" : "#5B5490", fontWeight: 700 }}>주별</button>
          <button onClick={() => setCalMode("monthly")}
            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "none", cursor: "pointer",
              background: calMode==="monthly" ? "#2D2B55" : "#F8F8FC",
              color: calMode==="monthly" ? "#FFFFFF" : "#5B5490", fontWeight: 700 }}>월별</button>
        </div>
      </div>

      {/* Weekly view */}
      {calMode === "weekly" && (
        <div>
          <div className="mm-row mm-space-between" style={{ marginBottom: 10 }}>
            <button className="mm-btn-ghost" style={{ padding: "4px 10px" }} onClick={prevWeek}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#2D2B55" }}>{weekLabel}</span>
            <button className="mm-btn-ghost" style={{ padding: "4px 10px" }} onClick={nextWeek}>›</button>
          </div>
          {loadingList ? <Spinner label="달력을 불러오는 중이에요..." /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {["일","월","화","수","목","금","토"].map(d => (
                <div key={d} style={{ textAlign:"center", fontSize:12, color:"#3D4560", fontWeight:700, paddingBottom:4 }}>{d}</div>
              ))}
              {weekDays.map((d, i) => {
                const key = dateKey(d);
                const hasRecord = recordedDates.has(key);
                const isToday = key === todayStr;
                const isSelected = key === selectedKey && showDetail;
                const isFuture = key > todayStr;
                return (
                  <button key={i}
                    className={"mm-calendar-cell " + (isToday?"mm-calendar-today ":"") + (isSelected?"mm-calendar-selected ":"") + (isFuture?"mm-calendar-disabled":"")}
                    onClick={() => !isFuture && selectDate(d)} disabled={isFuture}
                    style={{ height: 52, flexDirection:"column", gap:2 }}>
                    <span style={{ fontSize:14, fontWeight: isToday?900:600 }}>{d.getDate()}</span>
                    {hasRecord && <span className="mm-calendar-dot" />}
                    {!hasRecord && !isFuture && <span style={{ fontSize:9, color:"#C8C2B2" }}>미학습</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Monthly view */}
      {calMode === "monthly" && (
        <div>
          <div className="mm-row mm-space-between" style={{ marginBottom: 10 }}>
            <button className="mm-btn-ghost" style={{ padding: "4px 10px" }} onClick={() => setViewDate(new Date(year, month-1, 1))}>‹</button>
            <span className="mm-mono" style={{ fontSize:13, minWidth:66, textAlign:"center" }}>{year}년 {month+1}월</span>
            <button className="mm-btn-ghost" style={{ padding: "4px 10px" }} onClick={() => setViewDate(new Date(year, month+1, 1))}>›</button>
          </div>
          {loadingList ? <Spinner label="달력을 불러오는 중이에요..." /> : (
            <div className="mm-calendar-grid">
              {["일","월","화","수","목","금","토"].map(d => (
                <div key={d} className="mm-calendar-weekday">{d}</div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="mm-calendar-cell mm-calendar-empty" />;
                const key = dateKey(d);
                const hasRecord = recordedDates.has(key);
                const isToday = key === todayStr;
                const isSelected = key === selectedKey && showDetail;
                const isFuture = key > todayStr;
                return (
                  <button key={i}
                    className={"mm-calendar-cell " + (isToday?"mm-calendar-today ":"") + (isSelected?"mm-calendar-selected ":"") + (isFuture?"mm-calendar-disabled":"")}
                    onClick={() => !isFuture && selectDate(d)} disabled={isFuture}>
                    <span>{d.getDate()}</span>
                    {hasRecord && <span className="mm-calendar-dot" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Day detail panel */}
      {showDetail && (
        <div className="mm-calendar-detail">
          {loadingRecord && <Spinner label="불러오는 중이에요..." />}

          {/* Today  no record yet */}
          {!loadingRecord && isSelectedToday && !selectedRecord && (
            <div style={{ paddingTop: 14 }}>
              <p className="mm-muted" style={{ fontSize: 13, marginBottom: 12 }}>오늘은 아직 학습 기록이 없어요.</p>
              <button className="mm-btn-ghost" style={{ justifyContent: "center", width: "100%" }} onClick={generateTodayStudy} disabled={generating}>
                {generating ? <><Loader2 className="animate-spin" size={13} /> 생성 중...</> : "⚡ 빠른 학습 생성하기"}
              </button>
              {generateError && <ErrorBox message={generateError} onRetry={generateTodayStudy} />}
            </div>
          )}

          {!loadingRecord && selectedRecord && (
            <div style={{ paddingTop: 12, fontSize: 13, color: "#5B5490" }}>
              {selectedRecord?.journey_note_ko || "오늘의 학습 기록이 있어요."}
              {generateError && <ErrorBox message={generateError} onRetry={generateTodayStudy} />}
            </div>
          )}

          {/* Past date  no record */}
          {!loadingRecord && !selectedRecord && !isSelectedToday && (
            <p className="mm-muted" style={{ fontSize: 13, textAlign: "center", paddingTop: 14 }}>
              이 날은 학습 기록이 없어요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Worksheet ------------------------------- */

// A real worksheet the teacher already provided, transcribed in full so the
// feature has a working example the moment someone opens 학습지.
const BUILTIN_WORKSHEET = {
  title_ko: "too ~ to V / enough to V",
  pattern_summary: [
    { form_en: "S + too + adj + to V (= too adj for 사람 to V)", explain_ko: "너무 ~해서 (동사)하기 어렵다는 뜻이에요." },
    { form_en: "S + have/has + enough + N + to V / Is there enough N to V?", explain_ko: "~하기에 충분한 (명사)가 있다는 뜻이에요." },
    { form_en: "S + V + (adj) + enough to V", explain_ko: "충분히 ~해서 (동사)할 수 있다는 뜻이에요. 형용사 뒤에 enough가 와요." },
    { form_en: "V + S + Adj + enough?", explain_ko: "충분히 ~하니? 라고 묻는 의문문이에요." },
    { form_en: "S + have/has + p.p. + enough", explain_ko: "현재완료와 같이 써서 '충분히 ~했다'는 뜻을 나타내요." },
  ],
  exercises: [
    { type: "find_errors", prompt: "I am not enough brave to walk outside at night", reference: "I am not brave enough to walk outside at night." },
    { type: "find_errors", prompt: "It is very cold to run", reference: "It is too cold to run." },
    { type: "find_errors", prompt: "I brought cookies enough to give everybody.", reference: "I brought enough cookies to give everybody." },
    { type: "find_errors", prompt: "Is he enough smart to solve this question?", reference: "Is he smart enough to solve this question?" },
    { type: "find_errors", prompt: "My arm reach is not tall to reach the shelf", reference: "My arm is not long enough to reach the shelf." },
    { type: "fill_blank", prompt: "He is ___ lift the box. (strong)", reference: "strong enough to" },
    { type: "fill_blank", prompt: "The soup is ___ eat. (hot)", reference: "too hot to" },
    { type: "fill_blank", prompt: "The bag is ___ carry. (heavy)", reference: "too heavy to" },
    { type: "fill_blank", prompt: "Do we have ___ time to finish?", reference: "enough" },
    { type: "fill_blank", prompt: "I was ___ tired to ___.", reference: "too / (a verb, e.g. walk)" },
    { type: "complete", prompt: "I am experienced enough to ___", reference: "" },
    { type: "complete", prompt: "I am too ___ to ___", reference: "" },
    { type: "complete", prompt: "I am ___ enough to ___", reference: "" },
    { type: "complete", prompt: "I have enough cash to ___", reference: "" },
    { type: "translate", prompt: "우리 애가 이 놀이기구 타는데 키가 되는지 물어보기 (enough / go on this ride)", reference: "Is my child tall enough to go on this ride?" },
    { type: "translate", prompt: "이건 먹기에 너무 달아.", reference: "This is too sweet to eat." },
    { type: "translate", prompt: "오늘 날씨는 빨래 널기에 충분히 따뜻하다.", reference: "The weather is warm enough to hang laundry today." },
    { type: "translate", prompt: "그 영화는 두번 볼 만큼 충분히 재밌었어. (interesting)", reference: "The movie was interesting enough to watch twice." },
    { type: "translate", prompt: "이 방은 10명이 자도 될 만큼 충분히 크다.", reference: "This room is big enough for 10 people to sleep in." },
    { type: "translate", prompt: "그 영화는 애들이랑 보기에는 너무 길어.", reference: "The movie is too long to watch with kids." },
    { type: "translate", prompt: "그 시험은 학생들을 선발하기에 꽤 공정했어. (fair)", reference: "The exam was fair enough to select students." },
    { type: "translate", prompt: "내 머리가 기부하기에 충분히 긴가요?", reference: "Is my hair long enough to donate?" },
    { type: "translate", prompt: "내 친구가 그를 만나기는 아깝지. (too good to V)", reference: "My friend is too good to meet him." },
    { type: "translate", prompt: "나의 SAT score가 하버드 가기에 충분히 높지 않았어.", reference: "My SAT score wasn't high enough to get into Harvard." },
    { type: "translate", prompt: "이것은 우리 애들한테는 맵다, 먹기에는.", reference: "This is too spicy for our kids to eat." },
    { type: "translate", prompt: "이 가방은 나한테는 너무 비싸다, 사기에는.", reference: "This bag is too expensive for me to buy." },
    { type: "translate", prompt: "너무 좋아서 믿기지가 않아. (사실이라는게 말이 안돼)", reference: "It's too good to be true." },
    { type: "translate", prompt: "그녀는 충분한 돈이 있다, 여기에 집을 살 수 있는.", reference: "She has enough money to buy a house here." },
    { type: "translate", prompt: "우리는 학교에 들렀다 가기에 충분한 시간이 있지 않았어.", reference: "We didn't have enough time to stop by the school." },
    { type: "translate", prompt: "그녀는 코미디언이 되기에 충분히 웃겨.", reference: "She is funny enough to be a comedian." },
    { type: "translate", prompt: "그는 내 남편이 되기에 충분히 잘생기지 않았어.", reference: "He wasn't handsome enough to be my husband." },
    { type: "translate", prompt: "난 충분히 했어. (do-did-done)", reference: "I have done enough." },
    { type: "translate", prompt: "난 충분히 봤어 / 충분히 들었어.", reference: "I have seen enough. / I have heard enough." },
    { type: "translate", prompt: "난 충분히 먹었어요. (have-had-had)", reference: "I have eaten enough." },
    { type: "dialogue", prompt: "[기름이 충분한지 친구에게 물어보기] 겐팅까지 갈 수 있는 충분한 기름이 있어?", reference: "Do I have enough gas to get to the highlands?" },
    { type: "dialogue", prompt: "[같은 상황, 친구 생각 묻기] 너 생각에는 우리가 겐팅까지 가는 충분한 기름이 있는 거 같아?", reference: "Do you think we have enough gas to get to the highlands?" },
    { type: "dialogue", prompt: "[혼자 영화 보기 무서운지 묻기] 이 영화 혼자 보기에는 무섭니?", reference: "Is this movie too scary to watch alone?" },
    { type: "dialogue", prompt: "[옷이 안 맞을 때] 너가 입기에는 너무 작아.", reference: "It's too small for you to wear." },
    { type: "dialogue", prompt: "[돈 빌려달라는 부탁 거절하기] 난 내가 돈을 빌려주기에 충분히 친하지 않은 것 같아.", reference: "I don't think we're close enough for me to lend you money." },
    { type: "dialogue", prompt: "[병뚜껑이 안 열릴 때] 난 이 jar을 열기에 충분히 힘이 세지 않아.", reference: "I'm not strong enough to open this jar." },
    { type: "dialogue", prompt: "[날씨가 밖에 앉기 좋은지 묻기] 밖에 앉기에 너무 덥나?", reference: "Is it too hot to sit outside?" },
    { type: "dialogue", prompt: "[아침 8시가 너무 이른지 친구에게 묻기] 8시는 만나기에 너무 이르니?", reference: "Is 8 too early to meet?" },
  ],
};

const EXERCISE_TYPE_LABELS = {
  find_errors: "오류 찾기",
  fill_blank: "빈칸 채우기",
  complete: "문장 완성하기",
  translate: "영작하기",
  dialogue: "실전 대화 연습",
};

const WORKSHEET_PARSE_SYSTEM = `You are an assistant that converts a photographed or pasted English grammar worksheet (often mixing English exercises and Korean instructions/translations, made for a Korean adult learner) into structured JSON for a learning app. Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{"title_ko:"short Korean name for the grammar pattern being practiced","pattern_summary":[{"form_en:"a grammar formula shown in the material, e.g. S + too + adj + to V","explain_ko:"one short, simple Korean sentence explaining what it means"}],"exercises":[{"type:"find_errors","prompt":"...","reference":"..."},{"type:"fill_blank","prompt":"...","reference":"..."},{"type:"complete","prompt":"...","reference":""},{"type:"translate","prompt":"...","reference":"..."},{"type:"dialogue","prompt":"...","reference":"..."}]}
"type" must be exactly one of: find_errors, fill_blank, complete, translate, dialogue. Read every exercise item visible in the material and include it faithfully, in the original order, without inventing new ones. If there are more than about 25 exercises total, keep the clearest, most complete ones across all the types rather than dropping a whole type. For "reference", give the best correct English answer if one is determinable from the material (leave it as an empty string only when there truly isn't one, like a fully open-ended "complete the sentence" prompt).`;

function worksheetGradeSystem(patternTitle) {
  return `You are grading a Korean adult learner's attempt at an English grammar exercise about: "${patternTitle}". You'll be given the exercise type, the prompt, an optional reference answer, and the learner's actual answer. Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape: {"correct": true or false, "feedback_ko": "one short, warm Korean sentence explaining what's right or what to fix", "model_answer": "a natural, correct English answer"} Be encouraging but accurate — if the learner's answer is grammatically fine even when it doesn't match the reference word-for-word, mark it correct.`;
}

function ExerciseItem({ exercise, index, gradePrompt }) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function check() {
    if (!answer.trim() || loading) return;
    setLoading(true);
    setErr("");
    try {
      const res = await askClaudeJSON(
        gradePrompt,
        `Exercise type: ${exercise.type}\nPrompt: ${exercise.prompt}\nReference: ${exercise.reference || "(none given)"}\nLearner's answer: ${answer}`
      );
      setFeedback(res);
    } catch (e) {
      setErr("확인하지 못했어요. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mm-card-row">
      <div className="mm-row" style={{ gap: 6, alignItems: "flex-start" }}>
        <span className="mm-mono" style={{ fontSize: 13, color: "#A9846A", marginTop: 2 }}>{index + 1}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{exercise.prompt}</div>
          <div className="mm-row" style={{ gap: 6, marginTop: 8 }}>
            <input
              className="mm-input mm-input-sm"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="영어로 답해보세요..."
              disabled={!!feedback}
              onKeyDown={(e) => e.key === "Enter" && check()}
            />
            {!feedback && (
              <button className="mm-btn-ghost" onClick={check} disabled={loading || !answer.trim()}>
                {loading ? <Loader2 className="animate-spin" size={13} /> : "확인"}
              </button>
            )}
          </div>
          {err && <div className="mm-note" style={{ color: "#D64545" }}>{err}</div>}
          {feedback && (
            <div className={"mm-sentence-feedback " + (feedback.correct ? "mm-sentence-good" : "mm-sentence-fix")}>
              {feedback.correct ? <Check size={13} /> : <Lightbulb size={13} />} {feedback.feedback_ko}
              {!feedback.correct && feedback.model_answer && (
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  <SpeakButton text={feedback.model_answer} size={12} /> {feedback.model_answer}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



function ShadowStage({ sentence, SpeechRec, onNext, nextLabel }) {
  const [transcript, setTranscript] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [micError, setMicError] = useState("");
  const micRef = useRef(null);

  function stopMic() {
    if (micRef.current) { try { micRef.current.stop(); } catch(e) {} micRef.current = null; }
    setMicOn(false);
  }

  function toggleMic() {
    if (micOn) { stopMic(); return; }
    setTranscript(""); setMicError("");

    // Check browser support first
    if (!getSpeechRecognition()) {
      setMicError("이 브라우저는 마이크 인식을 지원하지 않아요. Chrome을 써보세요.");
      return;
    }

    // Request mic permission explicitly
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          const r = startRecognition(
            t => setTranscript(t),
            () => { setMicOn(false); setAttempts(a => a + 1); }
          );
          if (r) { micRef.current = r; setMicOn(true); }
          else setMicError("마이크를 시작하지 못했어요. 다시 눌러보세요.");
        })
        .catch(err => {
          setMicError("마이크 권한이 필요해요. 브라우저에서 허용해주세요. (" + err.name + ")");
        });
    } else {
      // No getUserMedia — try directly
      const r = startRecognition(
        t => setTranscript(t),
        () => { setMicOn(false); setAttempts(a => a + 1); }
      );
      if (r) { micRef.current = r; setMicOn(true); }
      else setMicError("마이크를 시작하지 못했어요.");
    }
  }

  // Simple similarity: count matching words
  function similarity() {
    if (!transcript || !sentence) return null;
    const target = sentence.toLowerCase().replace(/[^a-z ]/g,"").split(" ").filter(Boolean);
    const said = transcript.toLowerCase().replace(/[^a-z ]/g,"").split(" ").filter(Boolean);
    if (target.length === 0) return null;
    const matches = said.filter(w => target.includes(w)).length;
    return Math.round((matches / target.length) * 100);
  }

  const sim = similarity();

  return (
    <div className="mm-card" style={{textAlign:"center"}}>
      <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>🎤 따라 말해봐요</div>

      {/* Sentence to shadow */}
      <div style={{background:"#2D2B55",borderRadius:10,padding:"14px",marginBottom:14}}>
        <div style={{fontSize:16,fontWeight:700,color:"#FFFFFF",lineHeight:1.6}}>{sentence}</div>
      </div>

      {/* Listen buttons */}
      <div style={{display:"flex",gap:8,marginBottom:14,justifyContent:"center"}}>
        <button className="mm-btn-ghost" style={{fontSize:13}} onClick={() => speakText(sentence, 1.0)}>🔊 듣기</button>
        <SlowSpeedToggle onPlay={(speed) => speakText(sentence, speed)} />
      </div>

      {/* Mic button */}
      <div style={{marginBottom:14}}>
        <button
          onClick={toggleMic}
          style={{
            width:72, height:72, borderRadius:"50%", border:"none", cursor:"pointer",
            background: micOn ? "#7C6EE8" : "#9B8EF5",
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            boxShadow: micOn ? "0 0 0 8px rgba(255,122,80,0.2)" : "0 0 0 6px rgba(41,199,172,0.15)",
            transition:"all 0.2s"
          }}>
          {micOn ? <MicOff size={28} color="#fff" /> : <Mic size={28} color="#fff" />}
        </button>
        <div style={{fontSize:12,color:"#9490B8",marginTop:8}}>
          {micOn ? "🔴 듣고 있어요 — 말해보세요" : "버튼 누르고 따라 말해봐요"}
        </div>
        {micError && (
          <div style={{marginTop:10,padding:"8px 12px",background:"#FFF0EB",borderRadius:8,
            fontSize:12,color:"#B23A3A",textAlign:"left"}}>
            ⚠️ {micError}
          </div>
        )}
        {!getSpeechRecognition() && !micError && (
          <div style={{marginTop:8,fontSize:11,color:"#9490B8"}}>
            💡 Chrome 브라우저에서 마이크가 잘 작동해요
          </div>
        )}
      </div>

      {/* Transcript */}
      {transcript && (
        <div style={{background:"#F8F8FC",borderRadius:10,padding:"10px 14px",marginBottom:12,textAlign:"left"}}>
          <div style={{fontSize:11,color:"#9490B8",marginBottom:4}}>🎤 내가 말한 것</div>
          <div style={{fontSize:14,fontWeight:600,color:"#2D2B55"}}>{transcript}</div>
          {sim !== null && (
            <div style={{marginTop:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:11,color:"#9490B8"}}>정확도</span>
                <span style={{fontSize:12,fontWeight:700,color:sim>=70?"#9B8EF5":sim>=40?"#B8ADFF":"#7C6EE8"}}>{sim}%</span>
              </div>
              <div style={{height:6,background:"#C4BEFF",borderRadius:3,overflow:"hidden"}}>
                <div style={{width:sim+"%",height:"100%",background:sim>=70?"#9B8EF5":sim>=40?"#B8ADFF":"#7C6EE8",borderRadius:3,transition:"width 0.5s"}}/>
              </div>
              {sim >= 70 && <div style={{fontSize:12,color:"#9B8EF5",marginTop:6}}>✓ 잘 했어요!</div>}
              {sim < 40 && attempts > 0 && <div style={{fontSize:12,color:"#7C6EE8",marginTop:6}}>다시 한 번 해봐요 💪</div>}
            </div>
          )}
        </div>
      )}

      <button className="mm-btn-ghost" style={{width:"100%"}} onClick={onNext}>{nextLabel}</button>
    </div>
  );
}

// ── 단어장 저장/삭제 helper ──
// Storage helpers — use window.storage (Claude artifact) with localStorage fallback
async function getWordbook() {
  try {
    if (window.storage) {
      const res = await window.storage.get("wordbook", false);
      return res ? JSON.parse(res.value) : [];
    }
  } catch(e) {}
  // localStorage fallback
  try {
    const raw = localStorage.getItem("malmun_wordbook");
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

async function setWordbook(list) {
  try {
    if (window.storage) {
      await window.storage.set("wordbook", JSON.stringify(list.slice(0, 200)), false);
      return;
    }
  } catch(e) {}
  try { localStorage.setItem("malmun_wordbook", JSON.stringify(list.slice(0, 200))); } catch(e) {}
}

async function saveToWordbook(item) {
  try {
    const list = await getWordbook();
    if (list.some(w => w.en === item.en)) return false;
    list.unshift({ ...item, savedAt: new Date().toISOString() });
    await setWordbook(list);
    return true;
  } catch(e) { console.error("saveToWordbook error:", e); return false; }
}

async function removeFromWordbook(en) {
  try {
    const list = await getWordbook();
    await setWordbook(list.filter(w => w.en !== en));
    return true;
  } catch(e) { return false; }
}

// KeyWordWithExample — shows key word, hint, example sentence, save button
function KeyWordWithExample({ word, hint_ko, context, collocation_label }) {
  const [example, setExample] = useState(null);
  const [loading, setLoading] = useState(true);

  const POS_STYLE = {
    noun:       { label:"명사",   bg:"#A78BFA22", color:"#A78BFA" },
    verb:       { label:"동사",   bg:"#9B8EF522", color:"#9B8EF5" },
    adjective:  { label:"형용사", bg:"#E67E2222", color:"#E67E22" },
    adverb:     { label:"부사",   bg:"#1ABC9C22", color:"#1ABC9C" },
    expression: { label:"표현",   bg:"#7C6EE822", color:"#7C6EE8" },
    phrase:     { label:"구",     bg:"#6C5CE722", color:"#6C5CE7" },
  };

  useEffect(() => {
    if (!word) return;
    askClaudeJSON(
      `Give one short example sentence using "${word}" and identify its part of speech.
Return ONLY valid JSON: {"en:"example sentence","ko:"한국어 번역","pos":"noun|verb|adjective|adverb|expression|phrase"}
Short sentence (6-12 words). The word must appear in it.`,
      `Word: "${word}", Hint: "${hint_ko || ""}", Context: "${context || ""}"`
    ).then(res => setExample(res)).catch(() => setExample(null))
      .finally(() => setLoading(false));
  }, [word]);

  const posStyle = example?.pos ? (POS_STYLE[example.pos] || POS_STYLE.expression) : null;

  return (
    <div style={{marginBottom:10,background:"#fff",borderRadius:10,
      border:"1.5px solid #B8ADFF66",overflow:"hidden"}}>
      {/* Word row */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span style={{fontSize:14,fontWeight:800,color:"#B28A00"}}>{word}</span>
            {posStyle && (
              <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:20,
                background:posStyle.bg,color:posStyle.color,border:`1px solid ${posStyle.color}44`}}>
                {posStyle.label}
              </span>
            )}
          </div>
          {collocation_label && <div style={{fontSize:11,color:"#C8A43A",marginTop:1}}>{collocation_label}</div>}
          <div style={{fontSize:12,color:"#5B5490"}}>{hint_ko}</div>
        </div>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"2px 6px"}}
          onClick={() => speakText(word, 0.85)}>🔊</button>
        <SaveButton en={word} ko={hint_ko} type="expression" source="리스닝" />
      </div>
      {/* Example sentence */}
      <div style={{borderTop:"1px dashed #F8F8FC",padding:"7px 10px",background:"#FFFDF5"}}>
        {loading && <div style={{fontSize:12,color:"#C8B870"}}>예문 준비 중...</div>}
        {!loading && example && (
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"#2D2B55"}}>{example.en}</div>
              <div style={{fontSize:11,color:"#9490B8",marginTop:2}}>{example?.ko || ""}</div>
            </div>
            <button style={{background:"none",border:"none",cursor:"pointer",fontSize:12,padding:"2px",flexShrink:0}}
              onClick={() => speakText(example.en, 0.9)}>🔊</button>
          </div>
        )}
        {!loading && !example && (
          <div style={{fontSize:12,color:"#9490B8"}}>예문을 불러오지 못했어요</div>
        )}
      </div>
    </div>
  );
}

// ── 페이지 2: 단어탭 + 왜안들려 + 빈칸 + 전체문장 ──
// 🐢 Slow speed toggle — cycles 1x → 0.85 → 0.65 → 0.85 → 1x
function SlowSpeedToggle({ onPlay }) {
  const speeds = [
    { rate: 0.85, label: "🐢 천천히", level: 1 },
    { rate: 0.65, label: "🐢🐢 더 천천히", level: 2 },
    { rate: 0.45, label: "🐢🐢🐢 아주 천천히", level: 3 },
  ];
  const [level, setLevel] = useState(0); // 0 = not yet pressed

  function handlePress() {
    const next = level >= speeds.length ? 1 : level + 1;
    setLevel(next);
    onPlay(speeds[next - 1].rate);
  }

  const current = level > 0 ? speeds[level - 1] : null;

  return (
    <button onClick={handlePress}
      style={{fontSize:12, padding:"6px 14px", borderRadius:20,
        border:"1.5px solid #C4BEFF",
        background: level === 0 ? "#fff" : level === 1 ? "#F0EEFF" : level === 2 ? "#E0DCFF" : "#C4BEFF",
        color:"#7C6EE8", cursor:"pointer",
        fontFamily:"'Nunito',sans-serif", fontWeight:700}}>
      {level === 0 ? "🐢 천천히" : current?.label}
      {level > 0 && <span style={{marginLeft:4,fontSize:10,opacity:0.7}}>{"●".repeat(level)}{"○".repeat(3-level)}</span>}
    </button>
  );
}


function WordTapPage({ words, blanks, sentence, ko, lv, playing, playAudio,
  blankSelections, setBlankSelections, blankResults, setBlankResults,
  checked, setChecked, onBack, onNext, nextLabel }) {

  const SIMILAR_MAP = {"been":"bean","hear":"here","their":"there","for":"four","to":"two","by":"buy","meet":"meat","wait":"weight","right":"write","know":"no","see":"sea","week":"weak","look":"luck","live":"leave","hit":"heat","sit":"seat"};

  const [pool] = useState(() => {
    const real = words.map((w,i) => ({word:w, idx:i, distractor:false}));
    // Add distractors - similar sounding or common words
    const SIMILAR_MAP = {"been":"bean","hear":"here","their":"there","for":"four","to":"two","by":"buy","meet":"meat","wait":"weight","right":"write","know":"no","see":"sea","week":"weak","look":"luck","live":"leave","hit":"heat","sit":"seat","take":"lake","make":"wake","get":"got","go":"do","am":"an","is":"his","are":"our","was":"has","want":"went"};
    const COMMON_DISTRACTORS = ["just","really","very","much","more","than","then","when","where","what","who","how","some","any","every","all","also"];
    const distractors = [];
    words.forEach((w, i) => {
      const lower = w.toLowerCase().replace(/[^a-z]/g,"");
      if (SIMILAR_MAP[lower]) {
        distractors.push({word: SIMILAR_MAP[lower], idx: 1000+i, distractor:true});
      }
    });
    // Add 2-3 common distractors if not enough
    const needed = Math.max(0, 3 - distractors.length);
    const extras = COMMON_DISTRACTORS
      .filter(d => !words.map(w=>w.toLowerCase()).includes(d))
      .slice(0, needed)
      .map((d,i) => ({word:d, idx:2000+i, distractor:true}));
    
    const arr = [...real, ...distractors, ...extras];
    // Fisher-Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });
  const [order, setOrder] = useState([]);
  const [used, setUsed] = useState({});
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showBlanks, setShowBlanks] = useState(false);
  const [showReveal, setShowReveal] = useState(false);

  function addWord(item) {
    const key = item.idx;
    if (used[key]) return;
    setOrder(o => [...o, key]);
    setUsed(u => ({...u, [key]: true}));
  }

  function removeWord(key, pos) {
    setOrder(o => o.filter((_,j) => j !== pos));
    setUsed(u => ({...u, [key]: false}));
  }

  function handleBlank(si, opt) {
    const newSel = {...blankSelections, [si]: opt};
    setBlankSelections(newSel);
    if (Object.keys(newSel).length >= blanks.length) {
      setTimeout(() => {
        const results = {};
        let correct = 0;
        blanks.forEach((bl,i) => {
          const ok = (newSel[i]||"").toLowerCase().trim() === (bl.word||"").toLowerCase().trim();
          results[i] = ok;
          if (ok) correct++;
        });
        setBlankResults(results);
        setChecked(true);
        playSound(correct === blanks.length);
        setShowReveal(true);
      }, 400);
    }
  }

  const userSentence = order.map(k => {
    const item = pool.find(p => p.idx === k);
    return item ? item.word : "";
  }).join(" ");
  // Clean both sides the same way for fair comparison
  // All real words tapped = correct (ignore distractors)
  const realWordCount = pool.filter(p => !p.distractor).length;
  const tappedReal = order.filter(idx => idx < 1000).length;
  const tappedDistractor = order.filter(idx => idx >= 1000).length;
  const isCorrect = tappedReal === realWordCount && tappedDistractor === 0;

  return (
    <div>
      <button className="mm-btn-back" onClick={onBack}>
        <ArrowLeft size={16} /> 이전
      </button>

      <div className="mm-card">
        <div style={{fontSize:12,fontWeight:800,color:"#7C6EE8",marginBottom:4}}>들리는 단어 탭하기</div>
        <div style={{fontSize:11,color:"#9490B8",marginBottom:10}}>들린 단어를 모두 탭해봐요! 순서 상관없어요.</div>

        <div style={{minHeight:44,background:"#F8F8FC",borderRadius:12,
          padding:"8px 12px",marginBottom:8,display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
          {order.length > 0 ? (
            <span style={{color:"#7C6EE8",fontSize:12,fontWeight:700}}>{order.length} / {words.length} 탭됨</span>
          ) : (
            <span style={{color:"#C4BEFF",fontSize:12}}>들린 단어를 탭해봐요</span>
          )}
        </div>

        {/* 🔊 다시 듣기 아이콘만 */}
        <button onClick={() => playAudio(lv.speed)} disabled={playing}
          style={{display:"block",margin:"0 auto 12px",fontSize:32,
            background:"none",border:"none",cursor:"pointer",
            opacity:playing?0.4:1}}>
          🔊
        </button>

        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
          {pool.map((item,i) => (
            <button key={i} onClick={() => addWord(item)} disabled={!!used[item.idx]}
              style={{padding:"8px 14px",borderRadius:20,
                border:"2px solid "+(used[item.idx]?"#7C6EE8":"#C4BEFF"),
                background:used[item.idx]?"#F8F8FC":"#FFFFFF",
                color:used[item.idx]?"#C4BEFF":"#2D2B55",
                fontSize:13,fontWeight:700,cursor:used[item.idx]?"not-allowed":"pointer",
                fontFamily:"'Nunito',sans-serif",opacity:used[item.idx]?0.4:1}}>
              {item.word}
            </button>
          ))}
        </div>

        {order.length === words.length && (
          <div style={{padding:"10px 14px",borderRadius:12,marginBottom:8,
            background:isCorrect?"#E8F8F4":"#FFF0EB",
            border:"1.5px solid "+(isCorrect?"#06D6A0":"#EF233C")}}>
            <div style={{fontSize:13,fontWeight:700,color:isCorrect?"#1E8E78":"#B23A3A"}}>
              {isCorrect ? "완벽해요!" : "다시 해봐요"}
            </div>
            {!isCorrect && (
              <button onClick={() => { setOrder([]); setUsed({}); }}
                style={{marginTop:6,fontSize:12,padding:"4px 12px",borderRadius:20,
                  border:"none",background:"#2D2B55",color:"#fff",cursor:"pointer",
                  fontFamily:"'Nunito',sans-serif",fontWeight:700}}>
                다시 시도
              </button>
            )}
          </div>
        )}

        {/* Undo / Reset buttons */}
        {order.length > 0 && !isCorrect && (
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <button onClick={() => {
                const lastKey = order[order.length-1];
                setOrder(o => o.slice(0,-1));
                setUsed(u => {const n={...u}; delete n[lastKey]; return n;});
              }}
              style={{flex:1,padding:"8px",borderRadius:12,border:"1.5px solid #C4BEFF",
                background:"#fff",color:"#7C6EE8",fontSize:12,fontWeight:800,
                cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>
              ↩ 취소
            </button>
            <button onClick={() => { setOrder([]); setUsed({}); }}
              style={{flex:1,padding:"8px",borderRadius:12,border:"1.5px solid #EF233C",
                background:"#fff",color:"#EF233C",fontSize:12,fontWeight:800,
                cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>
              🔄 처음부터
            </button>
          </div>
        )}

      </div>

      {/* 🔍 왜 안들려 — undo/reset 아래 메인 자리 */}
      {!isCorrect && order.length > 0 && !showAnalysis && (
        <button style={{width:"100%",marginBottom:12,padding:"16px",
          border:"none",borderRadius:16,background:"#7C6EE8",
          color:"#fff",fontSize:17,fontWeight:900,cursor:"pointer",
          fontFamily:"'Nunito','Noto Sans KR',sans-serif",
          boxShadow:"0 4px 12px rgba(124,110,232,0.3)"}}
          onClick={() => setShowAnalysis(true)}>
          🔍 왜 안들려? 분석 보기
        </button>
      )}

      {!isCorrect && showAnalysis && (
        <div className="mm-card">
          <div style={{fontSize:12,fontWeight:800,color:"#7C6EE8",marginBottom:8}}>🔍 왜 안들려?</div>
          <ColourAnnotationDrill sentence={sentence} />
          <button className="mm-btn-primary" style={{width:"100%",marginTop:14}}
            onClick={() => { setShowBlanks(true); }}>
            ✏️ 빈칸 채우기 →
          </button>
        </div>
      )}

      {/* isCorrect → show 빈칸 button */}
      {isCorrect && !showBlanks && blanks.length > 0 && (
        <button className="mm-btn-primary" style={{width:"100%",marginBottom:12,padding:"14px",fontSize:15}}
          onClick={() => setShowBlanks(true)}>
          ✏️ 빈칸 채우기
        </button>
      )}
      {isCorrect && !showBlanks && blanks.length === 0 && (
        <button className="mm-btn-primary" style={{width:"100%",marginBottom:12}}
          onClick={onNext}>
          다음 →
        </button>
      )}

      {showBlanks && (
        <div className="mm-card">
          <div style={{fontSize:12,fontWeight:800,color:"#7C6EE8",marginBottom:10}}>빈칸 채우기</div>
          <div style={{fontSize:15,fontWeight:700,color:"#2D2B55",lineHeight:2.2,
            background:"#F8F8FC",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
            {(() => {
              let parts = [{text:sentence, isBlank:false, si:-1}];
              blanks.forEach((b,si) => {
                const newParts = [];
                parts.forEach(p => {
                  if (p.isBlank) { newParts.push(p); return; }
                  const idx = p.text.toLowerCase().indexOf(b.word.toLowerCase());
                  if (idx >= 0) {
                    if (idx > 0) newParts.push({text:p.text.slice(0,idx), isBlank:false});
                    newParts.push({text:b.word, isBlank:true, si});
                    newParts.push({text:p.text.slice(idx+b.word.length), isBlank:false});
                  } else { newParts.push(p); }
                });
                parts = newParts;
              });
              return parts.map((p,i) => {
                if (!p.isBlank) return <span key={i}>{p.text}</span>;
                const sel = blankSelections[p.si];
                const isDone = blankResults[p.si] !== undefined;
                const isOk = blankResults[p.si];
                return (
                  <span key={i} style={{display:"inline-block",
                    background:isDone?(isOk?"#E8F8F4":"#FFF0EB"):sel?"#7C6EE8":"#EDE9FF",
                    borderRadius:8,padding:"2px 14px",margin:"0 2px",
                    border:"2px solid "+(isDone?(isOk?"#06D6A0":"#EF233C"):sel?"#7C6EE8":"#C4BEFF"),
                    color:isDone?(isOk?"#1E8E78":"#B23A3A"):sel?"#fff":"#9490B8",
                    fontWeight:800,minWidth:80,textAlign:"center"}}>
                    {sel || "___"}
                  </span>
                );
              });
            })()}
          </div>
          {blanks.map((b,si) => {
            if (blankSelections[si] !== undefined) return null;
            return (
              <div key={si} style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"#9490B8",marginBottom:6}}>{b.hint_ko}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {(b.options||[]).map((opt,oi) => (
                    <button key={oi} onClick={() => handleBlank(si,opt)}
                      style={{padding:"9px 18px",borderRadius:20,
                        border:"2px solid #C4BEFF",background:"#F0EEFF",color:"#2D2B55",
                        fontSize:14,fontWeight:700,cursor:"pointer",
                        fontFamily:"'Nunito','Noto Sans KR',sans-serif"}}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Korean + 🔊 + 다음 — all inside same card */}
          {showReveal && (
            <div style={{marginTop:12,borderTop:"1px solid #EDE9FF",paddingTop:12}}>
              {ko && <div style={{fontSize:14,color:"#2D2B55",fontWeight:700,marginBottom:12,
                textAlign:"center",lineHeight:1.6}}>{ko}</div>}
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={() => speakText(sentence, lv.speed)}
                  style={{fontSize:26,background:"none",border:"none",cursor:"pointer",
                    flexShrink:0,padding:"4px 8px"}}>
                  🔊
                </button>
                <button className="mm-btn-primary" style={{flex:1}} onClick={onNext}>
                  {nextLabel || "다음 →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Lesson Flow Component ──────────────────────────────────────────────
// ── Teacher explanations (pre-written) ──
const TEACHER_EXPLANATIONS = {};


function highlightGrammar(text, words) {
  if (!words || !words.length || !text) return text;
  return text;
}


function FlashcardVocab({ vocab, topicLabel, onBack }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (!vocab.length) return null;
  const item = vocab[idx];
  return (
    <div>
      <button className="mm-btn-back" onClick={() => { window.speechSynthesis.cancel(); onBack(); }}><ArrowLeft size={14}/> 뒤로</button>
      <div className="mm-card">
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:800,color:"#7C6EE8"}}>{topicLabel}</div>
          <div style={{fontSize:12,color:"#9490B8"}}>{idx+1} / {vocab.length}</div>
        </div>
        <div onClick={()=>setFlipped(f=>!f)}
          style={{minHeight:140,borderRadius:16,padding:"20px",cursor:"pointer",
            background:flipped?"#7C6EE8":"#F8F7FF",border:"2px solid #EDE9FF",
            display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",textAlign:"center",marginBottom:16}}>
          {!flipped ? (
            <div>
              <div style={{fontSize:18,fontWeight:900,color:"#2D2B55",marginBottom:6}}>{item.en}</div>
              <div style={{fontSize:11,color:"#9490B8"}}>탭해서 한국어 보기</div>
            </div>
          ) : (
            <div>
              <div style={{fontSize:16,fontWeight:800,color:"#fff",marginBottom:8}}>{item?.ko || ""}</div>
              <button onClick={e=>{e.stopPropagation();speakText(item.en,0.9);}}
                style={{fontSize:22,background:"none",border:"none",cursor:"pointer"}}>🔊</button>
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="mm-btn-ghost" style={{flex:1}}
            onClick={()=>{setIdx(i=>(i-1+vocab.length)%vocab.length);setFlipped(false);}}>← 이전</button>
          <button className="mm-btn-primary" style={{flex:2}}
            onClick={()=>{setIdx(i=>(i+1)%vocab.length);setFlipped(false);}}>다음 →</button>
        </div>
      </div>
    </div>
  );
}


function DrillCard({ pattern, exIdx, patIdx, totalPat, onPrev, onNext, isLast, vocab }) {
  const SpeechRec = getSpeechRecognition();
  const [drillState, setDrillState] = useState("idle"); // idle | listening | done | correct | wrong
  const [transcript, setTranscript] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [speakWordIdx, setSpeakWordIdx] = useState(-1);
  const recRef = useRef(null);
  const currentEx = pattern?.examples?.[exIdx];

  useEffect(() => {
    setDrillState("idle");
    setTranscript("");
  }, [exIdx, patIdx]);

  function handleListen() {
    setSpeaking(true);
    setSpeakWordIdx(0);
    const words = (drillItem?.en || "").split(" ");
    const msPerWord = Math.max(300, (1200 / words.length));
    words.forEach((_, i) => {
      setTimeout(() => setSpeakWordIdx(i), i * msPerWord);
    });
    speakText(drillItem?.en, 0.85).then(() => {
      setSpeaking(false);
      setSpeakWordIdx(-1);
    });
  }

  function handleSpeak() {
    if (!SpeechRec) {
      alert("이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해주세요!");
      return;
    }
    const rec = new SpeechRec();
    rec.lang = "en-US";
    rec.interimResults = false;
    setDrillState("listening");
    setTranscript("");
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      const target = (currentEx?.en || "").toLowerCase().replace(/[^a-z ]/g,"");
      const said = text.toLowerCase().replace(/[^a-z ]/g,"");
      const match = target.split(" ").filter(w=>w.length>2).every(w=>said.includes(w));
      setDrillState(match ? "correct" : "wrong");
    };
    rec.onerror = () => setDrillState("idle");
    rec.onend = () => { if(drillState==="listening") setDrillState("idle"); };
    recRef.current = rec;
    rec.start();
  }

  // If no examples, use vocab words as slots
  const vocabDrills = !currentEx && vocab?.length > 0
    ? vocab.slice(0, 3).map(v => ({en: v.en, ko: v.ko}))
    : null;
  const drillItem = currentEx || (vocabDrills?.[exIdx % vocabDrills?.length]);

  if (!drillItem) {
    return (
      <div className="mm-card">
        <div style={{fontSize:12,fontWeight:800,color:"#7C6EE8",marginBottom:12}}>패턴 {patIdx+1} / {totalPat}</div>
        <div style={{background:"#EDE9FF",borderRadius:12,padding:"16px 14px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:15,fontWeight:900,color:"#7C6EE8",marginBottom:8}}>{pattern.pattern_en}</div>
          <div style={{fontSize:13,color:"#2D2B55"}}>{pattern.explain_ko}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="mm-btn-ghost" style={{flex:1}} onClick={onPrev}>← 이전</button>
          <button className="mm-btn-primary" style={{flex:2}} onClick={onNext}>
            {isLast ? "복습하기 →" : "다음 →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mm-card">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:800,color:"#7C6EE8"}}>
          패턴 {patIdx+1} / {totalPat}
        </div>
        <div style={{fontSize:11,color:"#9490B8"}}>
          {exIdx+1} / {pattern.examples?.length || 0}
        </div>
      </div>

      {/* Pattern label */}
      <div style={{background:"#EDE9FF",borderRadius:12,padding:"10px 14px",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:900,color:"#7C6EE8"}}>{pattern.pattern_en}</div>
        <div style={{fontSize:11,color:"#9490B8",marginTop:4}}>{pattern.explain_ko}</div>
      </div>

      {/* Example */}
      <div style={{background:"#F8F7FF",borderRadius:14,padding:"20px 16px",
        marginBottom:12,textAlign:"center"}}>
        <div style={{fontSize:13,color:"#9490B8",marginBottom:10}}>{currentEx?.ko || ""}</div>
        {/* Words with highlight as TTS plays */}
        <div style={{fontSize:18,fontWeight:900,color:"#2D2B55",marginBottom:16,
          lineHeight:1.8,display:"flex",flexWrap:"wrap",gap:4,justifyContent:"center"}}>
          {(drillItem.en || "").split(" ").map((word, wi) => (
            <span key={wi} style={{
              transition:"color 0.15s",
              fontSize: 18,
              color: speaking && wi === speakWordIdx ? "#7C6EE8" : "#2D2B55",
              fontWeight: speaking && wi === speakWordIdx ? 900 : 700,
              textDecoration: speaking && wi === speakWordIdx ? "underline" : "none",
            }}>{word}</span>
          ))}
        </div>

        {/* Listen + Speak buttons */}
        <div style={{display:"flex",justifyContent:"center",gap:24}}>
          <button onClick={handleListen} disabled={speaking}
            style={{fontSize:32,background:"none",border:"none",cursor:"pointer",
              opacity:speaking?0.5:1}}>
            🔊
          </button>
          <button onClick={handleSpeak}
            style={{fontSize:32,background:"none",border:"none",cursor:"pointer",
              color:drillState==="listening"?"#EF233C":"#2D2B55"}}>
            {drillState==="listening" ? "🔴" : "🎤"}
          </button>
        </div>

        {/* Result */}
        {drillState==="correct" && (
          <div style={{marginTop:10,color:"#06D6A0",fontWeight:800,fontSize:14}}>
            ✅ 잘하셨어요!
          </div>
        )}
        {drillState==="wrong" && (
          <div style={{marginTop:10}}>
            <div style={{color:"#EF233C",fontWeight:700,fontSize:12,marginBottom:4}}>
              다시 해봐요
            </div>
            <div style={{fontSize:11,color:"#9490B8"}}>"{transcript}"</div>
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:8}}>
        <button className="mm-btn-ghost" style={{flex:1}} onClick={onPrev}>← 이전</button>
        <button className="mm-btn-primary" style={{flex:2}} onClick={onNext}>
          {isLast ? "복습하기 →" : "다음 →"}
        </button>
      </div>
    </div>
  );
}


function ReviewStage({ sentences, idx, onNext, onPrev, isLast }) {
  const SpeechRec = getSpeechRecognition();
  const sentence = sentences?.[idx] || {};
  const en = sentence?.en || "";
  
  // Parse S/V/O from sentence
  function parseSVO(text) {
    const words = text.replace(/[?.!,]/g,"").split(" ").filter(Boolean);
    // Simple heuristics
    const subjectWords = ["I","You","He","She","We","They","It","My","Her","His","Their","Our","The","A","An"];
    const verbWords = ["am","is","are","was","were","have","has","had","do","does","did","will","would","can","could","should","may","might","must","need","want","like","love","hate","go","get","make","take","see","know","think","say","tell","come","give","use","find","feel","try","ask","seem","leave","call","keep","let","put","mean","become","show","hear","play","run","move","live","believe","hold","bring","happen","write","provide","sit","stand","lose","pay","meet","include","continue","set","learn","change","lead","understand","watch","follow","stop","create","speak","read","spend","grow","open","walk","win","offer","remember","love","consider","appear","buy","serve","die","send","expect","build","stay","fall","cut","reach","kill","remain","suggest","raise","pass","sell","require","report","decide","pull"];
    
    let subj = [], verb = [], obj = [];
    let phase = "s";
    
    words.forEach(w => {
      const lower = w.toLowerCase();
      if (phase === "s" && subjectWords.some(s=>s.toLowerCase()===lower)) {
        subj.push(w);
      } else if (phase === "s" || phase === "v") {
        phase = "v";
        if (verbWords.includes(lower) || lower.endsWith("ing") || lower.endsWith("ed") || lower.endsWith("to")) {
          verb.push(w);
        } else {
          phase = "o";
          obj.push(w);
        }
      } else {
        obj.push(w);
      }
    });
    
    if (subj.length === 0) subj = [words[0] || "?"];
    if (verb.length === 0) verb = [words[1] || "?"];
    if (obj.length === 0) obj = words.slice(2).join(" ") ? [words.slice(2).join(" ")] : ["—"];
    
    return { subj: subj.join(" "), verb: verb.join(" "), obj: obj.join(" ") };
  }

  const [reviewStep, setReviewStep] = useState("subj"); // subj | verb | obj | speak
  const [micState, setMicState] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const svo = parseSVO(en);

  useEffect(() => {
    setReviewStep("subj");
    setMicState("idle");
    setTranscript("");
  }, [idx]);

  function handleSpeak() {
    if (!SpeechRec) { alert("Chrome을 사용해주세요!"); return; }
    const rec = new SpeechRec();
    rec.lang = "en-US";
    rec.interimResults = false;
    setMicState("listening");
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      const target = en.toLowerCase().replace(/[^a-z ]/g,"");
      const said = text.toLowerCase().replace(/[^a-z ]/g,"");
      const match = target.split(" ").filter(w=>w.length>2).every(w=>said.includes(w));
      setMicState(match ? "correct" : "wrong");
    };
    rec.onerror = () => setMicState("idle");
    rec.start();
  }

  const steps = [
    { id:"subj", label:"주어 (Subject)", value: svo.subj, color:"#7C6EE8", hint:"누가?" },
    { id:"verb", label:"동사 (Verb)", value: svo.verb, color:"#06D6A0", hint:"어떻게?" },
    { id:"obj",  label:"목적어 (Object)", value: svo.obj, color:"#F77F00", hint:"무엇을?" },
    { id:"speak",label:"조합해서 말하기", value: en, color:"#EF233C", hint:"전체 문장!" },
  ];
  const stepIdx = steps.findIndex(s=>s.id===reviewStep);
  const currentStep = steps[stepIdx];

  return (
    <div className="mm-card">
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:800,color:"#7C6EE8"}}>복습하기</div>
        <div style={{fontSize:11,color:"#9490B8"}}>{idx+1} / {sentences.length}</div>
      </div>

      {/* Korean sentence */}
      <div style={{background:"#F8F7FF",borderRadius:12,padding:"12px 14px",
        marginBottom:12,textAlign:"center",fontSize:15,fontWeight:700,color:"#2D2B55"}}>
        {sentence?.ko || ""}
      </div>

      {/* Step progress */}
      <div style={{display:"flex",gap:4,marginBottom:12}}>
        {steps.map((s,i) => (
          <div key={s.id} style={{flex:1,height:4,borderRadius:4,
            background:i<=stepIdx?s.color:"#EDE9FF"}}/>
        ))}
      </div>

      {/* Current step */}
      <div style={{background:currentStep.color+"15",borderRadius:14,
        padding:"20px 16px",marginBottom:12,textAlign:"center",
        border:`2px solid ${currentStep.color}30`}}>
        <div style={{fontSize:11,fontWeight:800,color:currentStep.color,marginBottom:6}}>
          {currentStep.label} — {currentStep.hint}
        </div>
        <div style={{fontSize:20,fontWeight:900,color:"#2D2B55",marginBottom:12}}>
          {currentStep.value}
        </div>
        <button onClick={()=>speakText(currentStep.value,0.9)}
          style={{fontSize:26,background:"none",border:"none",cursor:"pointer"}}>
          🔊
        </button>

        {/* Speak step */}
        {reviewStep === "speak" && (
          <div style={{marginTop:12}}>
            <button onClick={handleSpeak}
              style={{fontSize:32,background:"none",border:"none",cursor:"pointer",
                color:micState==="listening"?"#EF233C":"#2D2B55"}}>
              {micState==="listening" ? "🔴" : "🎤"}
            </button>
            {micState==="correct" && <div style={{color:"#06D6A0",fontWeight:800,marginTop:8}}>✅ 완벽해요!</div>}
            {micState==="wrong" && <div style={{color:"#EF233C",fontSize:12,marginTop:8}}>다시 해봐요<br/>"{transcript}"</div>}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{display:"flex",gap:8}}>
        <button className="mm-btn-ghost" style={{flex:1}}
          onClick={()=>{
            if(stepIdx>0) setReviewStep(steps[stepIdx-1].id);
            else onPrev();
          }}>← 이전</button>
        <button className="mm-btn-primary" style={{flex:2}}
          onClick={()=>{
            if(stepIdx < steps.length-1) setReviewStep(steps[stepIdx+1].id);
            else onNext();
          }}>
          {stepIdx < steps.length-1 ? steps[stepIdx+1].label+" →" : isLast ? "워크시트 →" : "다음 →"}
        </button>
      </div>
    </div>
  );
}


function FlashExampleBox({ vocab, staticEx }) {
  const [ex, setEx] = useState(staticEx || null);
  const [loading, setLoading] = useState(!staticEx && !!vocab);

  useEffect(() => {
    if (staticEx) { setEx(staticEx); setLoading(false); return; }
    if (!vocab) { setLoading(false); return; }
    // If vocab is already a long phrase (4+ words), skip AI generation
    if (vocab.split(" ").length >= 4) { setLoading(false); return; }
    let cancelled = false;
    async function generate() {
      try {
        const res = await askClaudeJSON(
          `Generate ONE short natural English example sentence (max 10 words) that uses the expression "${vocab}" naturally.
Return ONLY JSON: {"en":"sentence with ${vocab}","ko":"한국어 번역"}`,
          `Expression: "${vocab}"`
        );
        if (!cancelled && res?.en && res.en.toLowerCase().includes(vocab.toLowerCase().split(" ")[0])) {
          setEx(res);
        }
      } catch(e) {}
      if (!cancelled) setLoading(false);
    }
    generate();
    return () => { cancelled = true; };
  }, [vocab]);

  if (loading) return (
    <div style={{marginTop:8,padding:"8px 12px",background:"rgba(255,255,255,0.1)",
      borderRadius:10,fontSize:11,color:"#C4BEFF"}}>예문 생성 중...</div>
  );
  if (!ex) return null;
  return (
    <div style={{marginTop:8,padding:"8px 12px",background:"rgba(255,255,255,0.15)",
      borderRadius:10,textAlign:"left"}}>
      <div style={{fontSize:11,color:"#C4BEFF",marginBottom:4}}>예문</div>
      <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{ex.en}</div>
      <div style={{fontSize:11,color:"#C4BEFF",marginTop:2}}>{ex?.ko || ""}</div>
      <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
        <button onClick={e=>{e.stopPropagation();speakText(ex.en,0.9);}}
          style={{fontSize:20,background:"none",border:"none",cursor:"pointer"}}>
          🔊
        </button>
        <SaveButton en={ex.en} ko={ex?.ko || ""} type="expression" source="핵심표현 예문" />
      </div>
    </div>
  );
}


function LessonFlow({ topic, onBack, goTo, skipReveal }) {
  // Steps: flashcards → explain → pattern drills → review → worksheet → interview
  const patterns = topic.patterns || [];
  
  // 핵심표현 = vocab (chunks), fallback to expressions
  const expressions = (topic.vocab && topic.vocab.length > 0)
    ? topic.vocab.map(v => ({en: v.en, ko: v.ko}))
    : (topic.expressions || []);
  const [step, setStep] = useState("flash");

  // Stop TTS when step changes
  useEffect(() => {
    window.speechSynthesis.cancel();
  }, [step]);
  const [flashIdx, setFlashIdx] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);



  // Auto-play TTS when flashcard changes
  useEffect(() => {
    if (step === "flash" && expressions[flashIdx]?.en) {
      const t = setTimeout(() => speakText(expressions[flashIdx].en, 0.9), 300);
      return () => clearTimeout(t);
    }
  }, [flashIdx, step]);
  const [drillPatIdx, setDrillPatIdx] = useState(0);
  const [drillExIdx, setDrillExIdx] = useState(0);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewDone, setReviewDone] = useState(false);
  const [sharedExplanation, setSharedExplanation] = useState(TEACHER_EXPLANATIONS[topic.id] || null);

  // Review sentences - 3 from patterns examples, fallback to topic expressions
  const patternExamples = patterns.flatMap(p => p.examples || []);
  const topicExpressions = (topic.expressions || []).map(e => ({ko: e.ko, en: e.en}));
  const reviewSentences = (patternExamples.length > 0 ? patternExamples : topicExpressions).slice(0, 3);
  const currentPattern = patterns[drillPatIdx];
  const currentEx = currentPattern?.examples?.[drillExIdx];

  function goNext() {
    // Flash cards
    if (step === "flash") {
      if (expressions.length === 0) { setStep("explain"); return; }
      if (flashIdx < expressions.length - 1) {
        setFlashIdx(i => i + 1);
        setFlashFlipped(false);
      } else {
        setStep("explain");
      }
      return;
    }
    if (step === "explain") {
      setStep(patterns.length > 0 ? "drill" : (reviewSentences.length > 0 ? "review" : "worksheet"));
      return;
    }
    // Pattern drills
    if (step === "drill") {
      const exLen = currentPattern?.examples?.length || 0;
      if (drillExIdx < exLen - 1) {
        setDrillExIdx(i => i + 1);
      } else if (drillPatIdx < patterns.length - 1) {
        setDrillPatIdx(i => i + 1);
        setDrillExIdx(0);
      } else {
        if (reviewSentences.length > 0) {
          setStep("review");
          setReviewIdx(0);
          setReviewDone(false);
        } else {
          setStep("worksheet");
        }
      }
      return;
    }
    // Review
    if (step === "review") {
      if (reviewIdx < reviewSentences.length - 1) {
        setReviewIdx(i => i + 1);
        setReviewDone(false);
      } else {
        setStep("worksheet");
      }
      return;
    }
  }

  const totalFlash = expressions.length;
  const totalDrillPat = patterns.length;

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <button onClick={onBack} className="mm-btn-back" style={{flexShrink:0}}>
          <ArrowLeft size={14}/> 뒤로
        </button>
        <div style={{flex:1,background:"#7C6EE8",borderRadius:12,padding:"8px 14px"}}>
          <div style={{fontSize:11,color:"#C4BEFF",fontWeight:700}}>Real Life</div>
          <div style={{fontSize:14,fontWeight:900,color:"#fff"}}>{topic.label_ko.split(" — ")[0]}</div>
        </div>
      </div>

      {/* Step indicators */}
      <div style={{display:"flex",gap:4,marginBottom:14}}>
        {[
          {id:"flash",label:"핵심표현", show: expressions.length > 0},
          {id:"explain",label:"설명", show: true},
          {id:"drill",label:"패턴", show: patterns.length > 0},
          {id:"review",label:"복습", show: reviewSentences.length > 0},
          {id:"worksheet",label:"워크시트", show: true},
          {id:"interview",label:"인터뷰", show: true},
        ].map((s,i) => {
          const order = ["flash","explain","drill","review","worksheet","interview"];
          const active = step === s.id;
          const done = order.indexOf(step) > i;
          return (
            <div key={s.id}
              onClick={() => setStep(s.id)}
              style={{flex:1,textAlign:"center",fontSize:9,fontWeight:700,
                padding:"4px 2px",borderRadius:6,cursor:"pointer",
                background:active?"#7C6EE8":done?"#EDE9FF":"#F8F7FF",
                color:active?"#fff":done?"#7C6EE8":"#C4BEFF"}}>
              {s.label}
            </div>
          );
        })}
      </div>

      {/* ── 1. Flash Cards ── */}
      {step === "flash" && (
        <div className="mm-card">
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:800,color:"#7C6EE8"}}>핵심표현</div>
            <div style={{fontSize:12,color:"#9490B8"}}>{flashIdx+1} / {totalFlash}</div>
          </div>

          {/* Card */}
          <div onClick={() => {
              if (!flashFlipped) {
                setFlashFlipped(true);
                speakText(expressions[flashIdx]?.en, 0.9);
              } else {
                goNext();
                setFlashFlipped(false);
              }
            }}
            style={{minHeight:160,borderRadius:16,padding:"24px 20px",cursor:"pointer",
              background:flashFlipped?"#7C6EE8":"#F8F7FF",
              border:"2px solid #EDE9FF",
              display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",textAlign:"center",userSelect:"none",
              marginBottom:16,transition:"background 0.2s"}}>
            {!flashFlipped ? (
              <div>
                <div style={{fontSize:20,fontWeight:900,color:"#2D2B55",marginBottom:8}}>
                  {expressions[flashIdx]?.en}
                </div>
                <button onClick={e=>{e.stopPropagation();speakText(expressions[flashIdx]?.en,0.9);}}
                  style={{fontSize:24,background:"none",border:"none",cursor:"pointer",marginBottom:4}}>🔊</button>
                <div style={{fontSize:11,color:"#9490B8"}}>탭해서 한국어 보기</div>
              </div>
            ) : (
              <div style={{width:"100%"}}>
                <div style={{fontSize:18,fontWeight:800,color:"#fff",marginBottom:8}}>
                  {expressions[flashIdx]?.ko}
                </div>
                <button onClick={e=>{e.stopPropagation();speakText(expressions[flashIdx]?.en,0.9);}}
                  style={{fontSize:24,background:"none",border:"none",cursor:"pointer",marginBottom:8}}>🔊</button>
                {/* Example sentence - find one containing the vocab word */}
                {(() => {
                  // Use pre-built examples or AI-generated
                  const allExamples = [
                    ...(topic.patterns?.flatMap(p=>p.examples||[]) || []),
                    ...(topic.example_pairs || []),
                  ];
                  const vocabWord = expressions[flashIdx]?.en || "";
                  const vocabEn = vocabWord.toLowerCase().split(" ")[0];
                  const ex = allExamples.find(e => e.en?.toLowerCase().includes(vocabEn)) || null;
                  // Don't show example if vocab is already a long phrase (5+ words)
                  if (vocabWord.split(" ").length >= 5) return null;
                  return <FlashExampleBox key={flashIdx} vocab={vocabWord} staticEx={ex} />;
                })()}
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:8}}>
            {flashIdx > 0 && (
              <button className="mm-btn-ghost" style={{flex:1}}
                onClick={()=>{setFlashIdx(i=>i-1);setFlashFlipped(false);}}>← 이전</button>
            )}
            <button className="mm-btn-primary" style={{flex:2}} onClick={goNext}>
              {flashIdx < totalFlash-1 ? "다음 →" : "설명 보기 →"}
            </button>
          </div>
        </div>
      )}

      {/* ── 2. Explain ── */}
      {step === "explain" && (
        <div className="mm-card">
          <div style={{fontSize:12,fontWeight:800,color:"#7C6EE8",marginBottom:12}}>오늘의 설명</div>
          {topic.patterns?.map((p, i) => (
            <div key={i} style={{marginBottom:14,paddingBottom:14,
              borderBottom:i<topic.patterns.length-1?"1px solid #EDE9FF":"none"}}>
              <div style={{fontSize:13,fontWeight:900,color:"#2D2B55",marginBottom:4}}>{p.pattern_en}</div>
              <div style={{fontSize:12,color:"#9490B8",marginBottom:8}}>{p.explain_ko}</div>
            </div>
          ))}
          <button className="mm-btn-primary" style={{width:"100%",marginTop:8}}
            onClick={() => { setStep("drill"); setDrillPatIdx(0); setDrillExIdx(0); }}>
            패턴 드릴 시작 →
          </button>
        </div>
      )}

      {/* ── 3. Pattern Drills ── */}
      {step === "drill" && currentPattern && (
        <DrillCard
          pattern={currentPattern}
          exIdx={drillExIdx}
          patIdx={drillPatIdx}
          totalPat={totalDrillPat}
          vocab={topic.vocab}
          onPrev={()=>{
            if(drillExIdx>0) setDrillExIdx(i=>i-1);
            else if(drillPatIdx>0){setDrillPatIdx(i=>i-1);setDrillExIdx(0);}
            else setStep("explain");
          }}
          onNext={goNext}
          isLast={drillPatIdx===patterns.length-1 && drillExIdx===(currentPattern.examples?.length||0)-1}
        />
      )}

      {/* ── 4. Review ── */}
      {step === "review" && (
        <ReviewStage
          sentences={(reviewSentences.length > 0 ? reviewSentences : patterns.flatMap(p=>p.examples||[]).slice(0,3)).filter(s=>s?.en)}
          idx={reviewIdx}
          onNext={()=>{
            if(reviewIdx < reviewSentences.length-1){setReviewIdx(i=>i+1);setReviewDone(false);}
            else setStep("worksheet");
          }}
          onPrev={()=>{if(reviewIdx>0){setReviewIdx(i=>i-1);setReviewDone(false);}}}
          isLast={reviewIdx >= reviewSentences.length-1}
        />
      )}

      {/* ── 5. Worksheet ── */}
      {step === "worksheet" && (
        <WorksheetStage topic={topic} onNext={() => setStep("interview")} />
      )}

      {/* ── 6. Interview ── */}
      {step === "interview" && (
        <InterviewStage
          topic={topic}
          explanation={sharedExplanation}
          interviewFocus={topic.interview_focus || ""}
          onNext={() => topic.context_en ? setStep("roleplay") : onBack()}
        />
      )}

      {/* ── 7. Roleplay (Scenario only) ── */}
      {step === "roleplay" && topic.context_en && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <button onClick={() => setStep("interview")} className="mm-btn-back">
              <ArrowLeft size={14}/> 뒤로
            </button>
            <div style={{flex:1,background:"#7C6EE8",borderRadius:12,padding:"8px 14px"}}>
              <div style={{fontSize:11,color:"#C4BEFF",fontWeight:700}}>상황 연습</div>
              <div style={{fontSize:14,fontWeight:900,color:"#fff"}}>{topic.label_ko}</div>
            </div>
          </div>
          <ThemeRoleplayStage topic={topic} onDone={() => onBack()} />
        </div>
      )}
    </div>
  );
}


function ExplainStage({ topic, preWritten, onExplanationReady, onNext, onBack, skipReveal }) {
  const [explanation, setExplanation] = useState(preWritten || null);
  const [loading, setLoading] = useState(!preWritten);
  const [revealed, setRevealed] = useState(skipReveal ? 9999 : 0);
  const [showTeacher, setShowTeacher] = useState(false);
  const [teacherCur, setTeacherCur] = useState(0);
  const highlightWords = explanation?.highlight_words || [];

  // Auto-generate explanation if not pre-written
  useEffect(() => {
    if (preWritten) { setExplanation(preWritten); onExplanationReady && onExplanationReady(preWritten); return; }
    if (explanation) return;
    setLoading(true);
    const isTheme = !!(topic.vocab?.length && topic.patterns?.length);
    const vocabHints = (topic.vocab || []).slice(0, 4).map(v => v.en).join(", ");
    const sys = isTheme
      ? `You are a Korean English teacher. Create a phase-based lesson for this conversation topic.
Topic: "${topic.label_ko}". 
Key expressions to teach: ${vocabHints}.

For each expression, give realistic example sentences. Cover EACH expression from the list.
Return ONLY valid JSON (no markdown):
{
  "explanation_ko": "이 상황에서 영어로 대화할 때 알아야 할 것 1문장",
  "trigger_ko": "핵심 패턴 기억법 (예: 요청 → Would you mind + V-ing?)",
  "phases": [
    {
      "phase": "초반",
      "label_ko": "대화 시작",
      "pairs": [
        {"ko": "한국어 전체 문장", "en": "Full natural English sentence using one of the key expressions"},
        {"ko": "한국어 전체 문장", "en": "Another natural English sentence"}
      ]
    },
    {
      "phase": "중반",
      "label_ko": "핵심 표현",
      "pairs": [
        {"ko": "한국어 전체 문장", "en": "Full natural English sentence"},
        {"ko": "한국어 전체 문장", "en": "Full natural English sentence"},
        {"ko": "한국어 전체 문장", "en": "Full natural English sentence"}
      ]
    },
    {
      "phase": "후반",
      "label_ko": "마무리",
      "pairs": [
        {"ko": "한국어 전체 문장", "en": "Full natural English sentence"},
        {"ko": "한국어 전체 문장", "en": "Full natural English sentence"}
      ]
    }
  ],
  "highlight_words": ["key", "words", "from", "expressions"]
}
Rules: EVERY pair must be a COMPLETE natural sentence (not a fragment). Cover all key expressions. Make sentences realistic for the situation.`
      : `You are a Korean English teacher. Explain this topic clearly and give rich example sentences.
Topic: "${topic.label_ko}".
${vocabHints ? `Key expressions: ${vocabHints}` : ""}

Return ONLY valid JSON (no markdown):
{
  "explanation_ko": "핵심 규칙 2-3문장. 한국어로 왜 이렇게 쓰는지 친절하게 설명.",
  "trigger_ko": "기억법 (예: ~야해 → should + 동사원형)",
  "example_pairs": [
    {"ko": "완전한 한국어 문장", "en": "Complete natural English sentence"},
    {"ko": "완전한 한국어 문장", "en": "Complete natural English sentence"},
    {"ko": "완전한 한국어 문장", "en": "Complete natural English sentence"},
    {"ko": "완전한 한국어 문장", "en": "Complete natural English sentence"},
    {"ko": "완전한 한국어 문장", "en": "Complete natural English sentence"}
  ],
  "highlight_words": ["key", "grammar", "words"]
}
IMPORTANT: Give exactly 5 complete example sentences. Each must be a real full sentence, not a fragment or expression label. Vary subjects and situations. Make them relevant to everyday Korean adult life.`;
    askClaudeJSON(sys, `Topic: ${topic.label_ko}. Vocab: ${topic.vocab?.slice(0,3).map(v=>v.en).join(", ")}`)
      .then(res => { setExplanation(res); onExplanationReady && onExplanationReady(res); })
      .catch(() => {
        const fallback = {
          explanation_ko: `${topic.label_ko}를 배워볼게요. 핵심 표현들을 보고 예문을 따라해보세요.`,
          trigger_ko: topic.patterns?.[0]?.explain_ko || "",
          example_pairs: topic.vocab?.slice(0, 3).map(v => ({ ko: v.ko, en: v.en.split(",")[0].trim() })) || [],
          highlight_words: [],
        };
        setExplanation(fallback); onExplanationReady && onExplanationReady(fallback);
      })
      .finally(() => setLoading(false));
  }, [topic.id]);

  const lines = explanation?.explanation_ko?.split("\n").filter(Boolean) || [];
  const totalSteps = lines.length + (explanation?.phases?.length || explanation?.example_pairs?.length || 0);

  function revealNext() {
    const next = revealed + 1;
    setRevealed(next);
    const exIdx = next - lines.length;
    if (exIdx >= 0 && explanation?.example_pairs?.[exIdx]) {
      const enText = explanation.example_pairs[exIdx].en;
      setTimeout(() => speakText(enText, 1.15), 400);
    }
  }

  if (loading) return (
    <div>
      <button className="mm-btn-back" onClick={onBack}><ArrowLeft size={16} /> 토픽 목록</button>
      <div className="mm-card"><Spinner label="설명 준비 중이에요..." /></div>
    </div>
  );

  const teacherSlides = [
    explanation?.explanation_ko || (topic.label_ko + " 표현을 배워봐요!"),
    ...(explanation?.patterns || topic.patterns || []).slice(0, 3).map(p =>
      p.pattern_en + (p.explain_ko ? " — " + p.explain_ko : "")
    ),
    "자 이제 패턴과 예문들을 함께 봐요!"
  ].filter(Boolean);

  return (
    <div>
      <button className="mm-btn-ghost" style={{ marginBottom: 12 }} onClick={onBack}>
        <ArrowLeft size={14} /> 토픽 목록
      </button>
      {/*  Flashcard vocab game  */}
      {(topic.vocab || []).length > 0 && (
        <FlashcardVocab vocab={topic.vocab || []} topicLabel={topic.label_ko} onBack={onBack} />
      )}

      {showTeacher && (
        <TeacherAvatar
          slides={teacherSlides}
          patterns={explanation?.patterns || topic.patterns || []}
          onClose={() => { setShowTeacher(false); setTeacherCur(0); }}
          onCurChange={(i) => setTeacherCur(i)}
        />
      )}

      <div className="mm-card" style={{ marginBottom: 14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#7C6EE8" }}>📖 오늘의 설명</div>
          <button
            onClick={() => { if (!loading && (explanation || topic.patterns?.length)) setShowTeacher(true); }}
            disabled={loading || (!explanation && !topic.patterns?.length)}
            style={{ display:"flex", alignItems:"center", gap:8,
              background: loading ? "#C4BEFF" : "#7C6EE8",
              color:"#fff", border:"none", borderRadius:20, padding:"10px 20px",
              fontSize:15, fontWeight:800,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily:"'Nunito','Noto Sans KR',sans-serif",
              opacity: loading ? 0.6 : 1 }}>
            <span style={{fontSize:22}}>👩‍🏫</span> {loading ? "로딩 중..." : "쌤"}
          </button>
        </div>
        <h2 className="mm-serif" style={{ fontSize:18, margin:"0 0 14px" }}>{topic.label_ko}</h2>
        <div className="mm-col" style={{ gap: 10, marginBottom: 14 }}>
          {lines.map((line, i) => (
            <div key={i} style={{ fontSize: i === 0 ? 16 : 14, fontWeight: i === 0 ? 700 : 500, color: "#2D2B55", lineHeight: 1.6 }}>
              {i === 0 && <span style={{ color: "#7C6EE8", marginRight: 6 }}>★</span>}
              {line}
            </div>
          ))}
        </div>
        {explanation?.trigger_ko && (
          <div style={{ background: "#FFF8E8", border: "2px solid #B8ADFF", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#6B5B2A", marginBottom: 3 }}>💡 기억하는 법</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{explanation.trigger_ko}</div>
          </div>
        )}
        {/* Pattern cards  show immediately with examples */}
        {(explanation?.patterns || topic.patterns)?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {(explanation?.patterns || topic.patterns).map((p, pi) => {
              const patternWords = (p.pattern_en || "").split(" ").filter(w => w.length > 2);
              return (
                <div key={pi} style={{ marginBottom: 10, borderRadius: 10, border: "1.5px solid #6C5CE744", overflow: "hidden" }}>
                  {/* Pattern header */}
                  <div style={{ background: "rgba(155,89,182,0.1)", padding: "8px 14px", display: "flex", gap: 8, alignItems: "center",
                    outline: showTeacher && teacherCur === pi+1 ? "2.5px solid #7C6EE8" : "none",
                    borderRadius: showTeacher && teacherCur === pi+1 ? "10px 10px 0 0" : "0" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#6C5CE7", background: "rgba(155,89,182,0.2)", padding: "2px 8px", borderRadius: 20 }}>패턴 {pi+1}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#2D2B55" }}>{p.pattern_en}</span>
                    {showTeacher && teacherCur === pi+1 && <span style={{marginLeft:"auto",fontSize:16}}>👈</span>}
                  </div>
                  {/* Korean explanation */}
                  <div style={{ padding: "6px 14px 8px", fontSize: 13, color: "#5B5490", borderBottom: "1px solid #F8F8FC" }}>
                    {p.explain_ko}
                  </div>
                  {/* Examples  always shown */}
                  <div style={{ padding: "8px 14px" }}>
                    {(p.examples || []).map((ex, ei) => (
                      <div key={ei} style={{ marginBottom: ei < (p.examples.length-1) ? 8 : 0, paddingLeft: 8, borderLeft: "2.5px solid #6C5CE7" }}>
                        <div style={{ fontSize: 12, color: "#9490B8", marginBottom: 3 }}>{ex?.ko || ""}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button style={{ background: "#6C5CE7", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                            onClick={() => speakText(ex.en, 1.0)}>
                            <Volume2 size={10} color="#fff" />
                          </button>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#2D2B55" }}>{highlightGrammar(ex.en, patternWords)}</span>
                        </div>
                      </div>
                    ))}
                    {/* If no pre-written examples, use PatternExamplesLoader */}
                    {(!p.examples || p.examples.length === 0) && (
                      <PatternExamplesLoader p={p} topicLabel={topic.label_ko} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {explanation?.phases ? (
          <div className="mm-col" style={{ gap: 10, marginBottom: 16 }}>
            {explanation.phases.map((ph, pi) => {
              const PHASE_COLORS = { "초반": "#9B8EF5", "중반": "#B8ADFF", "후반": "#7C6EE8" };
              const color = PHASE_COLORS[ph.phase] || "#6C5CE7";
              const phRevealed = revealed >= lines.length + pi;
              return (
                <div key={pi} style={{ borderRadius: 12, border: `2px solid ${color}44`, overflow: "hidden" }}>
                  <div style={{ background: color + "18", padding: "8px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color, background: color + "30", padding: "2px 8px", borderRadius: 20 }}>{ph.phase}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#2D2B55" }}>{ph.label_ko}</span>
                  </div>
                  {(ph.pairs || []).map((p, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderBottom: i < ph.pairs.length - 1 ? "1px solid #F8F8FC" : "none" }}>
                      <ExplainExampleRow p={p} revealed={true} highlightWords={highlightWords} accentColor={color} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (explanation?.example_pairs && !(explanation?.patterns || topic.patterns)?.length) ? (
          <div className="mm-col" style={{ gap: 10, marginBottom: 16 }}>
            {explanation.example_pairs.map((p, i) => (
              <ExplainExampleRow key={i} p={p} revealed={true} highlightWords={highlightWords} />
            ))}
          </div>
        ) : null}
        <div className="mm-row" style={{ gap: 8 }}>
          {(!skipReveal && revealed < totalSteps - 1) ? (
            <button className="mm-btn-primary" onClick={revealNext}>다음 →</button>
          ) : (
            <button className="mm-btn-primary" onClick={onNext}>워크시트로 →</button>
          )}
        </div>
      </div>
    </div>
  );
}

function WorksheetStage({ topic, onNext }) {
  const PARTS = [
    { type: "find_errors", label: "Part 1 — 오류 찾기", desc: "6문제", color: "#7C6EE8", emoji: "🔍", count: 6 },
    { type: "fill_blank",  label: "Part 2 — 빈칸 채우기", desc: "4문제", color: "#B8ADFF", emoji: "📝", count: 4 },
    { type: "complete",    label: "Part 3 — 문장 완성", desc: "2문제", color: "#9B8EF5", emoji: "✍️", count: 2 },
  ];

  // Use pre-built worksheet from topic data if available, otherwise generate
  const prebuiltItems = (topic.worksheet || []).map((w, i) => ({
    type: w.type === "fill" ? "fill_blank" : w.type === "translate" ? "fill_blank" : "fill_blank",
    question: w.prompt,
    answer: w.answer,
    id: i
  }));

  const [quizItems, setQuizItems] = useState(prebuiltItems.length > 0 ? prebuiltItems : null);
  const [loading, setLoading] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);

  async function loadAndStart() {
    if (prebuiltItems.length > 0) {
      setQuizItems(prebuiltItems);
      setQuizIdx(0);
      return;
    }
    setLoading(true);
    try {
      const res = await askClaudeJSON(quizGenerateSystem(topic), "Generate 6 exercises now.", 2000);
      setQuizItems(res.exercises || []);
      setQuizIdx(0);
    } catch(e) { setQuizItems([]); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="mm-card"><Spinner label="워크시트 만드는 중이에요..." /></div>;

  if (!quizItems) return (
    <div className="mm-card">
      <div style={{ fontSize: 14, fontWeight: 700, color: "#7C6EE8", marginBottom: 14 }}>📝 워크시트</div>
      <div className="mm-col" style={{ gap: 10 }}>
        {PARTS.map((p) => (
          <button key={p.type}
            onClick={() => loadAndStart(p.type)}
            style={{ background: "#FFFFFF", border: "1.5px solid " + p.color + "44", borderRadius: 12,
              padding: "14px 16px", textAlign: "left", cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
              display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>{p.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, color: p.color, fontSize: 15 }}>{p.label}</div>
              <div style={{ fontSize: 13, color: "#5B5490", marginTop: 2 }}>{p.desc}</div>
            </div>
          </button>
        ))}
        <button className="mm-btn-ghost" style={{ marginTop: 6 }} onClick={() => loadAndStart(null)}>
          처음부터 전체 시작
        </button>
      </div>
    </div>
  );

  if (!quizItems.length) return <div className="mm-card"><button className="mm-btn-primary" onClick={() => loadAndStart(null)}>다시 만들기</button></div>;

  const ex = quizItems[quizIdx];
  if (!ex) return (
    <div className="mm-card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
      <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>완료!</p>
      <div className="mm-row" style={{ gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
        {PARTS.map(p => (
          <button key={p.type} className="mm-btn-ghost" style={{ fontSize: 13 }}
            onClick={() => { const i = quizItems.findIndex(e => e.type === p.type); if (i >= 0) setQuizIdx(i); }}>
            {p.emoji} {p.label.split("—")[1]?.trim()}
          </button>
        ))}
        <button className="mm-btn-primary" onClick={onNext}>인터뷰 →</button>
      </div>
    </div>
  );

  const partInfo = PARTS.find(p => p.type === ex.type) || PARTS[0];

  return (
    <QuizExercise
      key={quizIdx}
      ex={ex}
      quizIdx={quizIdx}
      quizTotal={quizItems.length}
      renderHeader={() => (
        <div className="mm-row mm-space-between" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: partInfo.color, background: partInfo.color + "18", padding: "3px 10px", borderRadius: 20 }}>
            {partInfo.emoji} {partInfo.label}
          </span>
          <span style={{ fontSize: 13, color: "#5B5490" }}>{quizIdx + 1} / {quizItems.length}</span>
        </div>
      )}
      onNext={() => {
        if (quizIdx + 1 >= quizItems.length) setQuizIdx(quizItems.length);
        else setQuizIdx(i => i + 1);
      }}
      topicLabel={topic.label_ko}
    />
  );
}



function lessonInterviewSystem(topic, interviewFocus) {
  return `You are a friendly English conversation coach interviewing a Korean adult learner.
Topic: "${topic.label_ko}"
Patterns learned: ${(topic.patterns||[]).map(p=>p.pattern_en).join(", ")}
${interviewFocus ? `Focus on: ${interviewFocus}` : ""}

RULES:
- Ask ONE question at a time in natural English
- After user answers, give brief encouraging feedback (1-2 sentences in Korean)
- Correct major grammar mistakes gently in Korean
- Then ask the NEXT question using patterns from the topic
- Ask 10 questions total, tracking count internally
- Questions should use the vocabulary and patterns from the lesson
- Keep questions relevant to real Korean adult life (here, parenting, shopping, work)
- After 10 questions, say "오늘 인터뷰 정말 잘하셨어요! 🎉" and give a brief summary in Korean

Ask your first question directly. No introduction or greeting.`;
}


function ScaffoldingHints({ topic, lastQ, onSelect }) {
  const [hints, setHints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setHints(null);
    setOpen(false);
    setLoading(true);
    let cancelled = false;
    async function load() {
      try {
        const res = await askClaudeJSON(
          `You are helping a Korean learner answer an English interview question.
Provide scaffolding in THREE categories:
1. "starters": 3 short conversation starter phrases (under 6 words each)
2. "expressions": 2-3 relevant expressions from today's topic that fit this answer
3. "useful": 3 useful collocations or phrases that would help answer this specific question naturally

Return ONLY JSON:
{"starters":["Yes, I do because...","To be honest,...","Actually, I..."],"expressions":["topic expression 1","topic expression 2"],"useful":["after a long day","I tend to...","It depends on..."]}`,
          `Topic: ${topic.label_ko}
Today's expressions: ${(topic.expressions || topic.vocab || []).slice(0,5).map(e=>e.en||e).join(", ")}
Question: ${lastQ.slice(0,200)}`
        );
        if (!cancelled && (res?.starters || res?.expressions)) setHints(res);
      } catch(e) {}
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [lastQ]);

  const starterList = Array.isArray(hints) ? hints : (hints?.starters || []);
  const exprList = Array.isArray(hints) ? [] : (hints?.expressions || []);
  const usefulList = Array.isArray(hints) ? [] : (hints?.useful || hints?.expand || []);
  const hasHints = starterList.length > 0 || exprList.length > 0 || usefulList.length > 0;
  if (loading) return (
    <div style={{padding:"8px 14px",fontSize:12,color:"#9490B8",marginBottom:8}}>
      💡 힌트 불러오는 중...
    </div>
  );
  if (!hasHints) return (
    <div style={{padding:"8px 14px",fontSize:12,color:"#C4BEFF",marginBottom:8}}>
      💡 힌트를 준비하지 못했어요
    </div>
  );

  return (
    <div style={{marginBottom:8}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",background:"#F8F7FF",border:"1.5px solid #EDE9FF",
          borderRadius:12,padding:"8px 14px",fontSize:12,color:"#7C6EE8",fontWeight:700,
          cursor:"pointer",textAlign:"left",fontFamily:"'Nunito',sans-serif",
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>💡 이렇게 말해봐요</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{background:"#F8F7FF",borderRadius:"0 0 12px 12px",
          padding:"8px 12px",border:"1.5px solid #EDE9FF",borderTop:"none"}}>
              {starterList.length > 0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:800,color:"#9490B8",marginBottom:4}}>시작 표현</div>
              {starterList.map((h,i) => (
                <button key={i} onClick={() => { onSelect(h); setOpen(false); }}
                  style={{display:"block",width:"100%",textAlign:"left",
                    background:"none",border:"none",padding:"5px 4px",
                    fontSize:13,color:"#2D2B55",cursor:"pointer",fontWeight:600,
                    fontFamily:"'Nunito',sans-serif"}}>
                  • {h}
                </button>
              ))}
            </div>
          )}
          {exprList.length > 0 && (
            <div style={{marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:800,color:"#7C6EE8",marginBottom:4}}>오늘 배운 표현</div>
              {exprList.map((h,i) => (
                <button key={i} onClick={() => { onSelect(h); setOpen(false); }}
                  style={{display:"block",width:"100%",textAlign:"left",
                    background:"#EDE9FF",border:"none",padding:"5px 8px",
                    fontSize:13,color:"#7C6EE8",cursor:"pointer",fontWeight:700,
                    borderRadius:8,marginBottom:4,
                    fontFamily:"'Nunito',sans-serif"}}>
                  • {h}
                </button>
              ))}
            </div>
          )}
          {(hints?.useful || []).length > 0 && (
            <div>
              <div style={{fontSize:10,fontWeight:800,color:"#06D6A0",marginBottom:4}}>💬 같이 쓰면 좋은 표현</div>
              {(hints?.useful || []).map((h,i) => (
                <button key={i} onClick={() => { onSelect(h); setOpen(false); }}
                  style={{display:"block",width:"100%",textAlign:"left",
                    background:"#E8FFF9",border:"none",padding:"5px 8px",
                    fontSize:13,color:"#06D6A0",cursor:"pointer",fontWeight:700,
                    borderRadius:8,marginBottom:4,
                    fontFamily:"'Nunito',sans-serif"}}>
                  • {h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model answer hint */}
      <ModelAnswerHint topic={topic} lastQ={lastQ} />
    </div>
  );
}


function ModelAnswerHint({ topic, lastQ }) {
  const [shown, setShown] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

    const [activeType, setActiveType] = useState("simple");

  async function loadAnswer() {
    if (answer) { setShown(s => !s); return; }
    setLoading(true);
    setShown(true);
    try {
      const res = await askClaudeJSON(
        `You are an English coach. Write 3 model answers for a Korean learner at different levels.
Return ONLY JSON:
{
  "simple": {"en":"1-2 sentence short practical answer","ko":"한국어 번역"},
  "native": {"en":"2-3 sentence natural native-sounding answer with real expressions","ko":"한국어 번역"},
  "advanced": {"en":"3-4 sentence OPIC-style sophisticated answer","ko":"한국어 번역"}
}
Use today's topic expressions naturally. Keep simple answer SHORT (max 15 words).`,
        `Topic: ${topic.label_ko}
Expressions: ${(topic.expressions || topic.vocab || []).slice(0,4).map(e=>e.en||e).join(", ")}
Question: ${lastQ.slice(0,300)}`
      );
      if (res?.simple) setAnswer(res);
    } catch(e) {}
    setLoading(false);
  }

  const types = [
    {id:"simple", label:"단답형", color:"#06D6A0"},
    {id:"native", label:"Native형", color:"#7C6EE8"},
    {id:"advanced", label:"고급형", color:"#EF233C"},
  ];

  return (
    <div style={{marginTop:8}}>
      <button onClick={loadAnswer}
        style={{width:"100%",background:"none",border:"1.5px dashed #C4BEFF",
          borderRadius:12,padding:"8px 14px",fontSize:12,color:"#9490B8",
          cursor:"pointer",fontFamily:"'Nunito',sans-serif",textAlign:"left"}}>
        💬 힌트 — 모범 답변 보기
      </button>
      {shown && (
        <div style={{marginTop:6,background:"#F8F7FF",borderRadius:12,border:"1.5px solid #EDE9FF",overflow:"hidden"}}>
          {loading ? (
            <div style={{padding:"12px 14px",fontSize:12,color:"#9490B8"}}>답변 생성 중...</div>
          ) : answer ? (
            <div>
              {/* Type selector */}
              <div style={{display:"flex",borderBottom:"1px solid #EDE9FF"}}>
                {types.map(t => (
                  <button key={t.id} onClick={() => setActiveType(t.id)}
                    style={{flex:1,padding:"8px 4px",border:"none",cursor:"pointer",
                      fontSize:11,fontWeight:800,fontFamily:"'Nunito',sans-serif",
                      background:activeType===t.id?t.color+"15":"transparent",
                      color:activeType===t.id?t.color:"#9490B8",
                      borderBottom:activeType===t.id?`2px solid ${t.color}`:"2px solid transparent"}}>
                    {t.label}
                  </button>
                ))}
              </div>
              {/* Answer */}
              {answer[activeType] && (
                <div style={{padding:"12px 14px"}}>
                  <div style={{fontSize:13,color:"#2D2B55",fontWeight:700,lineHeight:1.8,marginBottom:8}}>
                    "{answer[activeType].en}"
                  </div>
                  <div style={{fontSize:11,color:"#9490B8",lineHeight:1.6,marginBottom:8}}>
                    {answer[activeType].ko}
                  </div>
                  <button onClick={() => speakText(answer[activeType].en, 0.9)}
                    style={{fontSize:20,background:"none",border:"none",cursor:"pointer"}}>
                    🔊
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}


function InterviewStage({ topic, explanation, goTo, onNext }) {
  const [ready, setReady] = useState(false); // warm-up screen first
  const [warmupSentences, setWarmupSentences] = useState([]);
  const [loadingWarmup, setLoadingWarmup] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const micRef = useRef(null);
  const inputRef = useRef("");
  const scrollRef = useRef(null);
  const SpeechRec = getSpeechRecognition();
  const interviewFocus = TEACHER_EXPLANATIONS?.[topic.id]?.interview_focus;

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  // Generate 3 sentences the OTHER person would say in this situation
  useEffect(() => {
    async function loadWarmup() {
      try {
        const res = await askClaudeJSON(
          `You are generating 3 short English sentences that the OTHER PERSON (staff, receptionist, waiter, etc.) would say to a Korean learner in this situation. NOT what the learner says.
Return ONLY valid JSON: {"sentences":["sentence1","sentence2","sentence3"]}
Keep each sentence short and natural (5-10 words).`,
          `Situation: ${topic.context_en || topic.label_ko}. Topic: ${topic.label_ko}`
        );
        setWarmupSentences(res.sentences || []);
      } catch(e) {
        setWarmupSentences([]);
      }
      setLoadingWarmup(false);
    }
    loadWarmup();
  }, []);

  async function startInterview() {
    setReady(true);
    setLoading(true);
    try {
      const reply = await askClaudeText(
        lessonInterviewSystem(topic, interviewFocus),
        [{ role: "user", content: "Start the interview now." }]
      );
      setMessages([{ role: "ai", text: reply, drillState: 0 }]);
      await speakText(cleanForSpeech(reply), 1.1);
    } catch(e) {} finally { setLoading(false); }
  }

  // Warm-up screen
  if (!ready) return (
    <div className="mm-card">
      <div style={{fontSize:13,fontWeight:800,color:"#7C6EE8",marginBottom:12}}>
        🎧 이런 말이 들릴 거예요
      </div>
      {loadingWarmup ? (
        <div style={{color:"#9490B8",fontSize:12}}>불러오는 중...</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          {warmupSentences.map((s,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,
              padding:"8px 12px",background:"#F8F7FF",borderRadius:12}}>
              <span style={{fontSize:13,color:"#2D2B55",flex:1,fontWeight:600}}>{s}</span>
              <button onClick={() => speakText(s, 0.9)}
                style={{fontSize:20,background:"none",border:"none",cursor:"pointer",
                  flexShrink:0,padding:"2px 4px"}}>
                🔊
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Essential expressions */}
      {(() => {
        const exprs = topic.expressions?.length > 0 
          ? topic.expressions 
          : (topic.vocab || []).map(v => ({en: v.en, ko: v.ko}));
        if (!exprs.length) return null;
        return (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:800,color:"#9490B8",marginBottom:8}}>
            이렇게 시작해봐요
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {exprs.slice(0,4).map((e,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                padding:"6px 12px",background:"#EDE9FF",borderRadius:10}}>
                <span style={{fontSize:12,color:"#7C6EE8",flex:1,fontWeight:700}}>
                  • {e.en}
                </span>
                <button onClick={() => speakText(e.en, 0.9)}
                  style={{fontSize:16,background:"none",border:"none",cursor:"pointer",flexShrink:0}}>
                  🔊
                </button>
              </div>
            ))}
          </div>
        </div>
        );
      })()}

      <button className="mm-btn-primary" style={{width:"100%"}} onClick={startInterview}>
        준비됐어요! 🎤 인터뷰 시작
      </button>
    </div>
  );

  function stopMic() { if (micRef.current) try { micRef.current.stop(); } catch(e) {} setMicOn(false); }
  function toggleMic() {
    if (micOn) { stopMic(); return; }
    setInput(""); inputRef.current = "";
    const r = startRecognition(t => { setInput(t); inputRef.current = t; }, () => setMicOn(false));
    if (r) { micRef.current = r; setMicOn(true); }
  }

  async function send() {
    const text = (input || inputRef.current).trim();
    if (!text || loading) return;
    stopMic();
    const newMsgs = [...messages, { role: "user", text }];
    setMessages(newMsgs); setInput(""); inputRef.current = ""; setLoading(true);
    try {
      const apiMsgs = newMsgs.map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
      const reply = await askClaudeText(lessonInterviewSystem(topic, interviewFocus), apiMsgs);
      setMessages([...newMsgs, { role: "ai", text: reply, drillState: 0 }]);
      await speakText(cleanForSpeech(reply), 1.1);
    } catch(e) {} finally { setLoading(false); }
  }

  // Update drillState for a specific message index
  function setDrillState(msgIdx, state) {
    setMessages(prev => prev.map((m, i) => i === msgIdx ? { ...m, drillState: state } : m));
  }

  return (
    <div className="mm-card" style={{ display: "flex", flexDirection: "column", minHeight: 500 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#7C6EE8", marginBottom: 4 }}>🎤 인터뷰</div>
      <div style={{ fontSize: 12, color: "#5B5490", marginBottom: 10 }}>영어로 대답해요. 안들리면 버튼을 눌러요.</div>

      <div ref={scrollRef} className="mm-chat-scroll" style={{ flex: 1 }}>
        {messages.map((m, mi) => (
          <div key={mi} className={m.role === "ai" ? "mm-bubble-ai" : "mm-bubble-user"}>
            {m.role === "ai"
              ? <AIBubbleWithDrill text={m.text} drillState={m.drillState || 0} onDrillState={s => setDrillState(mi, s)} />
              : m.text
            }
          </div>
        ))}
        {loading && <div className="mm-bubble-ai" style={{ color: "#B8B4D8" }}>...</div>}
      </div>

      {micOn && input && (
        <div style={{ background: "#F8F8FC", borderRadius: 8, padding: "8px 12px", margin: "8px 0", fontSize: 14 }}>
          🎤 "{input}"
        </div>
      )}

      {/* Scaffolding hints */}
      {messages.length > 0 && messages[messages.length-1]?.role === "ai" && !loading && (
        <ScaffoldingHints topic={topic} lastQ={messages[messages.length-1]?.text || ""} onSelect={t => setInput(t)} />
      )}

      <div className="mm-row" style={{ gap: 8, marginTop: 8 }}>
        {SpeechRec && (
          <button onClick={toggleMic}
            style={{ width: 48, height: 48, borderRadius: "50%", border: "none", cursor: "pointer",
              background: micOn ? "#7C6EE8" : "#2D2B55", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {micOn ? <MicOff size={20} color="#fff" /> : <Mic size={20} color="#fff" />}
          </button>
        )}
        <input className="mm-input" value={input}
          onChange={e => { setInput(e.target.value); inputRef.current = e.target.value; }}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="영어로 답해보세요..." />
        <button className="mm-btn-primary" onClick={send} disabled={loading || (!input.trim() && !inputRef.current.trim())}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

// AI bubble with 2-stage drill: 1st = fill-blank, 2nd = colour annotation + practice
function AIBubbleWithDrill({ text, drillState, onDrillState }) {
  const cleaned = cleanForSpeech(text);
  // Split into sentences for drilling
  const sentences = cleaned.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(s => s.length > 8 && /[a-zA-Z]/.test(s));
  const playList = sentences.length > 0 ? sentences : [cleaned];

  // Stage 0: just listen buttons
  // Stage 1: heard → show 안들려요
  // Stage 2: fill-blank
  // Stage 3: colour annotation + practice

  function play(speed) {
    window.speechSynthesis && window.speechSynthesis.cancel();
    speakText(cleaned, speed || 1.05);
    onDrillState(Math.max(drillState, 1));
  }

  return (
    <div>
      {/* Always show text ONLY after stage 3 (full reveal) */}
      {drillState >= 3 && (
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.6 }}>{text}</div>
      )}

      {/* Stage 0 & 1: audio controls */}
      {drillState < 2 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="mm-btn-ghost" style={{ fontSize: 12 }} onClick={() => play(1.05)}>🔊 듣기</button>
          {drillState >= 1 && <button className="mm-btn-ghost" style={{ fontSize: 12 }} onClick={() => play(0.75)}>🐢 천천히</button>}
          {drillState >= 1 && (
            <button style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "1.5px solid #7C6EE8",
              background: "transparent", color: "#7C6EE8", cursor: "pointer", fontFamily: "'Nunito','Noto Sans KR',sans-serif" }}
              onClick={() => onDrillState(2)}>
              안들려요 →
            </button>
          )}
        </div>
      )}

      {/* Stage 2: fill-in-blank */}
      {drillState === 2 && (
        <FillBlankDrill sentence={cleaned} onNext={() => onDrillState(3)}
          onListen={() => play(0.78)} />
      )}

      {/* Stage 3: colour annotation */}
      {drillState >= 3 && (
        <div style={{ marginTop: 6 }}>
          {playList.map((s, i) => <ColourAnnotationDrill key={i} sentence={s} />)}
          <button className="mm-btn-ghost" style={{ fontSize: 11, marginTop: 4 }}
            onClick={() => onDrillState(1)}>접기 ▲</button>
        </div>
      )}
    </div>
  );
}

// Stage 2: blank-fill with multiple choice (no typing)
function FillBlankDrill({ sentence, onNext, onListen }) {
  const words = sentence.replace(/[.?!]$/, "").split(" ");
  // Pick ONE key content word (4+ chars) as the blank
  const blankIdx = words.findIndex((w, i) => i > 0 && w.replace(/[^a-zA-Z]/g,"").length >= 4);
  const blankWord = blankIdx >= 0 ? words[blankIdx].replace(/[^a-zA-Z']/g,"") : "";

  // Generate plausible wrong options from other words in sentence + common fillers
  const otherWords = words.filter((w,i) => i !== blankIdx && w.replace(/[^a-zA-Z]/g,"").length >= 3)
    .map(w => w.replace(/[^a-zA-Z']/g,"")).filter(Boolean);
  const fillers = ["really","always","never","going","trying","doing","making"];
  const wrongPool = [...new Set([...otherWords, ...fillers])].filter(w => w.toLowerCase() !== blankWord.toLowerCase());
  const wrong1 = wrongPool[0] || "something";
  const wrong2 = wrongPool[1] || "anything";
  const options = [blankWord, wrong1, wrong2].sort(() => Math.random() - 0.5);

  const [chosen, setChosen] = useState(null);
  const [checked, setChecked] = useState(false);

  if (blankIdx < 0) {
    // No suitable blank word — skip to next stage
    return (
      <div style={{ background: "#0E1628", borderRadius: 10, padding: "12px 14px", marginTop: 6 }}>
        <div style={{ fontSize: 11, color: "#B8ADFF", fontWeight: 700, marginBottom: 8 }}>1차 안들려요</div>
        <div style={{ fontSize: 14, color: "#FFFFFF", marginBottom: 10 }}>{sentence}</div>
        <button className="mm-btn-ghost" style={{ fontSize: 11 }} onClick={onListen}>🔊 다시 듣기</button>
        <button style={{ fontSize: 12, padding: "7px 14px", borderRadius: 10, border: "2px solid #7C6EE8",
          background: "transparent", color: "#7C6EE8", cursor: "pointer", fontFamily: "'Nunito','Noto Sans KR',sans-serif", fontWeight: 700, marginLeft: 8 }}
          onClick={onNext}>왜 안들리지? →</button>
      </div>
    );
  }

  const isRight = checked && chosen === blankWord;
  const isWrong = checked && chosen && chosen !== blankWord;

  return (
    <div style={{ background: "#0E1628", borderRadius: 10, padding: "12px 14px", marginTop: 6 }}>
      <div style={{ fontSize: 11, color: "#B8ADFF", fontWeight: 700, marginBottom: 8 }}>1차 안들려요 — 빈칸에 맞는 단어를 골라요</div>
      <button className="mm-btn-ghost" style={{ fontSize: 11, marginBottom: 10 }} onClick={onListen}>🔊 다시 듣기</button>

      {/* Sentence with blank */}
      <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", lineHeight: 2, marginBottom: 14 }}>
        {words.map((w, i) => {
          if (i !== blankIdx) return <span key={i}>{w} </span>;
          return (
            <span key={i} style={{ display: "inline-block", minWidth: 80, padding: "2px 10px", margin: "0 3px",
              borderRadius: 8, border: "2px solid " + (isRight?"#9B8EF5":isWrong?"#7C6EE8":"#B8ADFF"),
              background: isRight?"#E8F8F4":isWrong?"#FFF0EB":"rgba(242,183,5,0.15)",
              color: isRight?"#1E8E78":isWrong?"#B23A3A":"#B8ADFF",
              fontWeight: 900, textAlign: "center" }}>
              {checked ? (chosen || "___") : (chosen || "___")}
            </span>
          );
        })}
      </div>

      {/* Multiple choice options */}
      {!checked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {options.map((opt, i) => (
            <button key={i}
              onClick={() => { setChosen(opt); setChecked(true); if (opt === blankWord) speakText(sentence, 1.0); }}
              style={{ padding: "10px 14px", borderRadius: 10, textAlign: "left", fontSize: 15, fontWeight: 700,
                border: "2px solid #C4BEFF", background: "#2D2B55", color: "#FFFFFF",
                cursor: "pointer", fontFamily: "'Nunito','Noto Sans KR',sans-serif" }}>
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* After choosing */}
      {checked && (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {options.map((opt, i) => {
              const isC = opt === blankWord;
              const isW = opt === chosen && !isC;
              return (
                <div key={i} style={{ padding: "10px 14px", borderRadius: 10, fontSize: 15, fontWeight: 700,
                  border: "2px solid " + (isC?"#9B8EF5":isW?"#7C6EE8":"#333"),
                  background: isC?"#1E8E7820":isW?"#B23A3A20":"#111",
                  color: isC?"#9B8EF5":isW?"#7C6EE8":"#555" }}>
                  {isC ? "✓ " : isW ? "✗ " : ""}{opt}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: "#8C9AB8", marginBottom: 10 }}>
            {isRight ? "✓ 맞아요!" : `정답: ${blankWord}`}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn-ghost" style={{ fontSize: 11 }} onClick={onListen}>🔊 다시 듣기</button>
            <button style={{ flex: 1, fontSize: 12, padding: "7px 14px", borderRadius: 10, border: "2px solid #7C6EE8",
              background: "transparent", color: "#7C6EE8", cursor: "pointer", fontFamily: "'Nunito','Noto Sans KR',sans-serif", fontWeight: 700 }}
              onClick={onNext}>
              왜 안들리지? →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Stage 3: colour annotation + pronunciation/liaison/pattern practice

function ExampleToggle({ word, example_en, example_ko, color }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{marginTop:4}}>
      <button onClick={() => setShow(s => !s)}
        style={{fontSize:11,background:"transparent",border:"1px solid "+color+"66",
          borderRadius:20,padding:"2px 8px",color,cursor:"pointer",
          fontFamily:"'Nunito',sans-serif",fontWeight:700}}>
        {show ? "예문 닫기 ▲" : "예문 보기 ▼"}
      </button>
      {show && (
        <div style={{marginTop:6,padding:"6px 10px",background:"rgba(255,255,255,0.06)",
          borderRadius:8,borderLeft:"2px solid "+color}}>
          <div style={{fontSize:12,color:"#FFFFFF",fontWeight:700,marginBottom:2}}>{example_en}</div>
          {example_ko && <div style={{fontSize:11,color:"#B8B4D8"}}>{example_ko}</div>}
          <button onClick={() => speakText(example_en, 0.85)}
            style={{marginTop:4,fontSize:10,background:"transparent",border:"none",
              color,cursor:"pointer",padding:0,fontFamily:"'Nunito',sans-serif"}}>
            🔊 듣기
          </button>
        </div>
      )}
    </div>
  );
}


function SaveButton({ en, ko, type, source }) {
  const [saved, setSaved] = useState(false);
  function handleSave() {
    try {
      const key = "saved_words";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      const item = { en, ko, type: type||"expression", source: source||"", savedAt: Date.now() };
      const deduped = existing.filter(e => e.en !== en);
      deduped.unshift(item);
      localStorage.setItem(key, JSON.stringify(deduped.slice(0,200)));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) {}
  }
  return (
    <button onClick={handleSave}
      style={{background:"none",border:"none",cursor:"pointer",fontSize:18,
        color:saved?"#FF6B9D":"#C4BEFF",transition:"color 0.2s"}}>
      {saved ? "❤️" : "🤍"}
    </button>
  );
}


function GrammarSaveButton({ sentence, annotation }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem("saved_grammar") || "[]");
      setSaved(list.some(s => s.sentence === sentence));
    } catch(e) {}
  }, [sentence]);

  function toggle() {
    try {
      const list = JSON.parse(localStorage.getItem("saved_grammar") || "[]");
      if (saved) {
        const updated = list.filter(s => s.sentence !== sentence);
        localStorage.setItem("saved_grammar", JSON.stringify(updated));
        setSaved(false);
      } else {
        const entry = {
          sentence,
          grammar_note: annotation.grammar_note,
          usage_note: annotation.usage_note || "",
          savedAt: new Date().toLocaleDateString("ko-KR")
        };
        list.unshift(entry);
        localStorage.setItem("saved_grammar", JSON.stringify(list.slice(0,100)));
        setSaved(true);
      }
    } catch(e) {}
  }

  return (
    <button onClick={toggle}
      style={{flexShrink:0,padding:"4px 10px",borderRadius:20,
        border:"1.5px solid "+(saved?"#EF233C":"#6C5CE7"),
        background:saved?"#FFF0F0":"transparent",
        color:saved?"#EF233C":"#6C5CE7",
        fontSize:11,fontWeight:800,cursor:"pointer",
        fontFamily:"'Nunito',sans-serif",whiteSpace:"nowrap"}}>
      {saved ? "❤️ 저장됨" : "🤍 저장"}
    </button>
  );
}


function ColourAnnotationDrill({ sentence }) {
  const [annotation, setAnnotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [practiceItem, setPracticeItem] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const micRef = useRef(null);
  const SpeechRec = getSpeechRecognition();

  useEffect(() => {
    if (sentence) {
      // Start loading immediately when component mounts
      loadAnnotation();
    }
  }, [sentence]);

  async function loadAnnotation() {
    setLoading(true);
    try {
      const system = `You are an English listening coach for Korean learners. Analyse why a sentence is hard to hear AND explain the grammar.
Output ONLY this exact JSON (no markdown):
{"ko":"Korean translation","words":[{"word":"meaningful chunk","ko_meaning":"한국어 뜻","sounds_like":"fast pronunciation or empty","detail_ko":"뜻+발음 설명","example_en":"different example sentence","example_ko":"한국어 번역"}],"grammar_note":"문법 설명 in Korean","tip_ko":"핵심 포인트"}
Rules: 2-3 chunks, group words meaningfully, always include ko_meaning and example_en, grammar_note in Korean`;

      const parsed = await askClaudeJSON(system, `Analyse: "${sentence}"`, 1000);
      if (parsed?.words?.length) {
        setAnnotation(parsed);
        setLoading(false);
        return;
      }
      throw new Error("Parse failed");
    } catch(e) {
      try {
        const parsed2 = await askClaudeJSON(
          `Return ONLY valid JSON. Analyse English sentence for Korean learners.`,
          `{"ko":"translation","words":[{"word":"chunk","ko_meaning":"뜻","sounds_like":"","detail_ko":"설명","example_en":"example","example_ko":"번역"}],"grammar_note":"문법","tip_ko":"포인트"}
Sentence: "${sentence}" — Return JSON only with 2-3 words.`
        );
        if (parsed2?.words?.length) {
          setAnnotation(parsed2);
          setLoading(false);
          return;
        }
      } catch(e2) {}

      // Final fallback
      const ws = sentence.split(" ").filter(w => w.replace(/[^a-zA-Z]/g,"").length > 2);
      setAnnotation({
        ko: "",
        words: ws.slice(0, 3).map((w, i) => ({
          word: w.replace(/[^a-zA-Z']/g,""),
          type: i === 0 ? "liaison" : i === 1 ? "expression" : "grammar",
          ko_meaning: "핵심 표현",
          detail_ko: "빠르게 말할 때 앞뒤 단어와 연음돼서 다르게 들릴 수 있어요.",
          sounds_like: "",
          example_en: "",
          example_ko: ""
        })),
        grammar_note: "다시 시도 버튼을 눌러보세요.",
        usage_note: null
      });
    }
    finally { setLoading(false); }
  }

  const TYPE_COLORS = { verb:"#9B8EF5", noun:"#A78BFA", expression:"#7C6EE8", grammar:"#6C5CE7", liaison:"#B8ADFF", adjective:"#E67E22", adverb:"#1ABC9C" };
  const TYPE_LABELS = { verb:"동사", noun:"명사", expression:"표현", grammar:"문법", liaison:"🔗연음", adjective:"형용사", adverb:"부사" };

  function toggleMic() {
    if (micOn) { if (micRef.current) try { micRef.current.stop(); } catch(e) {} setMicOn(false); return; }
    const r = startRecognition(() => {}, () => setMicOn(false));
    if (r) { micRef.current = r; setMicOn(true); }
  }

  if (loading) return (
    <div style={{ padding: 16, color: "#9490B8", fontSize: 13, textAlign:"center" }}>
      <div style={{fontSize:24,marginBottom:8}}>🔍</div>
      분석 중...
    </div>
  );

  if (!annotation || !annotation.words?.length) return (
    <div style={{ padding: 12, textAlign:"center" }}>
      <div style={{fontSize:13,color:"#9490B8",marginBottom:8}}>분석을 불러오지 못했어요</div>
      <button onClick={loadAnnotation} className="mm-btn-ghost" style={{fontSize:12}}>🔄 다시 시도</button>
    </div>
  );

  return (
    <div style={{ background: "#F8F7FF", borderRadius: 16, padding: "14px", marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: "#7C6EE8", fontWeight: 800, marginBottom: 10 }}>🔍 왜 안들려?</div>

      {/* Korean translation */}
      {annotation?.ko && (
        <div style={{ fontSize: 13, color: "#2D2B55", marginBottom:10, fontWeight:700 }}>
          {annotation.ko}
        </div>
      )}



      {/* Chunks */}
      {annotation?.words?.map((w, i) => (
        <div key={i} style={{ marginBottom:10, borderRadius:12, background:"#fff",
          border:"1.5px solid #EDE9FF", padding:"10px 12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <span style={{ fontSize:15, fontWeight:900, color:"#2D2B55" }}>{w.word}</span>
            {w.sounds_like && (
              <span style={{ fontSize:11, fontWeight:800, color:"#7C6EE8",
                background:"#EDE9FF", padding:"2px 8px", borderRadius:20 }}>
                → "{w.sounds_like}"
              </span>
            )}
            <button onClick={() => speakText(w.word, 0.75)}
              style={{ marginLeft:"auto", fontSize:18, background:"none", border:"none", cursor:"pointer" }}>
              🔊
            </button>
          </div>
          {w.ko_meaning && (
            <div style={{ fontSize:13, fontWeight:800, color:"#7C6EE8", marginBottom:4 }}>
              {w.ko_meaning}
            </div>
          )}
          {w.detail_ko && (
            <div style={{ fontSize:12, color:"#9490B8", lineHeight:1.6 }}>{w.detail_ko}</div>
          )}
          {w.example_en && (
            <div style={{marginTop:8,background:"#F0EEFF",borderRadius:8,padding:"6px 10px"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#2D2B55"}}>{w.example_en}</div>
              {w.example_ko && <div style={{fontSize:11,color:"#9490B8",marginTop:2}}>{w.example_ko}</div>}
              <button onClick={e=>{e.stopPropagation();speakText(w.example_en,0.9);}}
                style={{fontSize:16,background:"none",border:"none",cursor:"pointer",marginTop:4}}>🔊</button>
            </div>
          )}
        </div>
      ))}

      {/* Grammar note */}
      {annotation?.grammar_note && (
        <div style={{ padding:"10px 12px", background:"#2D2B55", borderRadius:12,
          fontSize:12, color:"#fff", marginBottom:8 }}>
          <div style={{fontWeight:800, color:"#B8ADFF", marginBottom:4}}>📐 문법</div>
          <div style={{lineHeight:1.6}}>{annotation.grammar_note}</div>
        </div>
      )}

      {/* Tip */}
      {annotation?.tip_ko && (
        <div style={{ padding:"8px 12px", background:"#7C6EE8", borderRadius:10,
          fontSize:12, color:"#fff", fontWeight:700, marginBottom:10 }}>
          💡 {annotation.tip_ko}
        </div>
      )}

      {/* Practice section */}
      <div style={{marginTop:12,padding:"12px",background:"#F8F7FF",borderRadius:12}}>
        <div style={{fontSize:11,color:"#9490B8",fontWeight:700,marginBottom:10}}>
          이제 분석 보셨으면 → 따라 말해봐요!
        </div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button className="mm-btn-ghost" style={{fontSize:12}} onClick={() => speakText(sentence, 1.0)}>
            🔊 다시 듣기
          </button>
          <SlowSpeedToggle onPlay={(speed) => speakText(sentence, speed)} />
        </div>
        {SpeechRec && (
          <button className={"mm-btn-primary " + (micOn ? "" : "")}
            style={{width:"100%",fontSize:14,padding:"12px"}}
            onClick={toggleMic}>
            {micOn ? <><MicOff size={14}/> 그만하기</> : <><Mic size={14}/> 🎤 따라 말해봐요</>}
          </button>
        )}
        {micOn && (
          <div style={{fontSize:12,color:"#7C6EE8",textAlign:"center",marginTop:8,fontWeight:700}}>
            🔴 듣고 있어요... 문장 전체를 말해보세요!
          </div>
        )}
      </div>

      {/* Similar sentences listening practice */}
      <SimilarSentencesDrill sentence={sentence} annotation={annotation} />
    </div>
  );
}

// Loads and plays similar sentences for extra listening practice
function SimilarSentencesDrill({ sentence, annotation }) {
  const [sentences, setSentences] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(null);
  const [drillStates, setDrillStates] = useState({});
  const [micStates, setMicStates] = useState({});
  const micRefs = useRef({});
  const SpeechRec = getSpeechRecognition();

  async function load() {
    setLoading(true);
    const liaisons = annotation?.words?.filter(w => w.type === "liaison").map(w => w.word).join(", ");
    const expressions = annotation?.words?.filter(w => w.type === "expression").map(w => w.word).join(", ");
    try {
      const res = await askClaudeJSON(
        `Generate 4 English sentences that are STRUCTURALLY similar to the example sentence. Change only 1-2 words (nouns, verbs, or adjectives). Keep the same grammar pattern and sentence length.

Example: "Do you like it?" → "Do you want it?" / "Did you like it?" / "Do you need it?" / "Do you love it?"
Example: "I am so tired today." → "I am so hungry today." / "I am so busy today." / "She is so tired today." / "I am very tired now."

Return ONLY valid JSON:
{"sentences":[{"en":"similar sentence","ko":"한국어번역"},{"en":"...","ko":"..."},{"en":"...","ko":"..."},{"en":"...","ko":"..."}]}`,
        `Original sentence: "${sentence}"`
      );
      setSentences(res.sentences || []);
    } catch(e) { setSentences([]); }
    finally { setLoading(false); }
  }

  async function playSentence(idx, speed) {
    if (!sentences?.[idx]) return;
    setPlayingIdx(idx);
    await speakText(sentences[idx].en, speed || 1.0);
    setPlayingIdx(null);
  }

  if (!sentences && !loading) {
    return (
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
        <button style={{ fontSize: 13, padding: "10px 18px", borderRadius: 12,
          border: "2px solid #7C6EE8", background: "#7C6EE8",
          color: "#fff", cursor: "pointer",
          fontFamily: "'Nunito','Noto Sans KR',sans-serif", fontWeight: 800,
          width: "100%", marginTop: 4 }}
          onClick={load}>
          🎧 비슷한 문장 더 들어보기
        </button>
      </div>
    );
  }

  if (loading) return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)", fontSize: 12, color: "#9490B8" }}>
      <Loader2 className="animate-spin" size={12} style={{ display: "inline" }} /> 비슷한 문장 준비 중...
    </div>
  );

  function toggleMic(idx, targetSentence) {
    const cur = micStates[idx] || {};
    if (cur.on) {
      if (micRefs.current[idx]) try { micRefs.current[idx].stop(); } catch(e) {}
      setMicStates(prev => ({...prev, [idx]: {...prev[idx], on: false}}));
      return;
    }
    setMicStates(prev => ({...prev, [idx]: {on: true, transcript: "", score: null}}));

    function startMic() {
      const r = startRecognition(
        t => setMicStates(prev => ({...prev, [idx]: {...prev[idx], transcript: t}})),
        () => {
          setMicStates(prev => {
            const tr = prev[idx]?.transcript || "";
            const words = targetSentence.toLowerCase().replace(/[^a-z]/g," ").split(" ").filter(Boolean);
            const said = tr.toLowerCase().replace(/[^a-z]/g," ").split(" ").filter(Boolean);
            const score = words.length ? Math.round(said.filter(w => words.includes(w)).length / words.length * 100) : 0;
            return {...prev, [idx]: {...prev[idx], on: false, score}};
          });
        }
      );
      if (r) micRefs.current[idx] = r;
      else setMicStates(prev => ({...prev, [idx]: {...prev[idx], on: false}}));
    }

    // Request mic permission first
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => startMic())
        .catch(() => setMicStates(prev => ({...prev, [idx]: {on: false, transcript: "마이크 권한이 필요해요", score: null}})));
    } else {
      startMic();
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", marginBottom: 8 }}>🎧 비슷한 문장 리스닝 + 따라말하기</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sentences.map((s, i) => {
          const ds = drillStates[i] || 0;
          const mic = micStates[i] || {};
          return (
            <div key={i} style={{ background: "#0A1020", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: "#9490B8" }}>문장 {i+1}</div>
                {/* Speed buttons + mic */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => speakText(s.en, 1.0)}
                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, border: "1px solid #A78BFA",
                      background: "transparent", color: "#A78BFA", cursor: "pointer" }}>🔊</button>
                  <button onClick={() => speakText(s.en, 0.72)}
                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, border: "1px solid #B8ADFF",
                      background: "transparent", color: "#B8ADFF", cursor: "pointer" }}>🐢</button>
                  {SpeechRec && (
                    <button onClick={() => toggleMic(i, s.en)}
                      style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, border: "none",
                        background: mic.on ? "#7C6EE8" : "#9B8EF5",
                        color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                      {mic.on ? "⏹" : "🎤"}
                    </button>
                  )}
                </div>
              </div>

              <AIBubbleWithDrill text={s.en} drillState={ds}
                onDrillState={state => setDrillStates(prev => ({...prev, [i]: state}))} />

              {/* Transcript + score */}
              {mic.transcript && (
                <div style={{ marginTop: 6, padding: "5px 8px", background: "#0E1628", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "#B8B4D8" }}>🎤 {mic.transcript}</div>
                  {mic.score !== null && (
                    <div style={{ fontSize: 11, marginTop: 3,
                      color: mic.score >= 70 ? "#9B8EF5" : mic.score >= 40 ? "#B8ADFF" : "#7C6EE8",
                      fontWeight: 700 }}>
                      {mic.score}% {mic.score >= 70 ? "✓ 잘 됐어요!" : "다시 해봐요 💪"}
                    </div>
                  )}
                </div>
              )}

              {ds >= 3 && s.ko && (
                <div style={{ fontSize: 11, color: "#8C9AB8", marginTop: 4 }}>💬 {s.ko}</div>
              )}
            </div>
          );
        })}
      </div>
      <button className="mm-btn-ghost" style={{ fontSize: 11, marginTop: 8 }} onClick={load}>
        <RefreshCw size={10} /> 새 문장들로
      </button>
    </div>
  );
}

function PatternExamplesLoader({ p, topicLabel }) {
  const [examples, setExamples] = useState(p.examples?.length > 0 ? p.examples : null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const system = `Generate 2-3 short natural example sentences for an English grammar pattern. Topic: ${topicLabel}. Pattern: "${p.pattern_en}" (${p.explain_ko}).
Return ONLY valid JSON: {"examples":[{"ko:"Korean sentence","en:"English translation"}]}`;
      const res = await askClaudeJSON(system, "Generate examples.", 1500);
      setExamples(res.examples || []);
    } catch(e) { setExamples([]); }
    finally { setLoading(false); }
  }

  if (!examples && !loading) return (
    <button className="mm-btn-ghost" style={{ fontSize: 13, marginTop: 6 }} onClick={load}>
      예문 보기 ▼
    </button>
  );
  if (loading) return <Spinner label="예문 준비 중..." />;
  // Extract key words from pattern_en to highlight in examples
  const patternWords = (p.pattern_en || "").split(/[\s+\/,()]+/).filter(w => /^[a-zA-Z]/.test(w) && w.length > 2);
  return (
    <div className="mm-col" style={{ gap: 6, marginTop: 6 }}>
      {examples.map((ex, j) => (
        <div key={j} style={{ paddingLeft: 8, borderLeft: "2px solid #B8ADFF" }}>
          <div className="mm-muted" style={{ fontSize: 13 }}>{ex?.ko || ""}</div>
          <div className="mm-row" style={{ gap: 5 }}>
            <SpeakButton text={ex.en} size={11} />
            <span style={{ fontSize: 13 }}>{highlightGrammar(ex.en, patternWords)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Sentence analysis: color-coded subject/verb/object breakdown
function SentenceAnalysis({ sentence }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const ROLE_STYLE = {
    subject:     { bg: "#FFF0EB", border: "#7C6EE8", label: "주어 S" },
    verb:        { bg: "#FFEDED", border: "#E74C3C", label: "동사 V" },
    object:      { bg: "#EBF4FF", border: "#3498DB", label: "목적어 O" },
    adjective:   { bg: "#EAFBF2", border: "#27AE60", label: "형용사" },
    adverb:      { bg: "#F3EBFF", border: "#6C5CE7", label: "부사" },
    preposition: { bg: "#FFF8E8", border: "#B8ADFF", label: "전치사" },
    other:       { bg: "#F8F8FC", border: "#C8C0B0", label: "" },
  };

  async function analyze() {
    if (data || loading) return;
    setLoading(true);
    try {
      const system = `Break this English sentence into labeled parts for Korean learners. Return ONLY valid JSON:
{"parts":[{"text":"each word or phrase","role":"subject|verb|object|adjective|adverb|preposition|other","ko:"Korean gloss"}],"ko_full":"Korean translation of the whole sentence"}
Label each word or short phrase. Subject=주어, Verb=동사, Object=목적어.`;
      const res = await askClaudeJSON(system, `Sentence: "${sentence}"`);
      setData(res);
    } catch(e) {} finally { setLoading(false); }
  }

  return (
    <div style={{ marginTop: 8 }}>
      {!data && !loading && (
        <button className="mm-btn-ghost" style={{ fontSize: 13 }} onClick={analyze}>

        </button>
      )}
      {loading && <Spinner label="분석 중..." />}
      {data && (
        <div>
          {/* Color-coded tokens */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {data.parts?.map((p, i) => {
              const s = ROLE_STYLE[p.role] || ROLE_STYLE.other;
              return (
                <div key={i} style={{ background: s.bg, borderBottom: `2.5px solid ${s.border}`, borderRadius: "6px 6px 0 0", padding: "4px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.text}</div>
                  <div style={{ fontSize: 13, color: s.border, fontWeight: 600 }}>{p.ko}</div>
                </div>
              );
            })}
          </div>
          {/* Full Korean */}
          <div style={{ background: "#F8F8FC", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginBottom: 6 }}>
            💬 {data.ko_full}
          </div>
          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries({ subject: "주어 S", verb: "동사 V", object: "목적어 O", adjective: "형용사", adverb: "부사", preposition: "전치사" }).map(([role, label]) => (
              <div key={role} className="mm-row" style={{ gap: 4 }}>
                <div style={{ width: 10, height: 10, background: ROLE_STYLE[role].border, borderRadius: 2 }} />
                <span style={{ fontSize: 13, color: "#3D4560" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Store a wrong answer to window.myMistakes for the My tab
function saveMistake(ex, userAnswer) {
  try {
    const m = {
      type: ex.type, prompt: ex.prompt || ex.words?.join(" ") || "",
      userAnswer, reference: ex.reference,
      hint_ko: ex.hint_ko, topic: ex._topic || "",
      ts: Date.now()
    };
    const key = "malmun:mistakes";
    const prev = JSON.parse(localStorage.getItem(key) || "[]");
    prev.unshift(m);
    localStorage.setItem(key, JSON.stringify(prev.slice(0, 120)));
  } catch(e) {}
}

// Sentence breakdown component: color-coded subject/verb/object with Korean

function QuizExercise({ ex, quizIdx, quizTotal, renderHeader, onNext, topicLabel }) {
  const [hintShown, setHintShown] = useState(false);
  const [chosen, setChosen] = useState(null);  // for MC / find_errors
  const [quizAns, setQuizAns] = useState("");
  const [quizFb, setQuizFb] = useState(null);
  const [quizGrading, setQuizGrading] = useState(false);

  const isLast = quizIdx + 1 >= quizTotal;

  function handleResult(correct) {
    playSound(correct);
    // allow time for visual update then move on
  }

  // ── Find Errors: simple ✓/✗ ──
  if (ex.type === "find_errors") {
    return (
      <div className="mm-card">
        {renderHeader()}
        <div className="mm-row mm-space-between" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#7C6EE8", background: "#FFF0EB", padding: "3px 10px", borderRadius: 20 }}>🔍 오류 찾기</span>
          <span className="mm-mono mm-muted" style={{ fontSize: 13 }}>{quizIdx + 1} / {quizTotal}</span>
        </div>
        <div className="mm-muted" style={{ fontSize: 13, marginBottom: 8 }}>이 문장이 올바른가요?</div>
        <div className="mm-explain-box" style={{ marginBottom: 12, fontSize: 15, fontWeight: 600 }}>
          {ex.prompt}
        </div>
        {!hintShown ? (
          <button className="mm-btn-ghost" style={{ fontSize: 13, marginBottom: 10 }} onClick={() => setHintShown(true)}>💡 힌트 보기</button>
        ) : (
          <div className="mm-muted" style={{ fontSize: 13, marginBottom: 10, fontStyle: "italic" }}>💡 {ex.hint_ko}</div>
        )}
        {!chosen ? (
          <div className="mm-row" style={{ gap: 12, justifyContent: "center", marginTop: 8 }}>
            <button
              onClick={() => { setChosen("correct"); playSound(false); }}
              style={{ flex: 1, padding: "18px 0", fontSize: 28, borderRadius: 14, border: "2px solid #C4BEFF", background: "#FFFFFF", cursor: "pointer" }}
            >✓</button>
            <button
              onClick={() => { setChosen("error"); playSound(true); }}
              style={{ flex: 1, padding: "18px 0", fontSize: 28, borderRadius: 14, border: "2px solid #C4BEFF", background: "#FFFFFF", cursor: "pointer" }}
            >✗</button>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: "center", fontSize: 48, marginBottom: 10 }}>
              {chosen === "error" ? "✅" : "❌"}
            </div>
            <div className={"mm-sentence-feedback " + (chosen === "error" ? "mm-sentence-good" : "mm-sentence-fix")} style={{ marginBottom: 10 }}>
              {chosen === "error" ? "맞아요! 오류가 있어요." : "아쉽게도 이 문장에는 오류가 있었어요."}
            </div>
            <div style={{ background: "#F8F8FC", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
              <div className="mm-muted" style={{ fontSize: 13, marginBottom: 4 }}>✅ 올바른 문장</div>
              <div className="mm-row" style={{ gap: 6, marginBottom: ex.error_explanation_ko ? 8 : 0 }}>
                <SpeakButton text={ex.reference} size={13} />
                <span style={{ fontWeight: 700 }}>{ex.reference}</span>
              </div>
              {ex.error_explanation_ko && (
                <div className="mm-muted" style={{ fontSize: 13, borderTop: "1px dashed #C4BEFF", paddingTop: 6, marginTop: 6 }}>
                  💬 {ex.error_explanation_ko}
                </div>
              )}
            </div>
            <button className="mm-btn-primary" onClick={onNext}>
              {isLast ? <>역할극 시작 <ChevronRight size={13} /></> : <>다음 문제 <ChevronRight size={13} /></>}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Fill blank / Multiple choice ──
  if (ex.type === "fill_blank" && ex.options?.length > 0) {
    const correct = ex.reference;
    return (
      <div className="mm-card">
        {renderHeader()}
        <div className="mm-row mm-space-between" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#7C6EE8", background: "#FFF0EB", padding: "3px 10px", borderRadius: 20 }}>{QUIZ_TYPE_LABELS[ex.type]}</span>
          <span className="mm-mono mm-muted" style={{ fontSize: 13 }}>{quizIdx + 1} / {quizTotal}</span>
        </div>
        <div className="mm-explain-box" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.prompt}</div>
        </div>
        {!hintShown ? (
          <button className="mm-btn-ghost" style={{ fontSize: 13, marginBottom: 10 }} onClick={() => setHintShown(true)}>💡 힌트 보기</button>
        ) : (
          <div className="mm-muted" style={{ fontSize: 13, marginBottom: 10, fontStyle: "italic" }}>💡 {ex.hint_ko}</div>
        )}
        {!quizFb ? (
          <div className="mm-col" style={{ gap: 8 }}>
            {ex.options.map((opt, oi) => (
              <button key={oi} className="mm-quiz-option" onClick={() => {
                const isCorrect = opt.trim().toLowerCase() === correct.trim().toLowerCase();
                if (!isCorrect) saveMistake(ex, opt);
                playSound(isCorrect);
                setQuizFb({ correct: isCorrect, model_answer: correct });
                setChosen(opt);
              }}>{opt}</button>
            ))}
          </div>
        ) : (
          <>
            <div className="mm-col" style={{ gap: 8 }}>
              {ex.options.map((opt, oi) => {
                const isCorrect = opt.trim().toLowerCase() === correct.trim().toLowerCase();
                const wasChosen = opt === chosen;
                return <div key={oi} className={"mm-quiz-option " + (isCorrect ? "mm-quiz-correct" : wasChosen ? "mm-quiz-wrong" : "")}>{isCorrect ? "✓ " : wasChosen ? "✗ " : ""}{opt}</div>;
              })}
            </div>
            {!quizFb.correct && (
              <div className="mm-sentence-feedback mm-sentence-fix" style={{ marginTop: 10 }}>
                <SpeakButton text={quizFb.model_answer} size={12} /> {quizFb.model_answer}
              </div>
            )}
            <SentenceAnalysis sentence={ex.prompt.replace("___", quizFb.model_answer || "...")} />
            <button className="mm-btn-primary" style={{ marginTop: 12 }} onClick={onNext}>
              {isLast ? <>역할극 시작 <ChevronRight size={13} /></> : <>다음 문제 <ChevronRight size={13} /></>}
            </button>
          </>
        )}
      </div>
    );
  }

  if (false && ex.type === "unscramble" && ex.words?.length > 0) {
    return null; // unscramble type removed
  }

  // ── Complete (text input) ──
  async function gradeText() {
    if (!quizAns.trim() || quizGrading) return;
    setQuizGrading(true);
    try {
      const system = `Grade this English exercise. Return ONLY valid JSON: {"correct":true/false,"feedback_ko:"짧은 따뜻한 한국어 피드백","model_answer":"correct English"}. Accept paraphrases.`;
      const res = await askClaudeJSON(system, `Type: ${ex.type}\nPrompt: ${ex.prompt}\nReference: ${ex.reference}\nLearner: ${quizAns}`);
      playSound(res.correct);
      setQuizFb(res);
    } catch(e) {
      setQuizFb({ correct: false, feedback_ko: "확인하지 못했어요.", model_answer: ex.reference });
    } finally { setQuizGrading(false); }
  }

  return (
    <div className="mm-card">
      {renderHeader()}
      <div className="mm-row mm-space-between" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#7C6EE8", background: "#FFF0EB", padding: "3px 10px", borderRadius: 20 }}>{QUIZ_TYPE_LABELS[ex.type] || ex.type}</span>
        <span className="mm-mono mm-muted" style={{ fontSize: 13 }}>{quizIdx + 1} / {quizTotal}</span>
      </div>
      <div className="mm-explain-box" style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.prompt}</div>
      </div>
      {!hintShown ? (
        <button className="mm-btn-ghost" style={{ fontSize: 13, marginBottom: 10 }} onClick={() => setHintShown(true)}>💡 힌트 보기</button>
      ) : (
        <div className="mm-muted" style={{ fontSize: 13, marginBottom: 10, fontStyle: "italic" }}>💡 {ex.hint_ko}</div>
      )}
      <div className="mm-row" style={{ gap: 6 }}>
        <input className="mm-input" value={quizAns} onChange={e => setQuizAns(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !quizFb && gradeText()}
          placeholder="영어로 완성해보세요..." disabled={!!quizFb} />
        {!quizFb && (
          <button className="mm-btn-ghost" onClick={gradeText} disabled={quizGrading || !quizAns.trim()}>
            {quizGrading ? <Loader2 className="animate-spin" size={13} /> : "확인"}
          </button>
        )}
      </div>
      {quizFb && (
        <>
          <div className={"mm-sentence-feedback " + (quizFb.correct ? "mm-sentence-good" : "mm-sentence-fix")} style={{ marginTop: 10 }}>
            {quizFb.correct ? <Check size={13} /> : <Lightbulb size={13} />} {quizFb.feedback_ko}
            {quizFb.model_answer && <div style={{ marginTop: 6, fontWeight: 600 }}><SpeakButton text={quizFb.model_answer} size={12} /> {quizFb.model_answer}</div>}
          </div>
          <button className="mm-btn-primary" style={{ marginTop: 12 }} onClick={onNext}>
            {isLast ? <>역할극 시작 <ChevronRight size={13} /></> : <>다음 문제 <ChevronRight size={13} /></>}
          </button>
        </>
      )}
    </div>
  );
}


function situationGradeSystem(scene) {
  return `You are an English coach. Situation: ${scene.scenario_ko}. Evaluate the learner's English response and return ONLY valid JSON, no markdown:
{"good":true/false,"feedback_ko:"2-3 따뜻하고 구체적인 한국어 피드백 문장 (good이면 칭찬 + 뭐가 좋았는지, bad이면 어떻게 고치면 좋은지)"}`;
}

function blankKey(sentence) {
  const SKIP = new Set('a an the is are was were do does did have has had will would could should may might can shall i you he she it we they what where when why how that this these those of in on at to for with and or but if as by from your my our its their be been being not no nor so yet just there here then again now after before me us him her them'.split(' '));
  let count = 0;
  return sentence.split(' ').map(w => {
    const core = w.replace(/[^a-zA-Z']/g, '').toLowerCase();
    if (core.length > 3 && !SKIP.has(core) && count < 2) {
      count++;
      return '___' + w.slice(core.length);
    }
    return w;
  }).join(' ');
}

function ListeningQuestion({ q }) {
  // Use the same AIBubbleWithDrill as interview — hear → blank → colour analysis
  const [drillState, setDrillState] = useState(0);
  return (
    <div style={{ background: drillState === 0 ? "#F8F8FC" : "#2D2B55", borderRadius: 10, padding: "10px 12px", marginBottom: 6, transition: "background 0.35s" }}>
      <AIBubbleWithDrill text={q} drillState={drillState} onDrillState={setDrillState} />
    </div>
  );
}



// ModelAnswerDrill — shows a sentence with listen + 안들려요 → FillBlankDrill → ColourAnnotationDrill
function ModelAnswerDrill({ text, subtext }) {
  const [drillState, setDrillState] = useState(0);
  return (
    <div>
      {subtext && <div style={{ fontSize: 11, color: "#8C9AB8", marginBottom: 4 }}>{subtext}</div>}
      <AIBubbleWithDrill text={text} drillState={drillState} onDrillState={setDrillState} />
    </div>
  );
}

// SituationBuildTogether — uses pre-defined steps from scene.build_sentences data
function SituationBuildTogether({ sentences, onClose }) {
  const [idx, setIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [chosen, setChosen] = useState([]);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [done, setDone] = useState(false);

  const current = sentences[idx];
  // Use pre-defined steps — no AI call
  const steps = current?.steps || [];

  useEffect(() => {
    setStepIdx(0); setChosen([]); setSelected(null); setResult(null); setDone(false);
  }, [idx]);

  function pickTile(tile) {
    if (result || !steps) return;
    const step = steps[stepIdx];
    setSelected(tile.text);
    if (tile.correct) {
      setResult("correct");
      speakText(tile.text, 1.0);
      setTimeout(() => {
        const newChosen = [...chosen, step.en];
        setChosen(newChosen);
        if (stepIdx + 1 >= steps.length) {
          speakText(current.en, 1.0);
          setDone(true);
        } else {
          setStepIdx(i => i + 1);
          setResult(null); setSelected(null);
        }
      }, 600);
    } else {
      setResult("wrong");
      setTimeout(() => { setResult(null); setSelected(null); }, 800);
    }
  }

  const ROLE_COLORS = { "핵심표현":"#7C6EE8","주어+동사":"#9B8EF5","추가정보":"#6C5CE7","기타":"#9490B8" };

  if (!current) return (
    <div style={{ textAlign: "center", padding: "14px 0" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>모두 완성했어요!</div>
      <button className="mm-btn-ghost" onClick={onClose}>접기 ▲</button>
    </div>
  );

  const step = steps?.[stepIdx];

  return (
    <div style={{ background: "#F8F8FC", borderRadius: 12, padding: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#7C6EE8" }}>✍️ 같이 만들어봐요</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#9490B8" }}>{idx + 1}/{sentences.length}</span>
          <button className="mm-btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={onClose}>접기 ▲</button>
        </div>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
        {sentences.map((_, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%",
            background: i < idx ? "#9B8EF5" : i === idx ? "#7C6EE8" : "#C4BEFF" }} />
        ))}
      </div>

      {/* Korean sentence  full */}
      <div style={{ background: "#2D2B55", borderRadius: 10, padding: "12px 14px", marginBottom: 12, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#9490B8", marginBottom: 4 }}>완성할 문장</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#FFFFFF" }}>{current.ko}</div>
      </div>

      {/* Growing sentence bar */}
      <div style={{ background: "#2D2B55", borderRadius: 10, padding: "10px 14px", marginBottom: 12,
        minHeight: 44, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {chosen.length === 0
          ? <span style={{ fontSize: 13, color: "#5B5490" }}>여기에 조각이 쌓여요…</span>
          : <>
              {chosen.map((c, i) => (
                <span key={i} style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>{c}</span>
              ))}
              {!done && <span style={{ fontSize: 20, color: "#B8ADFF" }}>+?</span>}
            </>
        }
      </div>

      {/* Step prompt + tiles */}
      {steps.length > 0 && !done && step && (() => {
        const color = ROLE_COLORS[step.role_ko] || "#9490B8";
        return (
          <div>
            {/* Step badge + cue */}
            <div style={{ borderRadius: 10, border: `2px solid ${color}55`,
              padding: "10px 14px", marginBottom: 12, background: color + "10" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color, background: color + "22",
                  padding: "2px 8px", borderRadius: 20 }}>{step.role_ko}</span>
                <span style={{ fontSize: 11, color: "#9490B8" }}>단계 {stepIdx + 1}/{steps.length}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#2D2B55" }}>{step.cue_ko}</div>
            </div>

            {/* Tile grid */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {(step.tiles || []).map((tile, i) => {
                const isSel = selected === tile.text;
                const isC = result === "correct" && isSel;
                const isW = result === "wrong" && isSel;
                return (
                  <button key={i} onClick={() => pickTile(tile)} disabled={!!result}
                    style={{ padding: "14px 20px", borderRadius: 14, fontSize: 15, fontWeight: 800,
                      cursor: result ? "default" : "pointer", minWidth: 90,
                      border: "2.5px solid " + (isC ? "#9B8EF5" : isW ? "#7C6EE8" : color + "55"),
                      background: isC ? "#E8F8F4" : isW ? "#FFF0EB" : "#fff",
                      color: isC ? "#1E8E78" : isW ? "#B23A3A" : "#2D2B55",
                      fontFamily: "'Nunito','Noto Sans KR',sans-serif",
                      boxShadow: result ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
                      transition: "all 0.15s",
                      transform: isSel ? "scale(0.96)" : "scale(1)" }}>
                    {tile.text}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Fallback  no pre-defined steps */}
      {steps.length === 0 && !done && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#9490B8", marginBottom: 8 }}>단어 카드로 들어봐요</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 10 }}>
            {current.en.split(" ").map((w, i) => (
              <button key={i} onClick={() => speakText(w, 0.9)}
                style={{ padding: "8px 14px", borderRadius: 10, background: "#fff",
                  border: "2px solid #C4BEFF", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {w}
              </button>
            ))}
          </div>
          <button className="mm-btn-primary" onClick={() => {
            if (idx + 1 >= sentences.length) onClose(); else setIdx(i => i + 1);
          }}>다음 →</button>
        </div>
      )}

      {/* Done */}
      {done && (
        <div>
          <div style={{ background: "#E8F8F4", borderRadius: 10, padding: "12px 14px", marginBottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#9B8EF5", fontWeight: 700, marginBottom: 4 }}>✓ 완성!</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#2D2B55" }}>{current.en}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn-ghost" style={{ flex: 1 }} onClick={() => speakText(current.en, 1.0)}>🔊 듣기</button>
            <button className="mm-btn-primary" style={{ flex: 2 }}
              onClick={() => { if (idx + 1 >= sentences.length) onClose(); else setIdx(i => i + 1); }}>
              {idx + 1 >= sentences.length ? "완료 ✓" : "다음 문장 →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SituationTalkTab({ goTo, initialSituationId, onSituationLoaded }) {
  const [category, setCategory] = useState(null);
  const [scene, setScene] = useState(null);
  const [stage, setStage] = useState("browse"); // browse | scenes | respond | result | deep
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [grading, setGrading] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [micListening, setMicListening] = useState(false);
  const [activeQ, setActiveQ] = useState(-1);
  const [showBuild, setShowBuild] = useState(false);
  const [openCat, setOpenCat] = useState(null);
  const micRef = useRef(null);
  const SpeechRec = getSpeechRecognition();

  // Auto-navigate to initialSituationId from English Map
  useEffect(() => {
    if (initialSituationId && stage === "browse") {
      const cat = null; // SITUATION_CATEGORIES removed
      if (cat) { pickCategory(cat); onSituationLoaded && onSituationLoaded(); }
    }
  }, [initialSituationId]);

  function pickCategory(cat) { setCategory(cat); setStage("scenes"); setScene(null); }
  function pickScene(sc) { setScene(sc); setStage("respond"); setAnswer(""); setFeedback(null); setHintShown(false); setActiveQ(-1); }
  function backToCategories() { setCategory(null); setStage("browse"); stopMic(); }
  function backToScenes() { setScene(null); setStage("scenes"); stopMic(); }

  function stopMic() { if (micRef.current) try { micRef.current.stop(); } catch(e) {} setMicListening(false); }
  function toggleMic() {
    if (micListening) { stopMic(); return; }
    setAnswer("");
    const r = startRecognition(t => setAnswer(t), () => setMicListening(false));
    if (r) { micRef.current = r; setMicListening(true); }
  }

  async function grade() {
    if (!answer.trim() || grading) return;
    stopMic(); setGrading(true);
    try {
      const system = `You are an English coach. Situation: ${scene.scenario_ko}. Evaluate the learner\'s English response and return ONLY valid JSON: {"good":true/false,"feedback_ko:"2-3 따뜻하고 구체적인 한국어 피드백 문장"}`;
      const res = await askClaudeJSON(system, `Learner: ${answer}`);
      setFeedback(res); setStage("result");
    } catch(e) { setFeedback({ good: false, feedback_ko: "확인하지 못했어요." }); setStage("result"); }
    finally { setGrading(false); }
  }



  // ── Browse ──
  if (stage === "browse") return (
    <div>
      <div style={{fontSize:14,fontWeight:700,color:"#2D2B55",marginBottom:12}}>🗣 어떤 상황을 연습할까요?</div>
      {/* 상황 카테고리 + 테마 합친 아코디언 */}
      {[
        { label:"🍽 식당", situations: [], themes: THEME_TALKS.filter(t=>["restaurant-reservation","restaurant-ordering","restaurant-complaint","coffee-ordering","restaurant-questions","custom-order","bakery-complain"].includes(t.id)) },
        { label:"🏨 호텔·쇼핑·여행", situations: [], themes: THEME_TALKS.filter(t=>["hotel-service","theme-park","shopping-refund"].includes(t.id)) },
        { label:"🏥 병원·약국", situations: [], themes: THEME_TALKS.filter(t=>["doctor","pharmacy"].includes(t.id)) },
        { label:"🏦 은행·행정", situations: [], themes: THEME_TALKS.filter(t=>["bank-dispute","bank-basics","car-accident"].includes(t.id)) },
        { label:"🏫 학교", situations: [], themes: THEME_TALKS.filter(t=>["parent-teacher","school-meeting","school-admin"].includes(t.id)) },
        { label:"🏠 렌트·집", situations: [], themes: THEME_TALKS.filter(t=>["landlord"].includes(t.id)) },
        { label:"💼 직장·면접", situations: [], themes: THEME_TALKS.filter(t=>["job-interview"].includes(t.id)) },
        { label:"🔢 숫자·기호", situations: [], themes: THEME_TALKS.filter(t=>["email-symbols","fractions-scores","numbers-symbols"].includes(t.id)) },
      ].map(cat => {
        const color = "#7C6EE8";
        const allItems = [...cat.situations, ...cat.themes];
        if (!allItems.length) return null;
        const isOpen = openCat === cat.label;
        return (
          <div key={cat.label} style={{marginBottom:8}}>
            <button onClick={() => setOpenCat(isOpen ? null : cat.label)}
              style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"13px 16px",borderRadius:14,border:"2px solid #7C6EE8",
                background:isOpen?"#7C6EE8":"#FFFFFF",cursor:"pointer",
                fontFamily:"'Nunito','Noto Sans KR',sans-serif"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15,fontWeight:900,color:isOpen?"#fff":"#2D2B55"}}>{cat.label}</span>
                <span style={{fontSize:11,color:isOpen?"rgba(255,255,255,0.8)":"#7C6EE8",fontWeight:700}}>{cat.themes.length}개</span>
              </div>
              <span style={{color:isOpen?"#fff":"#7C6EE8",fontWeight:700}}>{isOpen?"▲":"▼"}</span>
            </button>
            {isOpen && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                {/* 상황연습은 테마 안으로 통합됨 */}
                {cat.themes.map(t => (
                  <button key={t.id}
                    onClick={() => { setCategory({id:t.id,themeId:t.id,label_ko:t.label_ko,emoji:"📚",scenes:[]}); setStage("deep"); }}
                    style={{padding:"14px 10px",borderRadius:14,
                      border:"2px solid #7C6EE8",background:"#7C6EE8",
                      cursor:"pointer",textAlign:"center",
                      fontFamily:"'Nunito','Noto Sans KR',sans-serif",
                      display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                    <div style={{fontSize:22}}>{t.emoji || "📚"}</div>
                    <div style={{fontSize:12,fontWeight:800,color:"#FFFFFF",lineHeight:1.3}}>{t.label_ko}</div>
                    
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Scene list ──
  if (stage === "scenes") {
    const hasDeepStudy = category.themeId && THEME_TALKS.find(t => t.id === category.themeId);
    // Collect sample listening phrases from scenes
    const samplePhrases = category.scenes.flatMap(sc => sc.questions || []).slice(0, 4);
    return (
      <div>
        <button className="mm-btn-ghost" style={{ marginBottom: 12 }} onClick={backToCategories}>
          <ArrowLeft size={14} /> 카테고리
        </button>

        <div className="mm-card" style={{ marginBottom: 10 }}>
          <div className="mm-row" style={{ gap: 8 }}>
            <span style={{ fontSize: 24 }}>{category.emoji}</span>
            <h2 className="mm-serif" style={{ fontSize: 18, margin: 0 }}>{category.label_ko}</h2>
          </div>
          <p className="mm-muted" style={{ fontSize: 13, marginTop: 4 }}>어떤 상황을 연습할까요?</p>
        </div>
        <div className="mm-col" style={{ gap: 8, marginBottom: 10 }}>
          {category.scenes.map(sc => (
            <button key={sc.id} onClick={() => pickScene(sc)}
              style={{ background: "#FFFFFF", border: "none", borderRadius: 12, padding: "14px 16px",
                textAlign: "left", cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#2D2B55", marginBottom: 4 }}>{sc.title_ko}</div>
              <div className="mm-muted" style={{ fontSize: 13 }}>{sc.scenario_ko}</div>
            </button>
          ))}
        </div>
        {hasDeepStudy && (
          <button
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: "#FFF8E8", border: "1.5px solid #B8ADFF", borderRadius: 12, padding: "13px 16px",
              cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif", fontSize: 13, fontWeight: 700 }}
            onClick={() => setStage("deep")}
          >
            📚 표현·패턴·연습·역할극 깊이 공부하기 →
          </button>
        )}
      </div>
    );
  }

  // ── Deep (테마별 공부) ──
  if (stage === "deep") {
    const theme = THEME_TALKS.find(t => t.id === category?.themeId);
    if (!theme) return null;
    // Build example_pairs from patterns.examples if not present
    const exPairs = theme.example_pairs || 
      (theme.patterns || []).flatMap(p => p.examples || []).slice(0, 6);
    const themeTopic = {
      id: theme.id, label_ko: theme.label_ko, level: "중급",
      vocab: theme.vocab || [], patterns: theme.patterns || [],
      expressions: theme.expressions || [],
      example_pairs: exPairs,
      roleplay_context: theme.context_en, counterpart: theme.counterpart,
      context_en: theme.context_en,
      trigger_ko: theme.patterns?.[0]?.explain_ko || "",
      highlight_words: [],
    };
    return (
      <div>
        <button className="mm-btn-ghost" style={{marginBottom:12}}
          onClick={() => setStage("browse")}>
          <ArrowLeft size={14} /> 테마별 공부
        </button>
        <LessonFlow topic={themeTopic} onBack={() => setStage("browse")} goTo={goTo} skipReveal={true} />
      </div>
    );
  }

  // ── Respond ──
  if (stage === "respond") {
    return (
      <div>
        <button className="mm-btn-ghost" style={{ marginBottom: 10 }} onClick={backToScenes}>
          <ArrowLeft size={14} /> {category.label_ko}
        </button>

        {/* Scenario card */}
        <div className="mm-card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{category.emoji}</div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px", color: "#2D2B55" }}>{scene.scenario_ko}</p>
          <p style={{ fontSize: 13, color: "#7C6EE8", fontWeight: 700, margin: 0 }}>뭐라고 할까요? 🗣</p>
        </div>

        {/* 4-step listening warm-up */}
        {scene.questions?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="mm-muted" style={{ fontSize: 13, marginBottom: 8 }}>
              📻 이런 말이 들릴 수 있어요 — 4단계로 들어보세요
            </div>
            {scene.questions.map((q, i) => <ListeningQuestion key={i} q={q} />)}
          </div>
        )}

        {/* Answer input */}
        <div className="mm-card">
          {scene.hints?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {!hintShown ? (
                <button className="mm-btn-ghost" style={{ fontSize: 13 }} onClick={() => setHintShown(true)}>💡 힌트 보기</button>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {scene.hints.map((h, i) => (
                    <div key={i} style={{ background: "#FFF8E8", border: "1px solid #B8ADFF", borderRadius: 20, padding: "4px 10px", display: "flex", gap: 5, alignItems: "center" }}>
                      <SpeakButton text={h.en} size={11} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{h.en}</span>
                      <span className="mm-muted" style={{ fontSize: 13 }}>{h.ko}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mm-row" style={{ gap: 6, marginBottom: 10 }}>
            {SpeechRec && (
              <button className={"mm-btn-icon " + (micListening ? "mm-mic-active" : "")} onClick={toggleMic}>
                {micListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
            <input className="mm-input" value={answer} onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => e.key === "Enter" && grade()}
              placeholder={micListening ? "🎤 듣고 있어요..." : "영어로 말하거나 써보세요..."} />
          </div>
          <button className="mm-btn-primary" onClick={grade} disabled={grading || !answer.trim()}>
            {grading ? <><Loader2 className="animate-spin" size={14} /> 확인 중...</> : <>확인하기 <ChevronRight size={14} /></>}
          </button>
        </div>
      </div>
    );
  }

  // ── Result ──
  return (
    <div>
      <button className="mm-btn-ghost" style={{ marginBottom: 10 }} onClick={() => { setStage("respond"); setFeedback(null); }}>
        <ArrowLeft size={14} /> 다시 해보기
      </button>
      <div className="mm-card">
        <div style={{ background: "#F8F8FC", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 10 }}>📝 {answer}</div>
        {feedback && (
          <div className={"mm-sentence-feedback " + (feedback.good ? "mm-sentence-good" : "mm-sentence-fix")} style={{ marginBottom: 14 }}>
            {feedback.good ? "✓ " : "💡 "}{feedback.feedback_ko}
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <div className="mm-muted" style={{ fontSize: 13, marginBottom: 6 }}>💬 이렇게 말하면 자연스러워요</div>
          <div style={{ background: "#2D2B55", borderRadius: 10, padding: "10px 14px" }}>
            <ModelAnswerDrill text={scene.model_answer} />
          </div>
        </div>
        {scene.alternatives?.length > 0 && (
          <>
            <div className="mm-muted" style={{ fontSize: 13, marginBottom: 8 }}>🔄 다양한 표현으로 말해봐요</div>
            <div className="mm-col" style={{ gap: 8, marginBottom: 14 }}>
              {scene.alternatives.map((alt, i) => (
                <div key={i} style={{ background: "#2D2B55", borderRadius: 10, padding: "8px 12px" }}>
                  <ModelAnswerDrill text={typeof alt === "object" ? alt.en : alt} subtext={typeof alt === "object" ? alt.ko : null} />
                </div>
              ))}
            </div>
          </>
        )}
        {/*    build the model answer step by step */}
        {!showBuild && (
          <button className="mm-btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 10, background: "#9B8EF5" }}
            onClick={() => setShowBuild(true)}>
            ✍️ 같이 만들어봐요 →
          </button>
        )}
        {showBuild && (
          <div style={{ marginBottom: 14 }}>
            <SituationBuildTogether
              sentences={scene.build_sentences || [
                { ko: scene.scenario_ko, en: scene.model_answer, steps: [] },
              ]}
              onClose={() => setShowBuild(false)}
            />
          </div>
        )}
        <div className="mm-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="mm-btn-ghost" onClick={() => { setStage("respond"); setAnswer(""); setFeedback(null); setShowBuild(false); }}>
            <RefreshCw size={13} /> 다시 해보기
          </button>
          <button className="mm-btn-ghost" onClick={() => { backToScenes(); setShowBuild(false); }}>다른 상황 <ChevronRight size={13} /></button>
          <button className="mm-btn-primary" onClick={() => { backToCategories(); setShowBuild(false); }}>카테고리로 <ChevronRight size={13} /></button>
        </div>
      </div>
    </div>
  );
}

function mergeUniqueByKey(prevArr, newArr, key, cap) {
  const result = [...(prevArr || [])];
  const seen = new Set(result.map((item) => (item[key] || "").trim().toLowerCase()));
  (newArr || []).forEach((item) => {
    const k = (item[key] || "").trim().toLowerCase();
    if (k && !seen.has(k)) {
      seen.add(k);
      result.push(item);
    }
  });
  return cap ? result.slice(-cap) : result;
}

function mergeUniqueStrings(prevArr, newArr) {
  return Array.from(new Set([...(prevArr || []), ...(newArr || [])]));
}

function MyTab({ active }) {
  const [errors, setErrors] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studyDays, setStudyDays] = useState(0);
  const [wordbook, setWordbook] = useState([]);
  const [wbTab, setWbTab] = useState("all"); // all | expression | collocation | grammar
  const [drillStates, setDrillStates] = useState({});

  const [savedGrammar, setSavedGrammar] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const e = await window.storage.get("my-errors");
      setErrors(e ? JSON.parse(e.value) : []);
      const keys = await window.storage.list("study-day:");
      setStudyDays((keys?.keys || []).length);
      const wb = await window.storage.get("wordbook", false);
      setWordbook(wb ? JSON.parse(wb.value) : []);
      // Load saved grammar notes
      try {
        const sg = JSON.parse(localStorage.getItem("saved_grammar") || "[]");
        setSavedGrammar(sg);
      } catch(e) {}
    } catch(ex) { setErrors([]); }
    finally { setLoading(false); }
  }

  // Reload every time tab becomes active
  useEffect(() => {
    if (active) load();
  }, [active]);

  async function removeWord(en) {
    await removeFromWordbook(en);
    setWordbook(prev => prev.filter(w => w.en !== en));
  }

  async function clearErrors() {
    try { await window.storage.delete("my-errors"); setErrors([]); } catch(e) {}
  }

  if (loading) return <div className="mm-card"><Spinner label="불러오는 중..." /></div>;

  const byType = {};
  (errors || []).forEach(e => { byType[e.type] = (byType[e.type] || 0) + 1; });
  const typeLabels = { find_errors: "오류 찾기", fill_blank: "빈칸 채우기", unscramble: "문장 배열", complete: "문장 완성" };

  return (
    <div>
      {/* Progress summary */}
      <div className="mm-card" style={{ marginBottom: 14 }}>
        <h2 className="mm-serif" style={{ fontSize: 20, marginTop: 0 }}>📊 나의 학습 기록</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div style={{ background: "#E8F8F4", borderRadius: 10, padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#9B8EF5" }}>{studyDays}</div>
            <div className="mm-muted" style={{ fontSize: 13 }}>공부한 날</div>
          </div>
          <div style={{ background: "#FFF0EB", borderRadius: 10, padding: "12px", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#7C6EE8" }}>{(errors || []).length}</div>
            <div className="mm-muted" style={{ fontSize: 13 }}>오답 노트</div>
          </div>
        </div>
        {Object.keys(byType).length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="mm-muted" style={{ fontSize: 13, marginBottom: 6 }}>유형별 오답</div>
            <div className="mm-row" style={{ gap: 6, flexWrap: "wrap" }}>
              {Object.entries(byType).map(([type, count]) => (
                <div key={type} style={{ background: "#F8F8FC", borderRadius: 8, padding: "4px 10px", fontSize: 13 }}>
                  {typeLabels[type] || type}: <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/*     */}
      {/*   My   */}
      <CalendarPanel active={active} focusAreas={[]} mergeTodayContent={()=>{}} goTo={()=>{}} />

      <div className="mm-card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 className="mm-serif" style={{ fontSize: 18, margin: 0 }}>❤️ 나의 단어장</h2>
          <span style={{ fontSize: 12, color: "#9490B8" }}>{wordbook.length}개 소장</span>
        </div>

        {/* Reload button */}
        <button className="mm-btn-ghost" style={{fontSize:12, marginBottom:10, width:"100%"}}
          onClick={load}>🔄 새로고침</button>

        {wordbook.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#9490B8", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤍</div>
            아직 소장한 표현이 없어요.<br/>설명이나 인터뷰에서 ❤️ 버튼을 눌러보세요!
          </div>
        ) : (
          <div>
            {/* Filter tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[{id:"all",label:"전체"}
].map(t => (
                <button key={t.id} onClick={() => setWbTab(t.id)}
                  style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer",
                    background: wbTab===t.id ? "#2D2B55" : "#F8F8FC",
                    color: wbTab===t.id ? "#FFFFFF" : "#5B5490",
                    fontWeight: 700, fontFamily: "'Nunito','Noto Sans KR',sans-serif" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Word list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {wordbook
                .filter(w => wbTab === "all" || w.type === wbTab)
                .map((w, i) => {
                  const ds = drillStates[w.en] || 0;
                  return (
                    <div key={i} style={{ borderRadius: 12, border: "1.5px solid #DDD8FF", overflow: "hidden" }}>
                      {/* Header */}
                      <div style={{ background: "#FFFFFF", padding: "10px 14px",
                        display: "flex", gap: 8, alignItems: "center" }}>
                        <button onClick={() => speakText(w.en, 1.0)}
                          style={{ background: "#2D2B55", border: "none", borderRadius: "50%",
                            width: 28, height: 28, cursor: "pointer", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Volume2 size={12} color="#FFFFFF" />
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#2D2B55" }}>{w.en}</div>
                          <div style={{ fontSize: 12, color: "#9490B8" }}>{w?.ko || ""}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 10, color: "#9490B8", background: "#F8F8FC",
                            padding: "2px 8px", borderRadius: 20 }}>{w.source || w.type}</span>
                          <button onClick={() => removeWord(w.en)}
                            style={{ background: "none", border: "none", cursor: "pointer",
                              fontSize: 16, lineHeight: 1, padding: "2px" }}>❤️</button>
                        </div>
                      </div>
                      {/* Drill */}
                      <div style={{ padding: "8px 14px", background: ds > 0 ? "#2D2B55" : "transparent" }}>
                        <AIBubbleWithDrill text={w.en} drillState={ds}
                          onDrillState={s => setDrillStates(prev => ({...prev, [w.en]: s}))} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Error notebook */}
      <div className="mm-card">
        <div className="mm-row mm-space-between" style={{ marginBottom: 14 }}>
          <h3 className="mm-serif" style={{ fontSize: 16, margin: 0 }}>📝 오답 노트</h3>
          {errors?.length > 0 && (
            <button className="mm-btn-ghost" style={{ fontSize: 13, color: "#D64545" }} onClick={clearErrors}>전체 삭제</button>
          )}
        </div>

        {(!errors || errors.length === 0) ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
            <p className="mm-muted" style={{ fontSize: 14 }}>오답 노트가 비어있어요!</p>
            <p className="mm-muted" style={{ fontSize: 13 }}>연습 문제를 풀다가 틀리면 여기 쌓여요.</p>
          </div>
        ) : (
          <div className="mm-col" style={{ gap: 12 }}>
            {errors.map((err, i) => (
              <div key={i} style={{ background: "#F8F8FC", borderRadius: 10, padding: "10px 14px" }}>
                <div className="mm-row mm-space-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 13, background: "#FFF0EB", color: "#7C6EE8", fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                    {typeLabels[err.type] || err.type}
                  </span>
                  <span className="mm-muted" style={{ fontSize: 13 }}>{err.date}</span>
                </div>
                {err.topic && <div className="mm-muted" style={{ fontSize: 13, marginBottom: 4 }}>📚 {err.topic}</div>}
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{err.prompt}</div>
                <div style={{ fontSize: 13 }}>
                  <span className="mm-muted">내 답: </span>
                  <span style={{ color: "#D64545" }}>{err.myAnswer}</span>
                </div>
                <div className="mm-row" style={{ gap: 6, marginTop: 4 }}>
                  <SpeakButton text={err.reference} size={12} />
                  <span style={{ fontSize: 13, color: "#9B8EF5", fontWeight: 600 }}>{err.reference}</span>
                </div>
                {err.hint_ko && <div className="mm-muted" style={{ fontSize: 13, marginTop: 4, fontStyle: "italic" }}>💡 {err.hint_ko}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 🎧 LISTENING LAB — hear it → diagnose → study → hear it again
// ═══════════════════════════════════════════════════════════


// ── Chunk extraction prompt ──
function chunkExtractionSystem() {
  return `You are an English chunk extractor for Korean learners.
Given an English sentence, find the ONE most important chunk to practice.

WHAT TO PICK — strict priority order:

PRIORITY 1 — Verb + preposition (MOST IMPORTANT):
Look for these patterns FIRST before anything else:
"work for", "look for", "wait for", "run out of", "go back to", "turn off", "pick up",
"check in", "show up", "end up", "set up", "come up with", "deal with", "move on"
Example: "Does Tuesday work for you?" → chunk: "work for"
Example: "I have been looking for you" → chunk: "looking for"

PRIORITY 2 — WH + adjective/noun:
"How long", "How much", "How often", "How old", "How far", "What kind of", "Which one"

PRIORITY 3 — Verb + object collocation:
"grab a coffee", "take a nap", "make a reservation", "pay with", "have a fever"

PRIORITY 4 — Fixed expression / idiom:
"by the way", "as far as I know", "no wonder", "sounds like", "I wish I could",
"been forever", "been a while", "been ages", "been waiting",
"make sense", "no idea", "end up", "find out", "move on"

WHAT NEVER TO PICK:
- Noun + verb: "Tuesday work", "kids sleep", "price drops" — NEVER
- Auxiliary + pronoun: "would you", "could he", "should I" — NEVER
- Pronoun + auxiliary: "I would", "you should" — NEVER
- Be-verb alone: "is a", "are they" — NEVER
- Articles: "a", "the" — NEVER

Return ONLY valid JSON:
{"chunk":"the key chunk","hint_ko:"한국어 힌트","options":["chunk","wrong1","wrong2","wrong3"]}
The options array must have exactly 4 items. chunk must be first option (correct answer at index 0).
Then shuffle the options array before returning.`;
}

// ── Content loader ──
async function loadSentenceContent(level, customSentences) {
  const pool = customSentences ? customSentences : (LISTENING_DB[level] || []);
  if (!pool.length) return null;

  // Track seen sentences to avoid repeats
  const seenKey = `seen_lv${level}`;
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch(e) {}
  const unseen = pool.filter(s => !seen.includes(s.en));
  const available = unseen.length > 0 ? unseen : pool;
  const s = available[Math.floor(Math.random() * available.length)];
  seen.push(s.en);
  if (seen.length > pool.length * 0.8) seen = seen.slice(-Math.floor(pool.length * 0.2));
  try { localStorage.setItem(seenKey, JSON.stringify(seen)); } catch(e) {}

  // Lv1: skip AI, generate blank directly for speed
  if (level === 1 || customSentences) {
    const words = s.en.split(" ").filter(w => w.replace(/[^a-zA-Z]/g,"").length > 3);
    if (words.length > 0) {
      const word = words[Math.floor(Math.random() * words.length)].replace(/[^a-zA-Z]/g,"");
      const distractors = ["today","tired","hungry","happy","busy","here","late","good","bad","okay"]
        .filter(w => w.toLowerCase() !== word.toLowerCase()).slice(0,3);
      return { sentence: s.en, ko: s.ko, blanks: [{
        word, hint_ko: "들린 단어를 골라요",
        options: [word, ...distractors].sort(() => Math.random()-0.5),
        collocation_label: ""
      }]};
    }
    return { sentence: s.en, ko: s.ko, blanks: [] };
  }
  
  try {
    const chunkRes = await askClaudeJSON(chunkExtractionSystem(), `Sentence: "${s.en}"`);
    
    const AUXILIARIES = ["is","are","was","were","do","does","did","will","would","could","should","can","may","might","have","has","had","be","been","am"];
    const SUBJECTS = ["i","you","he","she","it","we","they","this","that","there"];
    const PREPS = ["for","to","in","on","at","up","out","off","down","back","away","over","about","with","through","into","onto","from","by","after","before","between"];
    const NOUNS = ["noise","price","time","day","monday","tuesday","wednesday","thursday","friday","weather","food","water","coffee","money","house","home","car","phone"];
    
    function isBadChunk(word) {
      const w = word.trim().toLowerCase();
      const words = w.split(" ");
      if (words.length < 2) return false;
      const first = words[0], second = words[1];
      if (AUXILIARIES.includes(first) && SUBJECTS.includes(second)) return true;
      if (SUBJECTS.includes(first) && AUXILIARIES.includes(second)) return true;
      if (NOUNS.includes(first) && !PREPS.includes(second)) return true;
      if (SUBJECTS.includes(first) && !PREPS.includes(second)) return true;
      return false;
    }
    
    const blanks = chunkRes?.chunk && s.en.toLowerCase().includes(chunkRes.chunk.toLowerCase()) && !isBadChunk(chunkRes.chunk)
      ? [{
          word: chunkRes.chunk,
          hint_ko: chunkRes.hint_ko || "",
          options: chunkRes.options || [chunkRes.chunk, "wrong1", "wrong2", "wrong3"],
          collocation_label: ""
        }]
      : [];
    
    return { sentence: s.en, ko: s.ko, blanks };
  } catch(e) {
    // Fallback: pick a meaningful word as blank without AI
    const words = s.en.split(" ").filter(w => w.length > 3);
    if (words.length > 0) {
      const idx = Math.floor(Math.random() * words.length);
      const word = words[idx].replace(/[^a-zA-Z]/g, "");
      const distractors = ["getting", "making", "looking", "working"]
        .filter(w => w !== word.toLowerCase()).slice(0, 3);
      return { sentence: s.en, ko: s.ko, blanks: [{
        word, hint_ko: "들린 표현을 골라요", options: [word, ...distractors].sort(() => Math.random()-0.5), collocation_label: ""
      }]};
    }
    return { sentence: s.en, ko: s.ko, blanks: [] };
  }
}

// ── VocabListeningChallenge ──
function VocabListeningChallenge({ category, onBack, goTo }) {
  const items = (VOCAB_DB[category] || []).filter(x => x.example);
  // Sort by sentence length - easy (short) sentences first
  const sorted = [...items].sort((a,b) => a.example.split(" ").length - b.example.split(" ").length);
  const sentences = sorted.map(x => ({ ko: x.ko, en: x.example }));
  const label = category === "business" ? "비즈니스" : category === "mz" ? "MZ/GenZ" : "미드&일상";

  if (!sentences.length) return (
    <div style={{padding:20,textAlign:"center",color:"#9490B8"}}>데이터가 없어요</div>
  );

  return (
    <ListeningChallenge
      onBack={onBack}
      goTo={goTo}
      customSentences={sentences}
      customLabel={label}
      startLevel={1}
    />
  );
}

// ── ListeningChallenge ──
function ListeningChallenge({ onBack, goTo, startLevel = 1, customSentences = null, customLabel = null }) {
  const [level, setLevel] = useState(startLevel);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [levelHistory, setLevelHistory] = useState({});
  const [showDiagnosis, setShowDiagnosis] = useState(false); // saves content per level
  const [stage, setStage] = useState("listen"); // listen -> comprehension -> wordtap
  const [playing, setPlaying] = useState(false);
  const [listenCount, setListenCount] = useState(0);
  const [blankSelections, setBlankSelections] = useState({});
  const [blankResults, setBlankResults] = useState({});
  const [checked, setChecked] = useState(false);
  const [compQ, setCompQ] = useState(null);
  const [compAnswer, setCompAnswer] = useState(null);
  const [compChecked, setCompChecked] = useState(false);
  const [loadingComp, setLoadingComp] = useState(false);

  const lv = LEVELS[level-1] || LEVELS[0];
  const SpeechRec = getSpeechRecognition();
  // Use ref to lock current sentence - prevents race conditions
  const lockedSentenceRef = useRef(null);

  useEffect(() => {
    loadContent(level);
  }, [level]);

  async function loadContent(lvNum) {
    window.speechSynthesis.cancel();
    setLoading(true);
    setContent(null);
    setBlankSelections({});
    setBlankResults({});
    setChecked(false);
    setStage("listen");
    setListenCount(0);
    setCompQ(null);
    setCompAnswer(null);
    setCompChecked(false);
    lockedSentenceRef.current = null;
    const res = await loadSentenceContent(lvNum, customSentences);
    if (!res) { setLoading(false); return; }
    lockedSentenceRef.current = res.sentence;
    setContent(res);
    setLoading(false);
  }

  async function loadComp(sentence) {
    if (!sentence) return;
    setLoadingComp(true);
    setCompQ(null);
    try {
      const r = await askClaudeJSON(
        `You are making a listening comprehension question. The student just HEARD this sentence and you need to check if they understood the MEANING.

Ask about WHAT HAPPENED or WHAT WAS SAID in the sentence — NOT whether they understood it.
NEVER use questions like "Did you understand?" or "What did you hear?"

Ask about: who / what / where / when / how the speaker feels / what the speaker is doing.
Answers: ONE or TWO keywords only.

Examples:
Sentence: "I am so tired today."
→ {"question":"How does the speaker feel?","options":[{"text":"tired","tier":"perfect"},{"text":"fine","tier":"okay"},{"text":"happy","tier":"wrong"}]}

Sentence: "She went to the hospital yesterday."
→ {"question":"Where did she go?","options":[{"text":"hospital","tier":"perfect"},{"text":"school","tier":"okay"},{"text":"home","tier":"wrong"}]}

Sentence: "I should have booked the ticket earlier."
→ {"question":"What does the speaker regret?","options":[{"text":"booking late","tier":"perfect"},{"text":"missing flight","tier":"okay"},{"text":"nothing","tier":"wrong"}]}

Return ONLY valid JSON:
{"question":"...","options":[{"text":"1-2 words","tier":"perfect"},{"text":"1-2 words","tier":"okay"},{"text":"1-2 words","tier":"wrong"}]}`,
        `Sentence: "${sentence}"`,
        800
      );
      if (r?.question && Array.isArray(r?.options) && r.options.length >= 3) {
        setCompQ({ question: r.question, options: [...r.options].sort(() => Math.random()-0.5) });
      } else {
        // Fallback - extract keyword from sentence
        const words = sentence.replace(/[^a-zA-Z ]/g,"").split(" ").filter(w => w.length > 3);
        const keyword = words[Math.floor(words.length/2)] || words[0] || "it";
        setCompQ({
          question: `What is "${keyword}" related to in this sentence?`,
          options: [
            {text: keyword, tier: "perfect"},
            {text: "something else", tier: "okay"},
            {text: "nothing", tier: "wrong"},
          ].sort(() => Math.random()-0.5)
        });
      }
    } catch(e) {
      setCompQ({
        question: "Did you understand the sentence?",
        options: [
          {text: "Yes, I understood it", tier: "perfect"},
          {text: "I understood some parts", tier: "okay"},
          {text: "No, I need to listen again", tier: "wrong"},
        ].sort(() => Math.random()-0.5)
      });
    }
    setLoadingComp(false);
  }

  async function playAudio(speed) {
    if (!content?.sentence || playing) return;
    setPlaying(true);
    setListenCount(c => c+1);
    const wordCount = content.sentence.split(" ").length;
    const duration = Math.max(2000, (wordCount / (speed||1)) * 350 + 500);
    speakText(content.sentence, speed);
    await new Promise(r => setTimeout(r, duration));
    setPlaying(false);
  }

  // Auto-play on load
  useEffect(() => {
    if (!loading && content?.sentence && stage === "listen" && listenCount === 0) {
      const sentenceToPlay = content.sentence;
      const t = setTimeout(() => {
        // Only play if this is still the locked sentence
        if (lockedSentenceRef.current !== sentenceToPlay) return;
        playAudio(lv.speed).then(() => {
          // Check again after playing
          if (lockedSentenceRef.current !== sentenceToPlay) return;
          setStage("comprehension");
          loadComp(sentenceToPlay);
        });
      }, 600);
      return () => { clearTimeout(t); };
    }
  }, [loading, content?.sentence]);

  if (loading) return (
    <div style={{padding:40,textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:12}}>🎧</div>
      <div style={{fontSize:14,color:"#9490B8"}}>준비 중...</div>
    </div>
  );

  if (!content) return (
    <div style={{padding:20,textAlign:"center"}}>
      <div style={{fontSize:13,color:"#9490B8",marginBottom:10}}>문장을 불러오지 못했어요</div>
      <button onClick={() => loadContent(level)} className="mm-btn-primary">다시 시도</button>
    </div>
  );

  // ── LISTEN stage ──
  if (stage === "listen") {
    return (
      <div>
        <button className="mm-btn-back" onClick={onBack}><ArrowLeft size={14}/> 뒤로</button>

        {/* Step indicator */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:16,padding:"0 4px"}}>
          {["🎧 듣기","💬 이해","🔀 배열","✏️ 빈칸"].map((s,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{fontSize:11,fontWeight:700,
                color: i===0?"#7C6EE8":"#C4BEFF",
                opacity: i===0?1:0.5}}>{s}</div>
              {i<3 && <div style={{fontSize:10,color:"#C4BEFF"}}>›</div>}
            </div>
          ))}
        </div>

        <div className="mm-card">
          <div style={{fontSize:12,fontWeight:700,color:"#7C6EE8",marginBottom:16}}>{customLabel || (lv.badge + " " + lv.label)}</div>
          <div style={{textAlign:"center",padding:"24px 0"}}>
            {playing ? (
              <div>
                <div style={{fontSize:52,marginBottom:8}}>🎵</div>
                <div style={{fontSize:14,fontWeight:700,color:"#7C6EE8"}}>듣고 있어요...</div>
              </div>
            ) : (
              <div>
                <div style={{fontSize:52,marginBottom:8}}>🎧</div>
                <div style={{fontSize:14,fontWeight:700,color:"#9B8EF5",marginBottom:20}}>
                  {listenCount === 0 ? "잠깐 후 시작돼요" : "잘 들었어요!"}
                </div>
                {listenCount > 0 && (
                  <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:20}}>
                    <button className="mm-btn-ghost" style={{fontSize:12,padding:"6px 14px"}}
                      onClick={() => playAudio(lv.speed)} disabled={playing}>🔊 다시</button>
                    <button className="mm-btn-ghost" style={{fontSize:12,padding:"6px 14px"}}
                      onClick={() => playAudio(0.85)} disabled={playing}>🐢 천천히</button>
                  </div>
                )}
                {listenCount > 0 && (
                  <button className="mm-btn-primary" style={{width:"100%",fontSize:15,padding:"14px"}}
                    onClick={() => { setStage("comprehension"); loadComp(content.sentence); }}>
                    이해 확인하기 →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── COMPREHENSION stage ──
  if (stage === "comprehension") {
    return (
      <div>
        <button className="mm-btn-back" onClick={onBack}><ArrowLeft size={14}/> 뒤로</button>
        <div className="mm-card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:"#7C6EE8"}}>{customLabel || (lv.badge + " " + lv.label)}</div>
            <button className="mm-btn-ghost" style={{fontSize:11,padding:"4px 10px"}} onClick={() => playAudio(lv.speed)} disabled={playing}>🔊 다시 듣기</button>
          </div>
          <div style={{fontSize:12,fontWeight:800,color:"#2D2B55",marginBottom:12}}>💬 Comprehension</div>
          {loadingComp && <div style={{fontSize:13,color:"#9490B8",padding:"10px 0"}}>⏳ 문제 준비 중...</div>}
          {compQ && !loadingComp && (
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#2D2B55",marginBottom:14,lineHeight:1.5}}>{compQ.question}</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {compQ.options.map((opt,i) => {
                  const isSelected = compAnswer === i;
                  const isChecked = compChecked;
                  const isPerfect = isChecked && isSelected && opt.tier === "perfect";
                  const isOkay = isChecked && isSelected && opt.tier === "okay";
                  const isWrong = isChecked && isSelected && opt.tier === "wrong";
                  return (
                    <button key={i} onClick={() => {
                      if (compChecked) return;
                      setCompAnswer(i);
                      setCompChecked(true);
                      if (opt.tier === "perfect") playSound(true);
                      else if (opt.tier === "wrong") playSound(false);
                      setTimeout(() => setStage("wordtap"), 1000);
                    }}
                    style={{padding:"13px 16px",borderRadius:14,textAlign:"left",cursor:isChecked?"default":"pointer",
                      fontFamily:"'Nunito','Noto Sans KR',sans-serif",fontSize:14,fontWeight:700,
                      border:"2px solid "+(isPerfect?"#06D6A0":isOkay?"#F2B705":isWrong?"#EF233C":"#C4BEFF"),
                      background:isPerfect?"#E8F8F4":isOkay?"#FFFBE8":isWrong?"#FFF0EB":"#FFFFFF",
                      color:isPerfect?"#1E8E78":isOkay?"#B28A00":isWrong?"#B23A3A":"#2D2B55"}}>
                      {isPerfect?"✓ 완벽해요! ":isOkay?"△ 나쁘지 않아요 ":isWrong?"✗ 다시 생각해봐요 ":""}{opt.text}
                    </button>
                  );
                })}
              </div>
              {compChecked && (
                <div style={{marginTop:12,padding:"10px 14px",borderRadius:12,fontSize:12,fontWeight:700,
                  background:compQ.options[compAnswer]?.tier==="perfect"?"#E8F8F4":compQ.options[compAnswer]?.tier==="okay"?"#FFFBE8":"#FFF0EB",
                  color:compQ.options[compAnswer]?.tier==="perfect"?"#1E8E78":compQ.options[compAnswer]?.tier==="okay"?"#B28A00":"#B23A3A"}}>
                  {compQ.options[compAnswer]?.tier==="perfect"?"🎉 정답이에요!":compQ.options[compAnswer]?.tier==="okay"?"💡 맞지만 더 자연스럽게 말할 수 있어요":"❌ 틀렸어요. 다시 들어보세요!"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── WORDTAP stage ──
  if (stage === "wordtap") {
    // Use locked sentence ref to guarantee TTS and words match
    const lockedSent = lockedSentenceRef.current || content.sentence || "";
    const cleanSent = lockedSent.replace(/\{[^}]+\}/g, "");
    const words = cleanSent.split(" ").filter(Boolean).map(w => w.replace(/[^a-zA-Z']/g,"")).filter(Boolean);
    return (
      <WordTapPage
        words={words}
        blanks={content.blanks || []}
        sentence={lockedSentenceRef.current || content.sentence || ""}
        ko={content.ko || ""}
        lv={lv}
        playing={playing}
        playAudio={playAudio}
        blankSelections={blankSelections}
        setBlankSelections={setBlankSelections}
        blankResults={blankResults}
        setBlankResults={setBlankResults}
        checked={checked}
        setChecked={setChecked}
        onBack={() => {
          // Go back to comprehension of same sentence
          setStage("comprehension");
          setBlankSelections({});
          setBlankResults({});
          setChecked(false);
          if (!compQ && content?.sentence) loadComp(content.sentence);
          /*
          if (level > 1) {
            const prev = level - 1;
            setLevel(prev);
            if (levelHistory[prev]) {
              setContent(levelHistory[prev]);
              setLoading(false);
              setStage("listen");
              setListenCount(0);
              setBlankSelections({});
              setBlankResults({});
              setChecked(false);
              setCompQ(null);
              setCompAnswer(null);
              setCompChecked(false);
            } else {
              loadContent(prev);
            }
          } else {
            onBack();
          */
        }}
        onNext={() => {
          setLevel(l => {
            const next = l >= LEVELS.length ? l : l + 1;
            setLevelHistory(h => ({...h, [l]: content}));
            if (l >= LEVELS.length) {
              setShowDiagnosis(true);
              return l;
            }
            loadContent(next);
            return next;
          });
        }}
        nextLabel={level >= LEVELS.length ? "📊 AI 진단" : "다음 →"}
      />
    );
  }

  // ── Diagnosis screen ──
  if (showDiagnosis) {
    return <AIDiagnosisScreen onClose={() => { setShowDiagnosis(false); setLevel(startLevel); loadContent(startLevel); }} />;
  }

  // ── Roleplay stage (situation practice) ──
  if (stage === "roleplay" && topic.context_en) {
    const roleplayTopic = {
      ...topic,
      roleplay_context: topic.context_en,
      counterpart: topic.counterpart || "staff",
    };
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button onClick={() => setStage("interview")} className="mm-btn-back">
            <ArrowLeft size={14}/> 뒤로
          </button>
          <div style={{flex:1,background:"#7C6EE8",borderRadius:12,padding:"8px 14px"}}>
            <div style={{fontSize:11,color:"#C4BEFF",fontWeight:700}}>상황 연습</div>
            <div style={{fontSize:14,fontWeight:900,color:"#fff"}}>{topic.label_ko}</div>
          </div>
        </div>
        <ThemeRoleplayStage topic={roleplayTopic} onDone={() => onBack()} />
      </div>
    );
  }

  return null;
}


function ThemeRoleplayStage({ topic, onDone }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  async function start() {
    setStarted(true);
    setLoading(true);
    const sys = themeRoleplaySystem(topic);
    const reply = await askClaudeText(sys, [{role:"user",content:"Start"}]);
    setMsgs([{role:"assistant",content:reply}]);
    setLoading(false);
  }

  async function send() {
    if (!input.trim() || loading) return;
    const newMsgs = [...msgs, {role:"user",content:input}];
    setMsgs(newMsgs);
    setInput("");
    setLoading(true);
    const sys = themeRoleplaySystem(topic);
    const apiMsgs = newMsgs.map(m => ({role:m.role,content:m.content}));
    const reply = await askClaudeText(sys, apiMsgs);
    setMsgs([...newMsgs, {role:"assistant",content:reply}]);
    setLoading(false);
  }

  if (!started) return (
    <div className="mm-card" style={{textAlign:"center",padding:24}}>
      <div style={{fontSize:32,marginBottom:12}}>🎭</div>
      <div style={{fontSize:15,fontWeight:800,color:"#2D2B55",marginBottom:8}}>{topic.label_ko}</div>
      <div style={{fontSize:12,color:"#9490B8",marginBottom:20}}>{topic.context_en}</div>
      <button className="mm-btn-primary" style={{width:"100%"}} onClick={start}>
        상황 연습 시작하기
      </button>
    </div>
  );

  return (
    <div>
      <div style={{maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
        {msgs.map((m,i) => (
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:16,fontSize:13,lineHeight:1.6,
              background:m.role==="user"?"#7C6EE8":"#F8F7FF",
              color:m.role==="user"?"#fff":"#2D2B55",
              borderBottomRightRadius:m.role==="user"?4:16,
              borderBottomLeftRadius:m.role==="assistant"?4:16}}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{alignSelf:"flex-start",padding:"10px 14px",background:"#F8F7FF",
            borderRadius:16,fontSize:13,color:"#9490B8"}}>
            ...
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="영어로 대답해봐요..."
          style={{flex:1,padding:"10px 14px",borderRadius:20,border:"2px solid #C4BEFF",
            fontSize:13,fontFamily:"'Nunito',sans-serif",outline:"none"}}/>
        <button onClick={send} disabled={loading}
          className="mm-btn-primary" style={{padding:"10px 18px",borderRadius:20}}>
          전송
        </button>
      </div>
      <button onClick={onDone} className="mm-btn-ghost"
        style={{width:"100%",marginTop:12,fontSize:12}}>
        마치기
      </button>
    </div>
  );
}


function AIDiagnosisScreen({ onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { generateReport(); }, []);

  async function generateReport() {
    try {
      const log = JSON.parse(localStorage.getItem("tap_log") || "[]");
      if (log.length < 5) {
        setReport({ summary: "아직 데이터가 부족해요. 더 연습해보세요!", topics: [], studyMap: [] });
        setLoading(false);
        return;
      }

      const wrongWords = log.filter(l => !l.correct).map(l => l.word);
      const res = await askClaudeJSON(
        `You are an English listening coach for Korean learners. Analyse these wrongly tapped words and identify patterns.
Return ONLY valid JSON:
{"summary":"2-3 sentence Korean diagnosis of what the learner struggles with","weaknesses":["weakness 1 in Korean","weakness 2"],"studyMap":[{"type":"Real Life or Scenario","topic":"topic name in Korean","reason":"why in Korean"}]}`,
        `Wrong words: ${wrongWords.slice(-50).join(", ")}`
      );
      setReport(res);
    } catch(e) {
      setReport({ summary: "진단을 불러오지 못했어요.", weaknesses: [], studyMap: [] });
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="mm-card" style={{background:"#2D2B55",color:"#fff",marginBottom:12}}>
        <div style={{fontSize:18,fontWeight:900,marginBottom:4}}>📊 AI 리스닝 진단</div>
        <div style={{fontSize:12,color:"#B8ADFF"}}>지금까지 탭한 단어를 분석했어요</div>
      </div>
      {loading ? (
        <div className="mm-card" style={{textAlign:"center",padding:32}}>
          <div style={{fontSize:32,marginBottom:12}}>🔍</div>
          <div style={{fontSize:14,color:"#7C6EE8",fontWeight:700}}>분석 중이에요...</div>
        </div>
      ) : report && (
        <div>
          <div className="mm-card" style={{marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:800,color:"#7C6EE8",marginBottom:8}}>📝 진단 결과</div>
            <div style={{fontSize:13,color:"#2D2B55",lineHeight:1.6}}>{report.summary}</div>
          </div>
          {report.weaknesses?.length > 0 && (
            <div className="mm-card" style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:800,color:"#EF233C",marginBottom:8}}>⚠️ 약점</div>
              {report.weaknesses.map((w,i) => (
                <div key={i} style={{fontSize:12,color:"#2D2B55",padding:"4px 0",borderBottom:"1px solid #EDE9FF"}}>• {w}</div>
              ))}
            </div>
          )}
          {report.studyMap?.length > 0 && (
            <div className="mm-card" style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:800,color:"#06D6A0",marginBottom:8}}>📚 오늘의 학습 추천</div>
              {report.studyMap.map((s,i) => (
                <div key={i} style={{padding:"8px 0",borderBottom:"1px solid #EDE9FF"}}>
                  <div style={{fontSize:12,fontWeight:800,color:"#7C6EE8"}}>{s.type} — {s.topic}</div>
                  <div style={{fontSize:11,color:"#9490B8"}}>{s.reason}</div>
                </div>
              ))}
            </div>
          )}
          <button className="mm-btn-primary" style={{width:"100%"}} onClick={onClose}>
            다시 연습하기
          </button>
        </div>
      )}
    </div>
  );
}


function SpeakingTab({ goTo, initialTopicId, onTopicLoaded }) {
  const ALL_TOPICS = [
    ...BASIC_SPEAKING_DATA.map(t => ({ ...t, icon: SPEAKING_ICON_MAP[t.icon_name] || BookOpen })),
  ];
  const [levelFilter, setLevelFilter] = useState("전체");
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [openLevel, setOpenLevel] = useState(null);

  useEffect(() => {
    if (initialTopicId) {
      const topic = ALL_TOPICS.find(t => t.id === initialTopicId);
      if (topic) { setSelectedTopic(topic); if (onTopicLoaded) onTopicLoaded(); }
    }
  }, [initialTopicId]);

  if (selectedTopic) {
    return <LessonFlow topic={selectedTopic} onBack={() => setSelectedTopic(null)} goTo={goTo} />;
  }

  const levels = ["기초", "중급", "고급"];

  return (
    <div>
      <div className="mm-card">
        <div style={{fontSize:16,fontWeight:900,color:"#2D2B55",marginBottom:4,fontFamily:"'Nunito',sans-serif"}}>
          Real Life
        </div>
        <div style={{fontSize:12,color:"#9490B8",marginBottom:16}}>내가 하고 싶은 말, 실생활 영어</div>

        {levels.map(lv => {
          const levelColor = lv==="기초"?"#06D6A0":lv==="중급"?"#7C6EE8":"#EF233C";
          const topics = ALL_TOPICS.filter(t => t.level === lv);
          const isOpen = openLevel === lv;
          return (
            <div key={lv} style={{marginBottom:10}}>
              {/* Level header button */}
              <button onClick={() => setOpenLevel(isOpen ? null : lv)}
                style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"12px 16px",borderRadius:14,border:"2px solid #7C6EE8",
                  background:isOpen?"#7C6EE8":"#FFFFFF",cursor:"pointer",
                  fontFamily:"'Nunito','Noto Sans KR',sans-serif"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:isOpen?"#fff":"#7C6EE8"}} />
                  <span style={{fontSize:15,fontWeight:900,color:isOpen?"#fff":"#7C6EE8"}}>{lv}</span>
                  <span style={{fontSize:11,color:isOpen?"rgba(255,255,255,0.7)":"#9490B8"}}>
                    {topics.length}개 토픽
                  </span>
                </div>
                <span style={{fontSize:14,color:isOpen?"#fff":"#7C6EE8"}}>{isOpen?"▲":"▼"}</span>
              </button>

              {/* Topics grid */}
              {isOpen && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                  {topics.map(topic => {
                    const Icon = topic.icon || BookOpen;
                    return (
                      <button key={topic.id} onClick={() => setSelectedTopic(topic)}
                        style={{padding:"14px 12px",borderRadius:14,
                          border:"1.5px solid "+levelColor+"44",
                          background:levelColor+"0D",
                          cursor:"pointer",textAlign:"center",
                          fontFamily:"'Nunito','Noto Sans KR',sans-serif",
                          display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                        <div style={{width:36,height:36,borderRadius:10,background:"#EDE9FF",
                          display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <Icon size={18} color="#7C6EE8" />
                        </div>
                        <div style={{fontSize:11,fontWeight:800,color:"#2D2B55",lineHeight:1.3,
                          textAlign:"center"}}>
                          {topic.label_ko.split(" — ")[0].split("—")[0].trim()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function MapTab({ active, focusAreas, todayVocab, todayPhrases, todayPatterns, hasDiagnosis, section, goTo, mergeTodayContent }) {
  const [showChallenge, setShowChallenge] = useState(null);
  const [subTab, setSubTab] = useState("level"); // level | business | mz | drama

  if (showChallenge) {
    return (
      <ListeningChallenge
        onBack={() => setShowChallenge(null)}
        goTo={goTo}
        customSentences={showChallenge.sentences}
        customLabel={showChallenge.label}
        startLevel={showChallenge.level || 1}
      />
    );
  }

  const TABS_MAP = [
    {id:"level",   label:"일상"},
    {id:"business",label:"비즈니스"},
    {id:"mz",      label:"MZ / GenZ"},
    {id:"drama",   label:"미드"},
  ];

  const LEVELS = [
    {lv:1, label:"Lv 1", desc:"천천히 · 기초"},
    {lv:2, label:"Lv 2", desc:"자연스럽게 · 일상"},
    {lv:3, label:"Lv 3", desc:"살짝 빠름 · 응용"},
    {lv:4, label:"Lv 4", desc:"연음·축약 · 고급"},
    {lv:5, label:"Lv 5", desc:"풀속도 · 원어민"},
  ];

  return (
    <div>
      <div className="mm-card">
        <div style={{fontSize:16,fontWeight:900,color:"#2D2B55",marginBottom:4,fontFamily:"'Nunito',sans-serif"}}>
          🎧 Listen
        </div>
        <div style={{fontSize:12,color:"#9490B8",marginBottom:16}}>레벨별, 상황별 듣기 훈련</div>

        {/* Tabs */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {TABS_MAP.map(t => {
            const isOpen = subTab === t.id;
            return (
              <div key={t.id}>
                <button onClick={() => {
                    if (t.id === "level") {
                      setShowChallenge({sentences:null, label:"일상 듣기", level:1});
                    } else {
                      setSubTab(isOpen ? null : t.id);
                    }
                  }}
                  style={{width:"100%",display:"flex",alignItems:"center",
                    justifyContent:"space-between",padding:"12px 16px",
                    borderRadius:14,border:"2px solid #7C6EE8",
                    background:isOpen?"#7C6EE8":"#FFFFFF",cursor:"pointer",
                    fontFamily:"'Nunito','Noto Sans KR',sans-serif"}}>
                  <span style={{fontSize:14,fontWeight:900,color:isOpen?"#fff":"#2D2B55"}}>
                    {t.label}
                  </span>
                  <ChevronRight size={16} color={isOpen?"#fff":"#7C6EE8"} />
                </button>



                {isOpen && ["business","mz","drama"].includes(t.id) && (
                  <div style={{marginTop:8}}>
                    <VocabListeningChallenge
                      category={t.id}
                      onBack={() => setSubTab(null)}
                      goTo={goTo}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// Stop TTS when page is hidden or closed
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.speechSynthesis.cancel();
  });
  window.addEventListener("beforeunload", () => {
    window.speechSynthesis.cancel();
  });
  window.addEventListener("pagehide", () => {
    window.speechSynthesis.cancel();
  });
}

function MalmunApp() {
  const [activeTab, setActiveTab] = useState("map");

  // Listen for SaveButton "goto my tab" events
  useEffect(() => {
    function handleGotoMy() { setActiveTab("my"); }
    window.addEventListener("malmun-goto-my", handleGotoMy);
    return () => window.removeEventListener("malmun-goto-my", handleGotoMy);
  }, []);
  const [mapSection, setMapSection] = useState("vocab");
  const [diagnosis, setDiagnosis] = useState(null);
  const [focusAreas, setFocusAreas] = useState([]);
  const [todayVocab, setTodayVocab] = useState([]);
  const [todayPhrases, setTodayPhrases] = useState([]);
  const [todayPatterns, setTodayPatterns] = useState([]);

  function mergeTodayContent(result) {
    setFocusAreas((prev) => mergeUniqueStrings(prev, result.focus_areas || []));
    setTodayVocab((prev) => mergeUniqueByKey(prev, result.today_vocab || [], "word", 24));
    setTodayPhrases((prev) => mergeUniqueByKey(prev, result.today_phrases || [], "phrase", 18));
    setTodayPatterns((prev) => mergeUniqueByKey(prev, result.patterns || [], "pattern_en", 12));
  }

  async function saveTodayRecord(result) {
    try {
      await window.storage.set("study-day:" + dateKey(new Date()), JSON.stringify(result), false);
    } catch (e) {
      // storage unavailable — the in-session experience still works fine
    }
  }

  // Rehydrate the accumulated pools from every past study day, so a page
  // refresh doesn't lose what was already learned.
  useEffect(() => {
    (async () => {
      try {
        const listRes = await window.storage.list("study-day:", false);
        const keys = (listRes && listRes.keys) || [];
        const records = await Promise.all(
          keys.map(async (k) => {
            try {
              const res = await window.storage.get(k, false);
              return res ? JSON.parse(res.value) : null;
            } catch (e) {
              return null;
            }
          })
        );
        records.forEach((r) => {
          if (r) mergeTodayContent(r);
        });
      } catch (e) {
        // no storage available — app still works without history
      }
    })();
    // eslint-disable-next-line
  }, []);

  function handleComplete(result) {
    // Latest snapshot drives the result screen and "today's grammar focus" headline.
    setDiagnosis(result);
    // Everything else accumulates across every 오늘의 한마디 session so far,
    // so Your English Map keeps growing instead of resetting each time.
    mergeTodayContent(result);
    saveTodayRecord(result);
  }

  function handleReset() {
    // Starting a new 오늘의 한마디 round shouldn't wipe the learner's accumulated
    // map — only the local question flow resets (handled inside DiagnoseTab).
  }

  const [pendingSpeakingTopicId, setPendingSpeakingTopicId] = useState(null);
  const [pendingSituationId, setPendingSituationId] = useState(null);

  function goTo(tabId, section) {
    if (tabId === "speaking" && section && section !== "vocab") {
      setPendingSpeakingTopicId(section);
    } else if (tabId === "situation" && section) {
      setPendingSituationId(section);
    } else if (section) {
      setMapSection(section);
    }
    window.speechSynthesis.cancel();
    setActiveTab(tabId);
  }

  return (
    <div className="mm-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&family=Noto+Sans+KR:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap');

        .mm-root {
          min-height: 100vh;
          background: linear-gradient(180deg, #0E1526 0%, #16203A 55%, #1B2747 100%);
          font-family: 'Noto Sans KR', sans-serif;
          color: #EDEAE0;
          padding: 24px 16px 60px;
        }
        .mm-serif { font-family: 'Noto Serif KR', serif; }
        .mm-mono { font-family: 'JetBrains Mono', monospace; }
        .mm-muted { color: #3D4560; font-weight: 600; }

        .mm-header { max-width: 720px; margin: 0 auto 20px; }
        .mm-brand-row { display: flex; align-items: center; gap: 10px; }
        .mm-brand-title { font-size: 26px; font-weight: 900; margin: 0; }
        .mm-tagline { color: #C8AE63; margin: 2px 0 0; font-size: 13px; }

        .mm-tabbar {
          max-width: 720px; margin: 18px auto 18px;
          display: flex; overflow-x: auto; gap: 2px;
          border-bottom: 1px solid rgba(242,183,5,0.18);
        }
        .mm-tabbar::-webkit-scrollbar { display: none; }
        .mm-tab-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 14px; white-space: nowrap;
          background: none; border: none; cursor: pointer;
          font-family: 'Noto Sans KR', sans-serif; font-size: 14px; font-weight: 600;
          color: #9490B8; border-bottom: 2px solid transparent;
          transition: color 150ms ease, border-color 150ms ease;
        }
        .mm-tab-btn + .mm-tab-btn { border-left: 1px solid rgba(242,183,5,0.12); }
        .mm-tab-btn.mm-active { color: #B8ADFF; border-bottom: 2px solid #B8ADFF; }
        .mm-tab-btn:hover { color: #7C6EE8; }

        .mm-content { max-width: 720px; margin: 0 auto; }

        .mm-card {
          background: #FFFFFF; color: #2D2B55;
          border-radius: 20px; padding: 20px 18px;
          box-shadow: 0 2px 12px rgba(124,110,232,0.08), 0 1px 3px rgba(0,0,0,0.06);
          border: 1px solid #F0EEFF;
          animation: mmFadeUp 300ms ease both;
        }
        @keyframes mmFadeUp { from { opacity: 0; transform: translateY(8px);} to { opacity: 1; transform: translateY(0);} }

        .mm-flex-center { display: flex; align-items: center; justify-content: center; }
        .mm-col { display: flex; flex-direction: column; }
        .mm-row { display: flex; align-items: center; }
        .mm-space-between { justify-content: space-between; }

        .mm-btn-primary {
          display: inline-flex; align-items: center; gap: 6px; justify-content: center;
          background: #7C6EE8; color: #FFFFFF; font-weight: 800; font-size: 14px;
          border: none; border-radius: 14px; padding: 13px 22px; cursor: pointer;
          transition: all 0.15s ease; letter-spacing: 0.01em;
          font-family: 'Nunito','Noto Sans KR',sans-serif;
        }
        .mm-btn-primary:hover { background: #6B5DD3; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(124,110,232,0.3); }
        .mm-btn-primary:active { transform: translateY(0); }
        .mm-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }

        .mm-btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          background: #F8F7FF; color: #7C6EE8; font-size: 13px; font-weight: 700;
          border: 1.5px solid #DDD8FF; border-radius: 14px; padding: 9px 16px; cursor: pointer;
          transition: all 0.15s; font-family: 'Nunito','Noto Sans KR',sans-serif;
        }
        .mm-btn-ghost:hover { background: #EDE9FF; border-color: #7C6EE8; transform: translateY(-1px); }

        .mm-btn-back {
          display: inline-flex; align-items: center; gap: 6px;
          background: transparent; color: #9490B8; font-size: 13px; font-weight: 700;
          border: 1.5px solid #E8E4FF; border-radius: 12px; padding: 8px 14px; cursor: pointer;
          margin-bottom: 12px; transition: all 0.15s;
          font-family: 'Nunito','Noto Sans KR',sans-serif;
        }
        .mm-btn-back:hover { color: #7C6EE8; border-color: #7C6EE8; background: #F8F7FF; }

        .mm-btn-icon {
          display: flex; align-items: center; justify-content: center;
          width: 40px; height: 40px; border-radius: 12px; border: none;
          background: #EDE9FF; color: #7C6EE8; cursor: pointer; flex-shrink: 0;
          transition: all 0.15s;
        }
        .mm-btn-icon:hover { background: #7C6EE8; color: #fff; }
        .mm-btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }

        .mm-chat-scroll { flex: 1; overflow-y: auto; max-height: 360px; padding: 4px 2px 10px; }
        .mm-bubble-ai, .mm-bubble-user {
          max-width: 78%; padding: 10px 14px; border-radius: 16px; margin: 6px 0;
          font-size: 14px; line-height: 1.55; white-space: pre-wrap;
        }
        .mm-bubble-ai { background: #F8F7FF; color: #2D2B55; border: 1px solid #EDE9FF; border-bottom-left-radius: 4px; }
        .mm-bubble-user { background: #7C6EE8; color: #FFFFFF; margin-left: auto; border-bottom-right-radius: 4px; font-weight: 600; }

        .mm-input-row { display: flex; gap: 8px; margin-top: 10px; }
        .mm-input {
          flex: 1; border: 1.5px solid #E8E4FF; border-radius: 14px; padding: 11px 15px;
          font-size: 14px; font-family: 'Noto Sans KR', sans-serif; background: #FDFCFF; color: #2D2B55;
          transition: border-color 0.15s;
        }
        .mm-input:focus, .mm-textarea:focus { outline: none; border-color: #7C6EE8; box-shadow: 0 0 0 3px rgba(124,110,232,0.1); }

        .mm-textarea {
          width: 100%; border: 1.5px solid #E8E4FF; border-radius: 14px; padding: 12px 15px;
          font-size: 14px; font-family: 'Noto Sans KR', sans-serif; color: #2D2B55;
          margin: 10px 0; resize: vertical; background: #FDFCFF;
          transition: border-color 0.15s;
        }

        .mm-section-title { font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #9490B8; margin: 20px 0 8px; }

        .mm-correction-card { background: #F8F8FC; border-radius: 12px; padding: 12px 14px; }
        .mm-original { color: #B23A3A; font-size: 13px; text-decoration: line-through; display: flex; gap: 6px; align-items: flex-start; }
        .mm-fixed { color: #2D2B55; font-weight: 600; font-size: 14px; display: flex; gap: 6px; align-items: flex-start; margin-top: 3px; }
        .mm-note { color: #3D4560; font-size: 13px; margin-top: 4px; }

        .mm-explain-box { background: #F8F8FC; border-left: 3px solid #9B8EF5; padding: 12px 14px; border-radius: 0 10px 10px 0; font-size: 14px; }

        .mm-plan-step { display: flex; gap: 12px; padding: 10px 0; border-top: 1px dashed #C4BEFF; }
        .mm-plan-step:first-child { border-top: none; }
        .mm-plan-num { width: 24px; height: 24px; border-radius: 50%; background: #2D2B55; color: #B8ADFF; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }

        .mm-chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .mm-chip {
          background: #F8F8FC; border: none; border-radius: 999px; padding: 6px 12px;
          font-size: 12px; color: #6B5B2A; cursor: pointer; font-weight: 600;
        }
        .mm-chip-button { background: #2D2B55; color: #FFFFFF; padding: 9px 16px; font-size: 13px; }
        .mm-chip-button:hover { background: #7C6EE8; color: #16203A; }

        .mm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin-top: 12px; }
        .mm-flashcard {
          background: #2D2B55; color: #FFFFFF; border-radius: 14px; padding: 16px 12px;
          min-height: 100px; display: flex; align-items: center; justify-content: center; text-align: center;
          cursor: pointer; transition: transform 200ms ease; flex-direction: column; gap: 4px;
        }
        .mm-flashcard.mm-flipped { background: #F8F8FC; color: #2D2B55; }
        .mm-flashcard:hover { transform: translateY(-2px); }
        .mm-flashcard-face { display: flex; flex-direction: column; align-items: center; gap: 4px; }

        .mm-grammar-card { background: #F8F8FC; border-radius: 12px; padding: 14px 16px; }

        .mm-theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 12px; margin-top: 14px; }
        .mm-theme-card {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          background: #F8F8FC; border: none; border-radius: 16px; padding: 16px 10px;
          cursor: pointer; font-family: 'Noto Sans KR', sans-serif; font-size: 13px; font-weight: 700;
          color: #2D2B55; text-align: center; transition: transform 150ms ease;
        }
        .mm-theme-card:hover { transform: translateY(-3px); }

        .mm-scene-card {
          position: relative; width: 64px; height: 64px; border-radius: 16px;
          background: linear-gradient(145deg, #2D2B55 0%, #2B3A63 100%);
          display: flex; align-items: center; justify-content: center;
        }
        .mm-scene-badge {
          position: absolute; bottom: -6px; right: -6px; width: 24px; height: 24px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          border: 2px solid #FFFFFF;
        }

        .mm-situation-box { background: #F8F8FC; border-radius: 14px; padding: 16px; margin-top: 12px; }

        .mm-round-dots { display: flex; gap: 6px; }
        .mm-dot { width: 8px; height: 8px; border-radius: 50%; background: #C4BEFF; }
        .mm-dot-filled { background: #7C6EE8; }

        .mm-stepper { display: flex; gap: 6px; margin: 14px 0 16px; }
        .mm-step {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 8px 4px; border-radius: 10px; background: #F8F8FC; color: #9490B8;
          font-size: 11px; font-weight: 700; text-align: center;
        }
        .mm-step-active { background: #2D2B55; color: #B8ADFF; }
        .mm-step-done { color: #9B8EF5; }

        .mm-video-wrap { position: relative; width: 100%; padding-top: 56.25%; border-radius: 14px; overflow: hidden; background: #000; }
        .mm-video-wrap iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }

        .mm-quiz-q { background: #F8F8FC; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
        .mm-quiz-option {
          display: block; width: 100%; text-align: left; background: #fff; border: 1px solid #C4BEFF;
          border-radius: 10px; padding: 9px 12px; margin-top: 6px; cursor: pointer; font-size: 14px; color: #2D2B55;
          font-family: 'Noto Sans KR', sans-serif;
        }
        .mm-quiz-option:hover:not(:disabled) { border-color: #2D2B55; }
        .mm-quiz-option:disabled { cursor: default; }
        .mm-quiz-option-correct { background: #DFF5F0; border-color: #9B8EF5; font-weight: 700; }
        .mm-quiz-option-wrong { background: #FBE7E4; border-color: #D64545; }

        .mm-gap8 { gap: 8px; }
        .mm-emoji-badge {
          width: 56px; height: 56px; border-radius: 16px;
          background: linear-gradient(145deg, #2D2B55 0%, #2B3A63 100%);
          display: flex; align-items: center; justify-content: center; font-size: 24px;
        }
        .mm-card-row { background: #F8F8FC; border-radius: 12px; padding: 12px 14px; margin-bottom: 0; }
        .mm-upload-area {
          margin-top: 12px; border: 2px dashed #C4BEFF; border-radius: 14px; padding: 22px 14px;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          color: #9490B8; font-size: 13px; cursor: pointer; transition: border-color 0.15s, background 0.15s;
        }
        .mm-upload-area:hover { border-color: #7C6EE8; background: #FFFFFF; }
        .mm-upload-thumbs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .mm-upload-thumb { position: relative; width: 68px; height: 68px; border-radius: 10px; overflow: hidden; }
        .mm-upload-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .mm-upload-thumb button {
          position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%;
          background: rgba(28,37,65,0.75); color: #fff; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center; padding: 0;
        }
        .mm-worksheet-row {
          display: flex; align-items: center; gap: 10px; width: 100%; border: none;
          cursor: pointer; font-family: 'Noto Sans KR', sans-serif; text-align: left;
        }
        .mm-worksheet-row:hover { background: #E8E0CC; }

        .mm-play-circle {
          width: 84px; height: 84px; border-radius: 50%; border: none; cursor: pointer;
          background: #2D2B55; color: #B8ADFF; display: flex; align-items: center; justify-content: center;
          margin: 6px auto;
        }
        .mm-play-circle:disabled { opacity: 0.6; cursor: not-allowed; }
        .mm-play-circle-sm { width: 56px; height: 56px; }

        .mm-speed-pills { display: flex; gap: 6px; justify-content: center; margin: 14px 0; }
        .mm-speed-pill {
          background: #F8F8FC; border: none; border-radius: 999px; padding: 7px 14px;
          font-size: 12px; font-weight: 700; color: #7B77A0; cursor: pointer;
          font-family: 'Noto Sans KR', sans-serif;
        }
        .mm-speed-pill-active { background: #2D2B55; color: #B8ADFF; }

        .mm-script-box { background: #F8F8FC; border-radius: 14px; padding: 14px 16px; margin-top: 10px; }
        .mm-script-line { padding: 6px 4px; border-radius: 8px; font-size: 14px; }
        .mm-script-line-active { background: #FFE3D6; font-weight: 700; }
        .mm-script-speaker { font-family: 'JetBrains Mono', monospace; color: #3D4560; font-size: 13px; margin-right: 6px; }

        .mm-chunk-box { background: #F8F8FC; border-radius: 14px; padding: 18px 16px; text-align: center; margin-top: 10px; }
        .mm-chunk-text { font-size: 18px; font-weight: 700; margin: 8px 0; }
        .mm-countdown { font-size: 13px; color: #B8893F; font-weight: 700; min-height: 18px; margin-top: 8px; }

        .mm-blank-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
        .mm-blank-input {
          border: 1px solid #C4BEFF; border-radius: 10px; padding: 8px 12px; font-size: 14px;
          font-family: 'Noto Sans KR', sans-serif; color: #2D2B55; flex: 1; min-width: 140px;
        }
        .mm-correct-mark { color: #1E8E78; font-weight: 700; font-size: 13px; }
        .mm-wrong-mark { color: #B23A3A; font-weight: 700; font-size: 13px; }

        .mm-speak-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 50%; border: none;
          background: rgba(28,37,65,0.08); color: #2D2B55; cursor: pointer; flex-shrink: 0;
        }
        .mm-speak-btn:hover { background: #2D2B55; color: #B8ADFF; }

        .mm-mic-btn {
          display: flex; align-items: center; justify-content: center;
          width: 40px; height: 40px; border-radius: 12px; border: none;
          background: #F8F8FC; color: #2D2B55; cursor: pointer; flex-shrink: 0;
        }
        .mm-mic-active { background: #D64545; color: #fff; animation: mmPulse 1.2s ease-in-out infinite; }
        @keyframes mmPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

        .mm-today-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .mm-today-pill {
          display: inline-flex; align-items: center; gap: 6px;
          background: #FFE9DC; border-radius: 999px; padding: 6px 12px; font-size: 13px;
        }

        .mm-make-sentence { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #C4BEFF; text-align: left; }
        .mm-input-sm { font-size: 13px; padding: 7px 11px; }
        .mm-sentence-feedback { font-size: 14px; margin-top: 6px; }
        .mm-sentence-good { color: #1E8E78; }
        .mm-sentence-fix { color: #8A6A1E; }

        .mm-map-subnav { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
        .mm-map-subnav-btn {
          display: inline-flex; align-items: center; gap: 5px;
          background: #F8F8FC; border: none; border-radius: 999px; padding: 8px 14px;
          font-size: 13px; font-weight: 700; color: #7B77A0; cursor: pointer;
          font-family: 'Noto Sans KR', sans-serif;
        }
        .mm-map-subnav-active { background: #2D2B55; color: #B8ADFF; }

        .mm-theme-stage-tabs { display: flex; border-radius: 10px; overflow: hidden; border: 1px solid #C4BEFF; margin-bottom: 14px; }
        .mm-theme-stage-tab { flex: 1; padding: 9px 4px; font-size: 13px; font-family: 'Noto Sans KR', sans-serif; border: none; border-right: 1px solid #C4BEFF; background: #F8F8FC; color: #9490B8; cursor: pointer; }
        .mm-theme-stage-tab:last-child { border-right: none; }
        .mm-theme-stage-tab:hover:not(.mm-theme-stage-active) { background: #E8E0CC; color: #2D2B55; }
        .mm-theme-stage-active { background: #2D2B55; color: #FFFFFF; font-weight: 700; }

        .mm-map-tile { background: #F8F8FC; border-radius: 12px; padding: 12px 14px; border: none; cursor: pointer; transition: background 0.13s; font-family: 'Noto Sans KR', sans-serif; }
        .mm-map-tile:hover { background: #E8E0CC; }
        .mm-map-tile-wide { display: block; width: 100%; text-align: left; }
        .mm-map-tile-active { background: #2D2B55; color: #FFFFFF; }
        .mm-map-tile-active .mm-muted { color: #3D4560; font-weight: 600; }

        .mm-word-chip { background: #FFFFFF; border: 1.5px solid #C4BEFF; border-radius: 8px; padding: 6px 12px; font-size: 14px; cursor: pointer; font-family: 'Noto Sans KR', sans-serif; color: #2D2B55; transition: all 0.12s; }
        .mm-word-chip:hover:not(:disabled) { background: #F8F8FC; border-color: #B8ADFF; }
        .mm-word-chip-selected { background: #2D2B55; color: #FFFFFF; border-color: #2D2B55; }
        .mm-word-chip:disabled { opacity: 0.6; cursor: default; }

        .mm-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: 12px; }
        .mm-calendar-weekday { text-align: center; font-size: 13px; color: #3D4560; font-weight: 700; padding-bottom: 4px; }
        .mm-calendar-cell {
          position: relative; aspect-ratio: 1; border: none; border-radius: 10px;
          background: #F8F8FC; color: #2D2B55; font-size: 13px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Noto Sans KR', sans-serif;
        }
        .mm-calendar-cell:hover:not(:disabled) { background: #E8E0CC; }
        .mm-calendar-empty { background: transparent; cursor: default; }
        .mm-calendar-today { box-shadow: inset 0 0 0 2px #7C6EE8; font-weight: 700; }
        .mm-calendar-selected { background: #2D2B55; color: #FFFFFF; }
        .mm-calendar-disabled { opacity: 0.3; cursor: not-allowed; }
        .mm-calendar-dot { position: absolute; bottom: 5px; width: 5px; height: 5px; border-radius: 50%; background: #B8ADFF; }
        .mm-calendar-detail { margin-top: 14px; border-top: 1px dashed #C4BEFF; padding-top: 4px; min-height: 40px; }

        .mm-error-box { background: #FBE7E4; color: #8A2D2D; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }

        .mm-gate-wrap { position: relative; overflow: hidden; border-radius: 18px; }
        .mm-gate-panel { position: absolute; top: 0; bottom: 0; width: 50%; background: #0E1526; z-index: 10; transition: transform 900ms cubic-bezier(.65,0,.35,1); }
        .mm-gate-left { left: 0; }
        .mm-gate-right { right: 0; }
        .mm-gate-open .mm-gate-left { transform: translateX(-100%); }
        .mm-gate-open .mm-gate-right { transform: translateX(100%); }
        .mm-dawn-flash {
          position: absolute; top: 50%; left: 50%; width: 120px; height: 120px; border-radius: 9999px;
          background: radial-gradient(circle, #B8ADFF 0%, rgba(242,183,5,0) 70%);
          transform: translate(-50%, -50%); animation: mmDawnFlash 1100ms ease-out forwards; z-index: 5; pointer-events: none;
        }
        @keyframes mmDawnFlash { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.3);} 30% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%,-50%) scale(2.4);} }

        .mm-footnote { text-align: center; color: #3D4560; font-size: 13px; max-width: 720px; margin: 28px auto 0; }

        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div className="mm-header">
        <div className="mm-brand-row">
          <GateMark />
          <h1 className="mm-serif mm-brand-title">왜 안들려</h1>
        </div>
        <p className="mm-tagline">영어가 트이는 순간 · AI 영어 스피킹 코치</p>
      </div>

      <div className="mm-tabbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={"mm-tab-btn " + (activeTab === t.id ? "mm-active" : "")}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mm-content">
        <div style={{ display: activeTab === "map" ? "block" : "none" }}>
          <MapTab
            active={activeTab === "map"}
            focusAreas={focusAreas}
            todayVocab={todayVocab}
            todayPhrases={todayPhrases}
            todayPatterns={todayPatterns}
            hasDiagnosis={!!diagnosis}
            section={mapSection}
            goTo={goTo}
            mergeTodayContent={mergeTodayContent}
          />
        </div>
        <div style={{ display: activeTab === "situation" ? "block" : "none" }}>
          <SituationTalkTab goTo={goTo}
            initialSituationId={pendingSituationId}
            onSituationLoaded={() => setPendingSituationId(null)} />
        </div>
        <div style={{ display: activeTab === "speaking" ? "block" : "none" }}>
          <SpeakingTab goTo={goTo} initialTopicId={pendingSpeakingTopicId} onTopicLoaded={() => setPendingSpeakingTopicId(null)} />
        </div>
        <div style={{ display: activeTab === "my" ? "block" : "none" }}>
          <MyTab active={activeTab === "my"} />
        </div>
      </div>

      <p className="mm-footnote">
        © 2025 왜 안들려 English Coach. All rights reserved.<br/>
        본 앱의 모든 콘텐츠(문장, 표현, 패턴, 설명)는 저작권법에 의해 보호됩니다.<br/>
        무단 복제, 배포, 공유를 금지합니다.
      </p>
      <p className="mm-footnote">© 왜 안들려 English Coach — 모든 학습 자료의 저작권은 원 저작자에게 있으며 무단 복제·도용을 금합니다.<br/>* 학습 달력 기록은 저장돼서 새로고침해도 남아있어요. 대화 화면(채팅 내용)은 새로고침하면 초기화돼요.</p>
    </div>
  );
}
// ── 온보딩 ──
function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(0); // 0: welcome, 1: name, 2: level test, 3: result
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(0);

  const LEVEL_Q = [
    { q: "What does 'run out of' mean?", opts: ["도망치다","다 떨어지다","달리다","뛰어나오다"], ans: 1 },
    { q: "I've been _____ for 10 minutes.", opts: ["wait","waited","waiting","waits"], ans: 2 },
    { q: "She ___ so annoyed when he interrupts.", opts: ["get","gets","got","getting"], ans: 1 },
  ];

  function pickLevel(sc) {
    if (sc === 3) return "Lv3";
    if (sc === 2) return "Lv2";
    return "Lv1";
  }

  function answerQ(i) {
    const correct = i === LEVEL_Q[answers.length].ans;
    const newAnswers = [...answers, i];
    const newScore = score + (correct ? 1 : 0);
    setAnswers(newAnswers);
    setScore(newScore);
    if (newAnswers.length === LEVEL_Q.length) {
      setTimeout(() => setStep(3), 400);
    }
  }

  const recLevel = pickLevel(score);

  if (step === 0) return (
    <div style={{ minHeight:"100vh", background:"#FFFFFF", display:"flex",
      flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ fontSize:72, marginBottom:16, animation:"float 2s ease-in-out infinite" }}>🎧</div>
      <h1 style={{ fontSize:28, fontWeight:900, color:"#7C6EE8", textAlign:"center",
        fontFamily:"'Nunito',sans-serif", marginBottom:8 }}>왜 안들려</h1>
      <p style={{ fontSize:15, color:"#9490B8", textAlign:"center", fontWeight:700,
        fontFamily:"'Nunito','Noto Sans KR',sans-serif", marginBottom:8, lineHeight:1.6 }}>
        단어는 아는데 왜 안 들릴까요?
      </p>
      <p style={{ fontSize:13, color:"#B8B4D8", textAlign:"center",
        fontFamily:"'Nunito','Noto Sans KR',sans-serif", marginBottom:40, lineHeight:1.6 }}>
        원어민처럼 듣고 말하는 비법을 알려드려요
      </p>
      <button onClick={() => setStep(1)}
        style={{ background:"#7C6EE8", color:"#fff", border:"none", borderRadius:20,
          padding:"16px 48px", fontSize:17, fontWeight:900, cursor:"pointer",
          fontFamily:"'Nunito',sans-serif", width:"100%", maxWidth:320 }}>
        시작하기 →
      </button>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`}</style>
    </div>
  );

  if (step === 1) return (
    <div style={{ minHeight:"100vh", background:"#FFFFFF", display:"flex",
      flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ fontSize:48, marginBottom:16 }}>👋</div>
      <h2 style={{ fontSize:24, fontWeight:900, color:"#2D2B55", textAlign:"center",
        fontFamily:"'Nunito',sans-serif", marginBottom:8 }}>안녕하세요!</h2>
      <p style={{ fontSize:14, color:"#9490B8", textAlign:"center", fontWeight:700,
        fontFamily:"'Nunito','Noto Sans KR',sans-serif", marginBottom:32 }}>
        이름이 뭐예요?
      </p>
      <input value={name} onChange={e => setName(e.target.value)}
        placeholder="이름 입력"
        style={{ width:"100%", maxWidth:320, padding:"14px 18px", borderRadius:16,
          border:"2px solid #C4BEFF", fontSize:16, fontWeight:700, outline:"none",
          fontFamily:"'Nunito','Noto Sans KR',sans-serif", color:"#2D2B55",
          marginBottom:16, textAlign:"center" }} />
      <button onClick={() => { if(name.trim()) setStep(2); }}
        disabled={!name.trim()}
        style={{ background: name.trim() ? "#7C6EE8" : "#C4BEFF", color:"#fff",
          border:"none", borderRadius:20, padding:"14px 48px",
          fontSize:16, fontWeight:900, cursor: name.trim() ? "pointer" : "not-allowed",
          fontFamily:"'Nunito',sans-serif", width:"100%", maxWidth:320 }}>
        다음 →
      </button>
    </div>
  );

  if (step === 2) return (
    <div style={{ minHeight:"100vh", background:"#FFFFFF", padding:24,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:360 }}>
        <div style={{ fontSize:12, fontWeight:800, color:"#9490B8", textAlign:"center",
          marginBottom:8, fontFamily:"'Nunito',sans-serif", letterSpacing:1 }}>
          레벨 체크 {answers.length + 1} / {LEVEL_Q.length}
        </div>
        <div style={{ height:8, background:"#EDE9FF", borderRadius:8, marginBottom:24, overflow:"hidden" }}>
          <div style={{ height:"100%", background:"#7C6EE8", borderRadius:8,
            width:`${(answers.length/LEVEL_Q.length)*100}%`, transition:"width 0.3s" }} />
        </div>
        <div style={{ background:"#F8F7FF", borderRadius:20, padding:20, marginBottom:20,
          border:"2px solid #EDE9FF" }}>
          <div style={{ fontSize:16, fontWeight:800, color:"#2D2B55", lineHeight:1.5,
            fontFamily:"'Nunito',sans-serif", marginBottom:20 }}>
            {LEVEL_Q[answers.length].q}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {LEVEL_Q[answers.length].opts.map((opt, i) => (
              <button key={i} onClick={() => answerQ(i)}
                style={{ padding:"12px 16px", borderRadius:14, border:"2px solid #C4BEFF",
                  background:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", textAlign:"left",
                  fontFamily:"'Nunito','Noto Sans KR',sans-serif", color:"#2D2B55",
                  transition:"all 0.15s" }}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (step === 3) return (
    <div style={{ minHeight:"100vh", background:"#FFFFFF", display:"flex",
      flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ fontSize:64, marginBottom:16 }}>
        {score === 3 ? "🎉" : score === 2 ? "😊" : "💪"}
      </div>
      <h2 style={{ fontSize:24, fontWeight:900, color:"#2D2B55", textAlign:"center",
        fontFamily:"'Nunito',sans-serif", marginBottom:8 }}>
        {name}님은 {recLevel} 추천이에요!
      </h2>
      <p style={{ fontSize:14, color:"#9490B8", textAlign:"center", fontWeight:700,
        fontFamily:"'Nunito','Noto Sans KR',sans-serif", marginBottom:8 }}>
        {score}/3 정답
      </p>
      <p style={{ fontSize:13, color:"#B8B4D8", textAlign:"center",
        fontFamily:"'Nunito','Noto Sans KR',sans-serif", marginBottom:32, lineHeight:1.7 }}>
        {score === 3 ? "대단해요! 중급 이상 도전해봐요 🔥" :
         score === 2 ? "잘 하셨어요! 차근차근 올라가봐요 😊" :
         "걱정 마세요! 기초부터 탄탄하게 쌓아봐요 💜"}
      </p>
      <button onClick={() => onComplete(name, recLevel)}
        style={{ background:"#7C6EE8", color:"#fff", border:"none", borderRadius:20,
          padding:"16px 48px", fontSize:16, fontWeight:900, cursor:"pointer",
          fontFamily:"'Nunito',sans-serif", width:"100%", maxWidth:320 }}>
        학습 시작하기 🎧
      </button>
    </div>
  );
}

// ── 스트릭 배지 ──
function StreakBadge({ streak, xp }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setShow(s => !s)}
        style={{ display:"flex", alignItems:"center", gap:5, background:"#FFF3EB",
          border:"1.5px solid #F77F00", borderRadius:20, padding:"5px 12px",
          cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
        <span style={{ fontSize:16 }}>🔥</span>
        <span style={{ fontSize:13, fontWeight:900, color:"#F77F00" }}>{streak}</span>
      </button>
      {show && (
        <div style={{ position:"absolute", top:38, right:0, background:"#fff",
          borderRadius:16, padding:16, border:"2px solid #EDE9FF", zIndex:50,
          minWidth:180, boxShadow:"0 4px 20px rgba(124,110,232,0.15)" }}>
          <div style={{ fontSize:12, fontWeight:800, color:"#9490B8", marginBottom:8,
            fontFamily:"'Nunito',sans-serif" }}>나의 학습 현황</div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontSize:24 }}>🔥</span>
            <div>
              <div style={{ fontSize:18, fontWeight:900, color:"#F77F00",
                fontFamily:"'Nunito',sans-serif" }}>{streak}일 연속!</div>
              <div style={{ fontSize:11, color:"#9490B8", fontFamily:"'Nunito',sans-serif" }}>오늘도 학습했어요</div>
            </div>
          </div>
          <div style={{ height:1, background:"#EDE9FF", margin:"8px 0" }} />
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:20 }}>⭐</span>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:"#7C6EE8",
                fontFamily:"'Nunito',sans-serif" }}>{xp} XP</div>
              <div style={{ fontSize:11, color:"#9490B8", fontFamily:"'Nunito',sans-serif" }}>누적 경험치</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



export default MalmunApp;
