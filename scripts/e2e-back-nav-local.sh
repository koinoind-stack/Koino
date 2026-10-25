#!/bin/bash
# Task 122 — LOCAL E2E of "Back to Bible Comics" navigation.
# Matrix: button visibility/position/size, library round-trip, state
# preservation (search), Genesis 1 + Matthew 1, deep-link arrival,
# browser-back regression, mobile 390x844 geometry, no overlap with
# fixed header / bottom nav, preservation of progress/TTS/quiz/share.
# Server + assertions must happen in THIS single invocation.
set -u
cd /home/z/my-project/koino-live

FIX=/home/z/my-project/tmp/fixtures
PORT=3112
BASE="http://127.0.0.1:$PORT"
PASS=0; FAIL=0

field() { # json path.with.dots → value
  node -e "let v;try{v=JSON.parse(process.argv[1])}catch{v={}};for(const k of String(process.argv[2]).split('.')){v=(v&&typeof v==='object'&&v[k]!==undefined)?v[k]:undefined}console.log(String(v===undefined?'∅':v))" "$1" "$2"
}

check() { # label actual expected
  if [ "$2" = "$3" ]; then echo "PASS  $1"; PASS=$((PASS+1));
  else echo "FAIL  $1  (got: $2 | want: $3)"; FAIL=$((FAIL+1)); fi
}

numcheck() { # label a b expr(a,b)->bool
  if node -e "const [a,b]=[Number(process.argv[1]),Number(process.argv[2])];process.exit(($3)?0:1)" "$2" "$3_" 2>/dev/null; then :; fi
}

assert_f() { # label json key op value (eq|true|null|ge|le)
  local label="$1" s="$2" key="$3" op="$4" val="$5" got ok=0
  got=$(field "$s" "$key")
  case "$op" in
    eq)   [ "$got" = "$val" ] && ok=1 ;;
    true) [ "$got" = "true" ] && ok=1 ;;
    null) [ "$got" = "null" ] && ok=1 ;;
    ge)   node -e "process.exit(Number(process.argv[1])>=Number(process.argv[2])?0:1)" "$got" "$val" 2>/dev/null && ok=1 ;;
    le)   node -e "process.exit(Number(process.argv[1])<=Number(process.argv[2])?0:1)" "$got" "$val" 2>/dev/null && ok=1 ;;
  esac
  if [ $ok = 1 ]; then echo "PASS  $label"; PASS=$((PASS+1));
  else echo "FAIL  $label  (got: $got | want: $op $val)"; FAIL=$((FAIL+1)); fi
}

state() {
  local raw unq
  raw=$(agent-browser eval "(() => JSON.stringify({
    url: location.search,
    reader: !!Array.from(document.querySelectorAll('p')).find(p => p.textContent==='BIBLE COMICS'),
    panels: document.querySelectorAll('[data-comic-panel]').length,
    lib: !!document.querySelector('input[placeholder*=earch]'),
    searchVal: (document.querySelector('input[placeholder*=earch]')||{}).value || '',
    backBtn: (() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').includes('Back to Bible Comics')); if (!b) return null; const r = b.getBoundingClientRect(); return { h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), vis: r.width>0 && r.height>0, free: (() => { const c=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return !!c && (c===b || b.contains(c)); })() }; })(),
    h1: (() => { const h = Array.from(document.querySelectorAll('h1')).find(x => /^(Genesis|Matthew) /.test((x.textContent||'').trim())); if (!h) return null; return { top: Math.round(h.getBoundingClientRect().top), text: (h.textContent||'').trim() }; })(),
    allLink: (() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').includes('All Comics')); if (!b) return null; return Math.round(b.getBoundingClientRect().height); })(),
    navTop: (() => { const n = document.querySelector('nav[class*=bottom-4]'); if (!n) return null; return Math.round(n.getBoundingClientRect().top); })(),
    listen: !!Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').includes('Listen')),
    quiz: !!Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').includes('Quiz')),
    share: !!Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').includes('Share Chapter')),
    progress: !!document.querySelector('div.h-1.rounded-full'),
    narr: !!document.getElementById('narration-MAT1-P01') || !!document.getElementById('narration-GEN1-P01')
  }))()" 2>/dev/null)
  unq=${raw#\"}; unq=${unq%\"}
  printf '%s' "${unq//\\\"/\"}"
}

click_btn() { # text → click first matching button
  agent-browser eval "(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').includes('$1')); b && b.click(); return 1; })()" > /dev/null 2>&1
}

set_search() { # value
  agent-browser eval "(() => { const inp = document.querySelector('input[placeholder*=earch]'); if (!inp) return 0; const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(inp,'$1'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()" > /dev/null 2>&1
}

# ── start standalone server ──
NEXT_PUBLIC_SUPABASE_URL="https://irzkwtrawvtqfpbyapzx.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$(cat /tmp/sb_anon)" \
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
PORT=$PORT HOSTNAME=127.0.0.1 \
  nohup npm run start > /tmp/local-server-backnav.log 2>&1 &
SRV_PID=$!
trap 'pkill -f "standalone/server.js" 2>/dev/null' EXIT

code=000
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/" 2>/dev/null || echo 000)
  [ "$code" != "000" ] && [ -n "$code" ] && break
  sleep 1
done
if [ "$code" = "000" ]; then echo "SERVER FAILED TO START"; tail -20 /tmp/local-server-backnav.log; exit 1; fi
echo "server up"

# ── browser prep ──
agent-browser set viewport 1440 900 > /dev/null 2>&1
agent-browser cookies clear > /dev/null 2>&1
COOKIE=$(grep -o '=.*' /tmp/e2e/owner-cookies.txt | sed 's/^=//')
agent-browser cookies set sb-irzkwtrawvtqfpbyapzx-auth-token "$COOKIE" --domain 127.0.0.1 --path / > /dev/null
ME_FIX='{"id":"usr_e2e_owner","email":"koino.e2e.owner@koino-test.in","name":"E2E Owner","image":null,"username":"e2eowner","bio":null,"role":"admin","totalPoints":120,"profileCompleted":true}'
agent-browser network route "**/api/auth/me" --body "$ME_FIX" > /dev/null
agent-browser network route "**/api/comic/list**" --body "$(cat $FIX/comic-list.json)" > /dev/null
agent-browser network route "**/api/comic/genesis/1**" --body "$(cat $FIX/comic-genesis-1.json)" > /dev/null
agent-browser network route "**/api/comic/genesis/2**" --body "$(cat $FIX/comic-genesis-2.json)" > /dev/null
agent-browser network route "**/api/comic/matthew/1**" --body "$(cat $FIX/comic-matthew-1.json)" > /dev/null
agent-browser network route "**/api/comic/progress**" --body '{}' > /dev/null

echo "════ DESKTOP 1440x900 ════"

# D1: library renders full surface
agent-browser open "$BASE/?view=comic" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
sleep 2
S=$(state)
assert_f "D1a library renders (search field)" "$S" lib true ""
CARDS=$(agent-browser eval "(() => String(Array.from(document.querySelectorAll('button, a')).filter(el => /The Creation|Seventh Day|Birth of Jesus/.test(el.textContent||'')).length))()" 2>/dev/null | tr -d '"')
check "D1b library shows 3 chapter cards (Genesis+Matthew)" "$([ "$CARDS" -ge 3 ] 2>/dev/null && echo yes || echo no)" "yes"
OTNT=$(agent-browser eval "(() => String(Array.from(document.querySelectorAll('button')).filter(el => /Old Testament|New Testament/.test(el.textContent||'')).length))()" 2>/dev/null | tr -d '"')
check "D1c OT/NT filters present" "$([ "$OTNT" -ge 2 ] 2>/dev/null && echo yes || echo no)" "yes"
ALLB=$(agent-browser eval "(() => String(Array.from(document.querySelectorAll('button')).some(el => (el.textContent||'').includes('All Books'))))()" 2>/dev/null | tr -d '"')
check "D1d book selector present" "$ALLB" "true"

# D2: open Genesis 1 → reader, button visible, ABOVE the title
click_btn "The Creation"
sleep 2
S=$(state)
assert_f "D2a reader open (URL pushed)" "$S" url eq "?comic=genesis/1"
assert_f "D2b reader shows 2 panels" "$S" panels eq "2"
assert_f "D2c 'Back to Bible Comics' visible" "$S" backBtn.vis true ""
assert_f "D2d button not covered by header/other" "$S" backBtn.free true ""
H_TXT=$(field "$S" h1.text)
check "D2e chapter title is Genesis 1" "$H_TXT" "Genesis 1"
B_BOT=$(field "$S" backBtn.bottom); H_TOP=$(field "$S" h1.top)
check "D2f button sits ABOVE the chapter title" "$(node -e "process.exit(Number(process.argv[1])<=Number(process.argv[2])+2?0:1)" "$B_BOT" "$H_TOP" && echo yes || echo no)" "yes"
assert_f "D2g 'All Comics' link present near title" "$S" allLink ge "10"
assert_f "D2h progress bar present" "$S" progress true ""
assert_f "D2i Listen (TTS) present" "$S" listen true ""
assert_f "D2j Quiz present" "$S" quiz true ""
assert_f "D2k Share Chapter present" "$S" share true ""
assert_f "D2l narration paragraph rendered" "$S" narr true ""

# D3: click main button → full library (lands back on the ?view=comic entry)
click_btn "Back to Bible Comics"
sleep 1.5
S=$(state)
assert_f "D3a back button → library" "$S" lib true ""
assert_f "D3b reader closed" "$S" reader eq "false"
# NOTE: the ?view=comic deep-link bootstrap replaceState-cleans the URL by
# design, so the library history entry's URL is "/" — go(-1) lands there.
assert_f "D3c URL back on (cleaned) library entry" "$S" url eq ""

# D4: state preservation — search → chapter → back → search restored
set_search "Seventh"
sleep 1
CARDS2=$(agent-browser eval "(() => String(Array.from(document.querySelectorAll('button, a')).filter(el => /Seventh Day/.test(el.textContent||'')).length) + ':' + String(Array.from(document.querySelectorAll('button, a')).filter(el => /The Creation/.test(el.textContent||'')).length))()" 2>/dev/null | tr -d '"')
check "D4a search filters to Seventh Day only" "$CARDS2" "1:0"
click_btn "Seventh Day"
sleep 2
S=$(state)
assert_f "D4b Genesis 2 reader open" "$S" url eq "?comic=genesis/2"
click_btn "Back to Bible Comics"
sleep 1.5
S=$(state)
assert_f "D4c back → library" "$S" lib true ""
assert_f "D4d search query preserved" "$S" searchVal eq "Seventh"

# D5: clear search → open Matthew 1 → back → library
set_search ""
sleep 1
click_btn "Birth of Jesus"
sleep 2
S=$(state)
assert_f "D5a Matthew 1 reader open" "$S" url eq "?comic=matthew/1"
assert_f "D5b Matthew panels render" "$S" panels eq "2"
HT=$(field "$S" h1.text)
check "D5c chapter title is Matthew 1" "$HT" "Matthew 1"
click_btn "Back to Bible Comics"
sleep 1.5
S=$(state)
assert_f "D5d back → library after Matthew" "$S" lib true ""

# D6: shared-link arrival → reader → back works
agent-browser open "$BASE/?comic=genesis/1" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
sleep 2
# Deep-link bootstrap replaceState-cleans the URL at arrival (by design);
# assert the reader itself opened (back button = ComicView mounted).
S=$(state)
assert_f "D6a shared link opens chapter (URL cleaned by design)" "$S" url eq ""
assert_f "D6b back button available on shared-link arrival" "$S" backBtn.vis true ""
assert_f "D6b2 reader content mounted on shared-link arrival" "$S" reader eq "true"
click_btn "Back to Bible Comics"
sleep 1.5
S=$(state)
assert_f "D6c back from shared-link session → library" "$S" lib true ""

# D7: browser back regression
click_btn "The Creation"
sleep 2
agent-browser back > /dev/null 2>&1
sleep 1.5
S=$(state)
assert_f "D7 browser back → library (regression)" "$S" lib true ""

echo "════ MOBILE 390x844 ════"
agent-browser set viewport 390 844 > /dev/null 2>&1
agent-browser open "$BASE/?view=comic" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
sleep 2
click_btn "The Creation"
sleep 2
S=$(state)
assert_f "M1a reader open on mobile" "$S" url eq "?comic=genesis/1"
assert_f "M1b 'Back to Bible Comics' visible" "$S" backBtn.vis true ""
assert_f "M1c tap target >= 36px" "$S" backBtn.h ge "36"
assert_f "M1d button not covered by fixed header" "$S" backBtn.free true ""
B_BOT=$(field "$S" backBtn.bottom); H_TOP=$(field "$S" h1.top)
check "M1e button ABOVE title (mobile)" "$(node -e "process.exit(Number(process.argv[1])<=Number(process.argv[2])+2?0:1)" "$B_BOT" "$H_TOP" && echo yes || echo no)" "yes"
NAV=$(field "$S" navTop)
check "M1f no overlap with bottom nav" "$(node -e "process.exit(Number(process.argv[1])<=Number(process.argv[2])?0:1)" "$B_BOT" "$NAV" && echo yes || echo no)" "yes"
click_btn "Back to Bible Comics"
sleep 1.5
S=$(state)
assert_f "M2 back → library (mobile)" "$S" lib true ""

# M3: mobile deep link
agent-browser open "$BASE/?comic=matthew/1" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
sleep 2
S=$(state)
assert_f "M3a mobile deep link opens Matthew 1 (URL cleaned by design)" "$S" reader eq "true"
assert_f "M3a2 Matthew 1 title" "$S" h1.text eq "Matthew 1"
click_btn "Back to Bible Comics"
sleep 1.5
S=$(state)
assert_f "M3b back → library (mobile deep link)" "$S" lib true ""

# M4: in-viewport check from a fresh reader
agent-browser open "$BASE/?comic=genesis/1" > /dev/null 2>&1
agent-browser wait --load networkidle > /dev/null 2>&1
sleep 2
S=$(state)
assert_f "M4 button fully within viewport top area" "$S" backBtn.top ge "0"
assert_f "M4b button free (not covered)" "$S" backBtn.free true ""

# ── cleanup ──
agent-browser network unroute > /dev/null 2>&1
agent-browser cookies clear > /dev/null 2>&1
pkill -f "standalone/server.js" 2>/dev/null
kill $SRV_PID 2>/dev/null
sleep 1

echo "----------------------------------------"
echo "RESULTS: PASS=$PASS FAIL=$FAIL"
[ $FAIL = 0 ] && echo "E2E: ALL PASS" || echo "E2E: FAILURES PRESENT"
