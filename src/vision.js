const MODEL = 'claude-haiku-5-5';
const PROMPT = `You are screening a financial-product marketing creative for a compliance team.
Return ONLY JSON: {"text": string, "small_print": boolean, "note": string}.
"text": every piece of text visible in the creative, verbatim, including fine print and disclosures.
"small_print": true if required-looking disclosures (APR, terms, fees, NMLS, ad labels) are tiny, low-contrast, or much less prominent than the headline claims.
"note": one sentence describing the visual and where disclosures sit.`;

export const VISION_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];

function toBase64(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function extract(apiKey, mime, buf) {
  const block = mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: mime, data: toBase64(buf) } }
    : { type: 'image', source: { type: 'base64', media_type: mime, data: toBase64(buf) } };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: 'user', content: [block, { type: 'text', text: PROMPT }] }] }),
  });
  if (!res.ok) throw new Error(`vision API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const out = (await res.json()).content.find(c => c.type === 'text')?.text ?? '';
  const json = out.match(/\{[\s\S]*\}/);
  if (!json) throw new Error('vision API returned no JSON');
  const v = JSON.parse(json[0]);
  return { text: String(v.text ?? ''), small_print: !!v.small_print, note: String(v.note ?? '') };
}
