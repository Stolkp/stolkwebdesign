// @ts-nocheck
// Vercel Edge Function: /api/og?slide=1..5&slug=...
// Renders one carousel slide (1080x1080 PNG) in brutalist Stolkwebdesign style.
// Slide 1 = hook, slides 2-4 = takeaways, slide 5 = CTA.

import { ImageResponse } from '@vercel/og';
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const SITE_HOST = 'stolkwebdesign.nl';
const COLORS = { black: '#000000', white: '#FFFFFF', red: '#EA2525', bone: '#F5F5F5', muted: '#767676' };
const TOPIC_LABELS = { webdesign: 'Webdesign', hosting: 'Hosting', tooling: 'Tooling', mkb: 'Voor de MKB' };

let archivoBlackFont, spaceGroteskFont;
async function loadFonts() {
  if (archivoBlackFont && spaceGroteskFont) return { archivoBlackFont, spaceGroteskFont };
  // Google Fonts CSS fetch + parse — strategie van @vercel/og docs.
  const archivoCss = await fetch(
    'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  ).then((r) => r.text());
  const grotCss = await fetch(
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  ).then((r) => r.text());
  const archivoUrl = archivoCss.match(/src: url\((.+?)\) format/)?.[1];
  const grotUrl = grotCss.match(/src: url\((.+?)\) format/)?.[1];
  archivoBlackFont = await fetch(archivoUrl).then((r) => r.arrayBuffer());
  spaceGroteskFont = await fetch(grotUrl).then((r) => r.arrayBuffer());
  return { archivoBlackFont, spaceGroteskFont };
}

async function fetchPost(slug) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data } = await supabase
    .from('stolkwebdesign_blog_posts')
    .select('title, excerpt, takeaways, topic, slug')
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

function SlideHook({ title, topic }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', background: COLORS.black, color: COLORS.white, padding: 80, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 14, height: 14, background: COLORS.red }} />
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
          {TOPIC_LABELS[topic] || 'Stolkwebdesign'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 180, height: 18, background: COLORS.red, marginBottom: 36 }} />
        <div style={{ fontFamily: 'Archivo Black', fontSize: 96, lineHeight: 1.02, textTransform: 'uppercase', letterSpacing: -2, maxWidth: 920 }}>
          {title}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 22, letterSpacing: -0.5, textTransform: 'uppercase' }}>
          Stolkwebdesign<span style={{ color: COLORS.red }}>®</span>
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, color: 'rgba(255,255,255,0.5)' }}>Veeg →</div>
      </div>
    </div>
  );
}

function SlideTakeaway({ index, takeaway, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', background: COLORS.bone, color: COLORS.black, padding: 80, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 22, letterSpacing: -0.5, textTransform: 'uppercase' }}>
          Stolkwebdesign<span style={{ color: COLORS.red }}>®</span>
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: COLORS.muted }}>
          {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 120, height: 120, background: COLORS.white, border: `4px solid ${COLORS.black}`, boxShadow: `12px 12px 0 0 ${COLORS.red}`, fontFamily: 'Archivo Black', fontSize: 64, color: COLORS.black }}>
          {String(index - 1).padStart(2, '0')}
        </div>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 64, lineHeight: 1.08, textTransform: 'uppercase', letterSpacing: -1.5, maxWidth: 880 }}>
          {takeaway}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, color: COLORS.muted }}>Veeg →</div>
      </div>
    </div>
  );
}

function SlideCta({ slug }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', background: COLORS.red, color: COLORS.white, padding: 80, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 14, height: 14, background: COLORS.white }} />
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
          Lees het hele artikel
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 96, lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: -3 }}>
          Lees<br />verder →
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, color: 'rgba(255,255,255,0.9)' }}>
          {SITE_HOST}/blog/{slug}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontFamily: 'Archivo Black', fontSize: 22, letterSpacing: -0.5, textTransform: 'uppercase', color: COLORS.white }}>
          Stolkwebdesign<span style={{ color: COLORS.black }}>®</span>
        </div>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, color: 'rgba(255,255,255,0.8)' }}>
          Plan een gesprek · cal.com/peter-stolk
        </div>
      </div>
    </div>
  );
}

function Placeholder({ message }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: COLORS.black, color: COLORS.white, fontFamily: 'Archivo Black', fontSize: 48, textAlign: 'center', padding: 80 }}>
      {message}
    </div>
  );
}

export default async function handler(req) {
  const url = new URL(req.url);
  const slide = parseInt(url.searchParams.get('slide') || '1', 10);
  const slug = url.searchParams.get('slug') || '';

  if (slide < 1 || slide > 5) {
    return new Response('slide must be 1..5', { status: 400 });
  }

  const post = await fetchPost(slug);
  const { archivoBlackFont, spaceGroteskFont } = await loadFonts();
  const fonts = [
    { name: 'Archivo Black', data: archivoBlackFont, weight: 900 as const, style: 'normal' as const },
    { name: 'Space Grotesk', data: spaceGroteskFont, weight: 500 as const, style: 'normal' as const },
  ];

  let element;
  if (!post) {
    element = <Placeholder message={`Blog niet gevonden: ${slug || '(geen slug)'}`} />;
  } else if (slide === 1) {
    element = <SlideHook title={post.title} topic={post.topic} />;
  } else if (slide >= 2 && slide <= 4) {
    const idx = slide - 1; // 1, 2, 3
    const takeaways = Array.isArray(post.takeaways) ? post.takeaways : [];
    const takeaway = takeaways[idx - 1] || post.excerpt || post.title;
    element = <SlideTakeaway index={slide} takeaway={takeaway} total={5} />;
  } else {
    element = <SlideCta slug={post.slug} />;
  }

  return new ImageResponse(element, { width: 1080, height: 1080, fonts });
}
