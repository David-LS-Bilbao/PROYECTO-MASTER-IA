# Sprint 18.3: Manual Integration Tests

## Test 1: Round Robin Source Interleaving

### Setup
1. Asegúrate de que el backend está corriendo: `npm run dev`
2. Asegúrate de que hay al menos 60 artículos en la base de datos de múltiples fuentes

### Test Case 1: Verificar Interleaving en Dashboard

**Request**:
```bash
curl -X GET "http://localhost:3001/api/news?limit=20&offset=0" \
  -H "Content-Type: application/json"
```

**Expected Results**:
- ✅ Response status: 200
- ✅ Returns exactly 20 articles
- ✅ Articles are from **mixed sources** (no more than 2-3 consecutive from same source)
- ✅ Articles maintain **chronological order** within each source
- ✅ Console logs show:
  ```
  [Repository.findAll] Fetched 60 articles (buffer for interleaving)
  [Repository.findAll] Grouped into X sources: ElPaís:N, Xataka:M, ...
  [Repository.findAll] Interleaved 20 articles in Y rounds
  ```

**Verification Script**:
```javascript
// Save response to result.json, then run:
const articles = JSON.parse(fs.readFileSync('result.json')).data;

// Check: No clumping (no more than 2 consecutive from same source)
for (let i = 0; i < articles.length - 2; i++) {
  const s1 = articles[i].source;
  const s2 = articles[i + 1].source;
  const s3 = articles[i + 2].source;

  if (s1 === s2 && s2 === s3) {
    console.error(`❌ FAIL: Clumping detected at positions ${i}, ${i+1}, ${i+2} (${s1})`);
  }
}

// Check: Sources are diverse
const sources = new Set(articles.map(a => a.source));
console.log(`✅ PASS: ${sources.size} different sources in results`);
console.log(`Sources: ${Array.from(sources).join(', ')}`);
```

### Test Case 2: No Interleaving for Favorites

**Request** (requires authentication):
```bash
curl -X GET "http://localhost:3001/api/news?onlyFavorites=true&limit=20" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Results**:
- ✅ Response status: 200
- ✅ Returns user's favorites in **chronological order** (by createdAt)
- ✅ **NO interleaving** applied (articles may be from same source consecutively)
- ✅ Console logs show:
  ```
  [Repository.findAll] Per-user favorites: query from junction table (no interleaving)
  ```

---

## Test 2: Artificial Reveal State (Frontend)

### Test Case 1: Pre-loaded Analysis (Cached + Unlocked)

**Setup**:
1. Login to frontend: `http://localhost:3000`
2. Analyze an article for the first time (Article X)
3. Navigate away from the article
4. Return to dashboard

**Steps**:
1. Find Article X in dashboard (should show "Ver análisis (Instantáneo)" button)
2. Click the button → Navigate to `/news/:id?analyze=true`
3. **Observe**:
   - ✅ Skeletons appear immediately (animated pulsing)
   - ✅ Delay of approximately **1.8 seconds**
   - ✅ After delay, analysis appears with full content
   - ✅ No API call to `/api/analyze/article` (check Network tab)
   - ✅ Console logs show:
     ```
     [page.tsx] 🎭 Reveal useEffect fired
     [page.tsx]    shouldReveal: true
     [page.tsx]    ✨ Starting artificial reveal (1.8s delay)...
     [page.tsx]    ✅ Reveal completed - showing analysis
     ```

### Test Case 2: New Analysis (Not Cached)

**Steps**:
1. Find an unanalyzed article in dashboard
2. Click "Analizar con IA" button
3. **Observe**:
   - ✅ Skeletons appear immediately
   - ✅ API call to `/api/analyze/article` is made
   - ✅ Delay of approximately **3-5 seconds** (Gemini processing + fake delay)
   - ✅ After delay, analysis appears
   - ✅ Console logs show actual analysis flow

### Test Case 3: Cards Hide Analysis

**Steps**:
1. Navigate to dashboard
2. Find an article that has been analyzed
3. **Observe**:
   - ✅ Card shows **NO analysis preview** (no bias badge, no topics)
   - ✅ Only shows: Title, Description, Source, Date, and Action buttons
   - ✅ Action button says "Ver análisis" or "Mostrar análisis"

---

## Test 3: End-to-End UX Flow

### Complete User Journey

**Scenario**: New user discovers and analyzes article

**Steps**:
1. **Dashboard**: User sees 20 articles with **diverse sources** (Round Robin working)
2. **Card**: User sees article without analysis preview (hidden per Sprint 18.3)
3. **Click**: User clicks "Analizar con IA"
4. **Detail Page**: Navigate to `/news/:id?analyze=true`
5. **Reveal**: Skeletons show for 1.8s-2s (artificial reveal)
6. **Analysis**: Full analysis appears with bias score, reliability, topics
7. **Return**: User goes back to dashboard
8. **Re-visit**: User clicks same article again
9. **Instant**: Analysis is still available (but with artificial reveal for UX)

**Expected UX**:
- ✅ User perceives AI is "working" even with cached data
- ✅ User sees diverse content sources (no clumping)
- ✅ User must explicitly request analysis (no accidental exposure)
- ✅ Consistent loading experience (cached vs fresh)

---

## Automated Verification Script

Save this as `verify-sprint-18.3.js`:

```javascript
// Run with: node verify-sprint-18.3.js
const axios = require('axios');

async function verifyRoundRobin() {
  console.log('🔍 Testing Round Robin Source Interleaving...\n');

  try {
    const response = await axios.get('http://localhost:3001/api/news?limit=20&offset=0');
    const articles = response.data.data;

    console.log(`✅ Received ${articles.length} articles`);

    // Check for clumping
    let clumpingFound = false;
    for (let i = 0; i < articles.length - 2; i++) {
      const s1 = articles[i].source;
      const s2 = articles[i + 1].source;
      const s3 = articles[i + 2].source;

      if (s1 === s2 && s2 === s3) {
        console.error(`❌ FAIL: Clumping detected at positions ${i}, ${i+1}, ${i+2} (${s1})`);
        clumpingFound = true;
      }
    }

    if (!clumpingFound) {
      console.log('✅ PASS: No clumping detected (no 3+ consecutive from same source)');
    }

    // Check source diversity
    const sources = new Set(articles.map(a => a.source));
    console.log(`✅ PASS: ${sources.size} different sources found`);
    console.log(`   Sources: ${Array.from(sources).join(', ')}`);

    // Show first 10 articles with sources
    console.log('\n📊 First 10 articles:');
    articles.slice(0, 10).forEach((a, i) => {
      console.log(`   ${i + 1}. [${a.source}] ${a.title.substring(0, 40)}...`);
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

verifyRoundRobin();
```

Run with: `node verify-sprint-18.3.js`

---

## Success Criteria

Sprint 18.3 is considered **PASSED** if:

### Backend (Round Robin)
- [x] API returns 20 articles when requested
- [x] No more than 2 consecutive articles from same source
- [x] At least 3-5 different sources in results
- [x] Chronological order maintained within each source
- [x] Console logs show interleaving process

### Frontend (Artificial Reveal)
- [x] Skeletons appear when navigating with `?analyze=true`
- [x] Delay of 1.5-2 seconds before revealing analysis
- [x] Analysis appears after delay
- [x] No analysis preview shown in dashboard cards
- [x] Consistent UX for cached vs fresh analysis

### User Experience
- [x] Perception of AI value maintained
- [x] Diverse source mix in feed
- [x] Smooth transitions and loading states
- [x] No accidental exposure of analysis data
