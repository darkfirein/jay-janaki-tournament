// Calls the Google Cloud Vision REST API (images:annotate) using a simple
// API key — no service-account JSON needed. Then turns the raw OCR text
// into candidate {name, kills} rows, and matches those against the
// tournament's approved players by in-game name.

async function runOcr(imageBuffer) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    const err = new Error('Google Vision API key is not configured on the server.');
    err.code = 'NO_VISION_KEY';
    throw err;
  }

  const body = {
    requests: [
      {
        image: { content: imageBuffer.toString('base64') },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
      }
    ]
  };

  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Google Vision API request failed.');
  }

  const annotation = data.responses?.[0]?.fullTextAnnotation;
  return annotation?.text || '';
}

// Turns raw OCR text into candidate {rawLine, name, kills} rows.
// Result screens vary a lot by game, so this looks for any line that has
// exactly one plausible kill-count number (0-50) on it, and treats the
// rest of the line (with obvious noise words stripped) as the player name.
function parseKillLines(text) {
  const noiseWords = /\b(kills?|k\/d|kd|damage|dmg|rank|placement|survived|team|squad|solo|duo)\b/gi;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const candidates = [];

  for (const line of lines) {
    const numbers = line.match(/\d+/g);
    if (!numbers) continue;
    const plausible = numbers.filter((n) => Number(n) <= 50);
    if (plausible.length !== 1) continue; // ambiguous line — skip, admin can fill it manually

    const kills = Number(plausible[0]);
    let name = line
      .replace(noiseWords, '')
      .replace(plausible[0], '')
      .replace(/[^\p{L}\p{N}_.\-\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (name.length < 2) continue; // nothing name-like left on this line
    candidates.push({ rawLine: line, name, kills });
  }

  return candidates;
}

// Turns raw OCR text into name candidates for a room/lobby screenshot —
// unlike parseKillLines, a line doesn't need a kill number on it, since a
// pre-match room list just shows who's present. Very short or very long
// lines are skipped since those are usually UI chrome (buttons, headers)
// rather than an actual player name.
function parseNameLines(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const candidates = [];

  for (const line of lines) {
    const name = line
      .replace(/[^\p{L}\p{N}_.\-\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.length < 2 || name.length > 30) continue;
    candidates.push({ rawLine: line, name, kills: 0 });
  }

  return candidates;
}

// Strips down to just letters and numbers for comparison — but "letters"
// here means any Unicode letter (\p{L}), not only a-z. Free Fire nicknames
// commonly use stylish font characters (full-width, mathematical alphabet
// symbols, other scripts) which are still Unicode *letters*, just outside
// plain ASCII — the old a-z0-9-only version stripped those down to nothing,
// which meant a stylish nickname could never match at all.
function normalize(str) {
  return (str || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// Very small edit-distance check so close OCR misreads ("Sh4dow" vs "Shadow")
// still match, without pulling in a dependency.
function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const dist = dp[m][n];
  return 1 - dist / Math.max(m, n);
}

// players: [{booking_id, user_id, in_game_name, user_name}]
// candidates: [{rawLine, name, kills}]
// Returns one row per player (matched or not), so the admin sees the full roster.
function matchPlayers(players, candidates) {
  const used = new Set();

  return players.map((p) => {
    let best = null;
    let bestScore = 0;
    candidates.forEach((c, idx) => {
      if (used.has(idx)) return;
      const score = Math.max(
        similarity(c.name, p.in_game_name),
        similarity(c.name, p.user_name) * 0.8 // name match is a weaker signal than in-game name
      );
      if (score > bestScore) {
        bestScore = score;
        best = { ...c, idx };
      }
    });

    if (best && bestScore >= 0.72) {
      used.add(best.idx);
      return { ...p, kills: best.kills, matched_text: best.rawLine, matched: true };
    }
    return { ...p, kills: 0, matched_text: null, matched: false };
  });
}

module.exports = { runOcr, parseKillLines, parseNameLines, matchPlayers };
