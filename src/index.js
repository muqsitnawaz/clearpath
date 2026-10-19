import { screen, SLA_HOURS, FORMATS } from './rules.js';
import { extract, VISION_MIMES } from './vision.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const bad = (msg, status = 400) => json({ error: msg }, status);

const PRODUCTS = ['personal_loan', 'credit_card', 'mortgage'];
const CHANNELS = ['affiliate', 'email', 'paid_social', 'search_ad', 'landing_page', 'sms'];
const MAX_UPLOAD = 5 * 1024 * 1024;
const UPLOAD_MIMES = [...VISION_MIMES, 'video/mp4', 'video/quicktime', 'video/webm'];
const DECISIONS = { approve: 'approved', reject: 'rejected', request_changes: 'changes_requested' };

const now = () => new Date().toISOString();
const dueAt = lane => new Date(Date.now() + SLA_HOURS[lane] * 3600e3).toISOString();

async function event(db, id, actor, type, detail) {
  await db.prepare('INSERT INTO events (submission_id, at, actor, type, detail) VALUES (?,?,?,?,?)')
    .bind(id, now(), actor, type, detail ?? null).run();
}

function storeFindings(db, id, version, findings) {
  return findings.map(f => db.prepare(
    'INSERT INTO findings (submission_id, version, rule_id, severity, excerpt, message, suggestion) VALUES (?,?,?,?,?,?,?)'
  ).bind(id, version, f.rule_id, f.severity, f.excerpt, f.message, f.suggestion));
}

function validateInput(b, requireMeta) {
  if (!PRODUCTS.includes(b.product)) return 'product must be one of ' + PRODUCTS.join(', ');
  if (!CHANNELS.includes(b.channel)) return 'channel must be one of ' + CHANNELS.join(', ');
  const format = b.format ?? 'text';
  if (!FORMATS.includes(format)) return 'format must be one of ' + FORMATS.join(', ');
  if (typeof b.body !== 'string') return 'body is required';
  if (format === 'text' && !b.body.trim()) return 'body is required for text assets';
  if (requireMeta && (!b.title?.trim() || !b.submitter?.trim())) return 'title and submitter are required';
  return null;
}

async function list(db, url) {
  const where = [], args = [];
  for (const k of ['status', 'lane', 'assignee']) {
    const v = url.searchParams.get(k);
    if (v) { where.push(`${k} = ?`); args.push(v); }
  }
  const rows = await db.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM findings f WHERE f.submission_id = s.id AND f.version = s.version) AS finding_count
     FROM submissions s ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY CASE s.status WHEN 'pending' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
              CASE s.lane WHEN 'escalated' THEN 0 WHEN 'standard' THEN 1 ELSE 2 END, s.due_at`
  ).bind(...args).all();
  return json(rows.results);
}

async function detail(db, id) {
  const s = await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first();
  if (!s) return bad('not found', 404);
  const [f, e, a] = await Promise.all([
    db.prepare('SELECT * FROM findings WHERE submission_id = ? ORDER BY version DESC, id').bind(id).all(),
    db.prepare('SELECT * FROM events WHERE submission_id = ? ORDER BY id').bind(id).all(),
    db.prepare('SELECT id, version, name, mime, size, extracted_text, small_print, visual_note, extraction_error FROM attachments WHERE submission_id = ? ORDER BY id').bind(id).all(),
  ]);
  return json({ ...s, findings: f.results, events: e.results, attachments: a.results });
}

async function create(db, b, source = 'manual') {
  const err = validateInput(b, true);
  if (err) return bad(err);
  const r = screen(b);
  const res = await db.prepare(
    `INSERT INTO submissions (title, product, channel, format, source, partner, url, body, submitter, lane, risk_score, created_at, due_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(b.title.trim(), b.product, b.channel, b.format ?? 'text', source, b.partner || null, b.url || null, b.body, b.submitter.trim(),
    r.lane, r.score, now(), dueAt(r.lane)).run();
  const id = res.meta.last_row_id;
  await db.batch(storeFindings(db, id, 1, r.findings));
  await event(db, id, b.submitter, 'submitted', `Pre-screen: ${r.findings.length} finding(s), lane ${r.lane}${source === 'manual' ? '' : ` (via ${source})`}`);
  return json({ id, lane: r.lane, risk_score: r.score, findings: r.findings }, 201);
}

async function decide(db, id, b) {
  const status = DECISIONS[b.decision];
  if (!status) return bad('decision must be one of ' + Object.keys(DECISIONS).join(', '));
  if (!b.actor?.trim()) return bad('actor is required');
  if (status !== 'approved' && !b.note?.trim()) return bad('a note is required to reject or request changes');
  const s = await db.prepare('SELECT status FROM submissions WHERE id = ?').bind(id).first();
  if (!s) return bad('not found', 404);
  if (['approved', 'rejected'].includes(s.status)) return bad(`already ${s.status}`, 409);
  await db.prepare('UPDATE submissions SET status = ?, decision_note = ?, decided_at = ?, assignee = COALESCE(assignee, ?) WHERE id = ?')
    .bind(status, b.note || null, now(), b.actor, id).run();
  await event(db, id, b.actor, b.decision, b.note);
  return json({ ok: true, status });
}

async function assign(db, id, b) {
  if (!b.assignee?.trim()) return bad('assignee is required');
  const res = await db.prepare(
    "UPDATE submissions SET assignee = ?, status = CASE WHEN status = 'pending' THEN 'in_review' ELSE status END WHERE id = ? AND status IN ('pending','in_review')"
  ).bind(b.assignee, id).run();
  if (!res.meta.changes) return bad('not assignable', 409);
  await event(db, id, b.assignee, 'assigned', null);
  return json({ ok: true });
}

async function resubmit(db, id, b) {
  const s = await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first();
  if (!s) return bad('not found', 404);
  if (s.status !== 'changes_requested') return bad('only submissions with requested changes can be resubmitted', 409);
  const err = validateInput({ ...s, body: b.body }, false);
  if (err) return bad(err);
  const r = screen({ product: s.product, channel: s.channel, format: s.format, body: b.body });
  const version = s.version + 1;
  await db.batch([
    db.prepare("UPDATE submissions SET body = ?, version = ?, lane = ?, risk_score = ?, status = 'pending', due_at = ?, decided_at = NULL, decision_note = NULL WHERE id = ?")
      .bind(b.body, version, r.lane, r.score, dueAt(r.lane), id),
    ...storeFindings(db, id, version, r.findings),
  ]);
  await event(db, id, s.submitter, 'resubmitted', `v${version}: ${r.findings.length} finding(s), lane ${r.lane}`);
  return json({ id, version, lane: r.lane, risk_score: r.score, findings: r.findings });
}

// Re-run the pre-screen over the copy plus everything extracted from this version's attachments.
async function rescreen(db, id) {
  const s = await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first();
  const atts = (await db.prepare('SELECT extracted_text, small_print FROM attachments WHERE submission_id = ? AND version = ?')
    .bind(id, s.version).all()).results;
  const text = [s.body, ...atts.map(a => a.extracted_text)].filter(Boolean).join('\n');
  const r = screen({ product: s.product, channel: s.channel, format: s.format, body: text, visual: { small_print: atts.some(a => a.small_print) } });
  await db.batch([
    db.prepare('DELETE FROM findings WHERE submission_id = ? AND version = ?').bind(id, s.version),
    ...storeFindings(db, id, s.version, r.findings),
    db.prepare('UPDATE submissions SET lane = ?, risk_score = ?, due_at = ? WHERE id = ?')
      .bind(r.lane, r.score, new Date(Date.parse(s.created_at) + SLA_HOURS[r.lane] * 3600e3).toISOString(), id),
  ]);
  return r;
}

async function attach(env, id, name, mime, buf, actor) {
  const s = await env.DB.prepare('SELECT version, status FROM submissions WHERE id = ?').bind(id).first();
  if (!s) return bad('not found', 404);
  if (!['pending', 'in_review'].includes(s.status)) return bad('attachments can only be added while the submission is open', 409);
  if (!UPLOAD_MIMES.includes(mime)) return bad('unsupported file type ' + mime);
  if (buf.byteLength > MAX_UPLOAD) return bad('file over 5 MB', 413);
  const key = `${id}/${s.version}/${crypto.randomUUID()}`;
  await env.MEDIA.put(key, buf, { httpMetadata: { contentType: mime } });
  let ex = null, error = null;
  if (VISION_MIMES.includes(mime)) {
    try { ex = await extract(env.ANTHROPIC_API_KEY, mime, buf); } catch (e) { error = e.message; }
  }
  const res = await env.DB.prepare(
    `INSERT INTO attachments (submission_id, version, name, mime, size, r2_key, extracted_text, small_print, visual_note, extraction_error, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, s.version, name, mime, buf.byteLength, key, ex?.text ?? null, ex?.small_print ? 1 : 0, ex?.note ?? null, error, now()).run();
  const r = await rescreen(env.DB, id);
  await event(env.DB, id, actor, 'attached', `${name}${error ? ' (extraction failed: ' + error + ')' : ''}; ${r.findings.length} finding(s), lane ${r.lane}`);
  return json({ id: res.meta.last_row_id, extraction_error: error, lane: r.lane, risk_score: r.score, findings: r.findings }, 201);
}

async function intake(req, env) {
  if (!env.INTAKE_TOKEN || req.headers.get('x-intake-token') !== env.INTAKE_TOKEN) return bad('invalid intake token', 401);
  const b = await req.json();
  const source = b.source === 'email' ? 'email' : 'webhook';
  const created = await create(env.DB, { ...b, body: b.body ?? '' }, source);
  if (created.status !== 201 || !b.media_url) return created;
  const out = await created.json();
  const media = await fetch(b.media_url);
  if (!media.ok) return json({ ...out, media_error: `fetching media_url returned ${media.status}` }, 201);
  const mime = (media.headers.get('content-type') || '').split(';')[0];
  const att = await attach(env, out.id, new URL(b.media_url).pathname.split('/').pop() || 'media', mime, await media.arrayBuffer(), b.submitter);
  return json({ ...out, attachment: await att.json() }, 201);
}

async function metrics(db) {
  const [counts, cycle, overdue, rules] = await Promise.all([
    db.prepare('SELECT status, lane, COUNT(*) n FROM submissions GROUP BY status, lane').all(),
    db.prepare(`SELECT lane, COUNT(*) n, AVG((julianday(decided_at) - julianday(created_at)) * 24) avg_hours
                FROM submissions WHERE decided_at IS NOT NULL GROUP BY lane`).all(),
    db.prepare("SELECT COUNT(*) n FROM submissions WHERE status IN ('pending','in_review') AND due_at < ?").bind(now()).first(),
    db.prepare(`SELECT rule_id, severity, COUNT(*) n FROM findings f JOIN submissions s
                ON s.id = f.submission_id AND s.version = f.version GROUP BY rule_id, severity ORDER BY n DESC LIMIT 8`).all(),
  ]);
  return json({ counts: counts.results, cycle: cycle.results, overdue: overdue.n, top_rules: rules.results });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const db = env.DB;
    const m = url.pathname.match(/^\/api\/submissions(?:\/(\d+)(?:\/(\w+))?)?$/);
    try {
      if (url.pathname === '/api/metrics' && req.method === 'GET') return await metrics(db);
      if (url.pathname === '/api/intake' && req.method === 'POST') return await intake(req, env);
      const f = url.pathname.match(/^\/api\/attachments\/(\d+)\/file$/);
      if (f && req.method === 'GET') {
        const a = await db.prepare('SELECT * FROM attachments WHERE id = ?').bind(Number(f[1])).first();
        const obj = a && await env.MEDIA.get(a.r2_key);
        return obj ? new Response(obj.body, { headers: { 'content-type': a.mime, 'content-disposition': 'inline' } }) : bad('not found', 404);
      }
      if (url.pathname === '/api/screen' && req.method === 'POST') {
        const b = await req.json();
        const err = validateInput(b, false);
        return err ? bad(err) : json(screen(b));
      }
      if (m) {
        const id = m[1] && Number(m[1]), action = m[2];
        if (!id && req.method === 'GET') return await list(db, url);
        if (!id && req.method === 'POST') return await create(db, await req.json());
        if (id && !action && req.method === 'GET') return await detail(db, id);
        if (id && action === 'attachments' && req.method === 'POST') {
          return await attach(env, id, url.searchParams.get('name') || 'upload', (req.headers.get('content-type') || '').split(';')[0],
            await req.arrayBuffer(), url.searchParams.get('actor') || 'unknown');
        }
        if (id && req.method === 'POST') {
          const b = await req.json();
          if (action === 'decision') return await decide(db, id, b);
          if (action === 'assign') return await assign(db, id, b);
          if (action === 'resubmit') return await resubmit(db, id, b);
        }
      }
      return bad('not found', 404);
    } catch (e) {
      if (e instanceof SyntaxError) return bad('invalid JSON');
      throw e;
    }
  },
};
