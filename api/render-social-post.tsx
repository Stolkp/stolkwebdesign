// @ts-nocheck
// Vercel Edge Function: /api/render-social-post?post=<uuid>&fmt=ig|li|gbp|story[&dl=1]
// Rendert één social-post in een gekozen formaat als PNG (brutalist Stolkwebdesign-stijl).
// Leest de post via de publieke anon-key (RLS: public read). Geen storage/secrets nodig —
// de admin downloadt de 4 beelden on-demand. Spiegelt het patroon van /api/og.

import { ImageResponse } from '@vercel/og';
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const COLORS = { black: '#000000', white: '#FFFFFF', red: '#EA2525', bone: '#F5F5F5', muted: '#767676' };

// Formaat → afmetingen + typografie-schaal
const FORMATS = {
  ig:    { w: 1080, h: 1080, pad: 84, eyebrow: 24, headline: 78, sub: 30, cta: 26, brand: 24 },
  li:    { w: 1200, h: 627,  pad: 64, eyebrow: 20, headline: 58, sub: 26, cta: 22, brand: 20 },
  gbp:   { w: 1200, h: 900,  pad: 76, eyebrow: 22, headline: 70, sub: 28, cta: 24, brand: 22 },
  story: { w: 1080, h: 1920, pad: 96, eyebrow: 26, headline: 104, sub: 36, cta: 30, brand: 26 },
};

const THEMES = {
  black: { bg: COLORS.black, text: COLORS.white, accent: COLORS.red, sub: 'rgba(255,255,255,0.7)', brandDot: COLORS.red },
  red:   { bg: COLORS.red,   text: COLORS.white, accent: COLORS.white, sub: 'rgba(255,255,255,0.88)', brandDot: COLORS.white },
  bone:  { bg: COLORS.bone,  text: COLORS.black, accent: COLORS.red, sub: '#555555', brandDot: COLORS.red },
};

let archivoBlackFont, spaceGroteskFont;
async function loadFonts() {
  if (archivoBlackFont && spaceGroteskFont) return { archivoBlackFont, spaceGroteskFont };
  const archivoCss = await fetch('https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap', { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
  const grotCss = await fetch('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap', { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.text());
  const archivoUrl = archivoCss.match(/src: url\((.+?)\) format/)?.[1];
  const grotUrl = grotCss.match(/src: url\((.+?)\) format/)?.[1];
  archivoBlackFont = await fetch(archivoUrl).then(r => r.arrayBuffer());
  spaceGroteskFont = await fetch(grotUrl).then(r => r.arrayBuffer());
  return { archivoBlackFont, spaceGroteskFont };
}

async function fetchPost(id) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data } = await supabase
    .from('stolkwebdesign_social_posts')
    .select('eyebrow, headline, sub, cta, cta_link, bg_image, theme')
    .eq('id', id)
    .maybeSingle();
  return data;
}

function Frame({ post, fmt }) {
  const f = FORMATS[fmt];
  const hasBg = post.bg_image && /^https?:\/\//.test(post.bg_image);
  const th = hasBg ? { bg: COLORS.black, text: COLORS.white, accent: COLORS.red, sub: 'rgba(255,255,255,0.85)', brandDot: COLORS.red } : (THEMES[post.theme] || THEMES.black);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', background: th.bg, color: th.text, padding: f.pad, position: 'relative' }}>
      {hasBg ? <img src={post.bg_image} width={f.w} height={f.h} style={{ position: 'absolute', top: 0, left: 0, width: f.w, height: f.h, objectFit: 'cover' }} /> : null}
      {hasBg ? <div style={{ position: 'absolute', top: 0, left: 0, width: f.w, height: f.h, background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.78) 100%)' }} /> : null}

      {/* eyebrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
        <div style={{ width: f.eyebrow * 0.6, height: f.eyebrow * 0.6, background: th.accent }} />
        <div style={{ fontFamily: 'Space Grotesk', fontSize: f.eyebrow, letterSpacing: 4, textTransform: 'uppercase', color: th.sub }}>
          {post.eyebrow || 'Stolkwebdesign'}
        </div>
      </div>

      {/* headline + sub */}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ width: f.headline * 1.8, height: f.headline * 0.18, background: th.accent, marginBottom: f.pad * 0.4 }} />
        <div style={{ fontFamily: 'Archivo Black', fontSize: f.headline, lineHeight: 1.02, textTransform: 'uppercase', letterSpacing: -2 }}>
          {post.headline || 'Jouw kop hier'}
        </div>
        {post.sub ? (
          <div style={{ fontFamily: 'Space Grotesk', fontSize: f.sub, lineHeight: 1.4, color: th.sub, marginTop: f.pad * 0.35, maxWidth: f.w - f.pad * 2 }}>
            {post.sub}
          </div>
        ) : null}
      </div>

      {/* footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {post.cta ? <div style={{ fontFamily: 'Archivo Black', fontSize: f.cta, textTransform: 'uppercase', color: th.accent }}>{post.cta + ' →'}</div> : null}
          <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: 'Archivo Black', fontSize: f.brand, letterSpacing: -0.5, textTransform: 'uppercase', color: th.text }}>
            <span>Stolk</span><span style={{ color: th.brandDot }}>web</span><span>design</span><span style={{ color: th.brandDot }}>®</span>
          </div>
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: f.brand * 0.8, color: th.sub }}>stolkwebdesign.nl</div>
      </div>
    </div>
  );
}

export default async function handler(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('post') || '';
  const fmt = (url.searchParams.get('fmt') || 'ig').toLowerCase();
  const dl = url.searchParams.get('dl') === '1';
  if (!FORMATS[fmt]) return new Response('fmt must be ig|li|gbp|story', { status: 400 });

  const post = await fetchPost(id);
  const { archivoBlackFont, spaceGroteskFont } = await loadFonts();
  const fonts = [
    { name: 'Archivo Black', data: archivoBlackFont, weight: 900 as const, style: 'normal' as const },
    { name: 'Space Grotesk', data: spaceGroteskFont, weight: 500 as const, style: 'normal' as const },
  ];
  const f = FORMATS[fmt];

  const element = post
    ? <Frame post={post} fmt={fmt} />
    : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: COLORS.black, color: COLORS.white, fontFamily: 'Archivo Black', fontSize: 44, textAlign: 'center', padding: 80 }}>Post niet gevonden</div>;

  // Geen langdurige cache: na een tekstwijziging moet dezelfde URL de nieuwe PNG geven.
  const headers = { 'Cache-Control': 'public, max-age=0, must-revalidate' };
  if (dl) headers['Content-Disposition'] = `attachment; filename="stolkwebdesign-${fmt}-${f.w}x${f.h}.png"`;

  return new ImageResponse(element, { width: f.w, height: f.h, fonts, headers });
}
