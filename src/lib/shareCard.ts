// Browser-only: a ready picture of a hike for Instagram (a post 1080×1350 or a
// story 1080×1920) — its photo, name, dates, regions, organiser and the
// site's mark. Drawn on a canvas in the visitor's browser, so the server does
// no work. Then shared as a file (phones: the system sheet, Instagram is in
// it) or downloaded.

export type CardTour = {
  title: string;
  when: string; // "Շաբաթ, 25 հոկտեմբերի"
  place: string; // regions
  club: string;
  photo: string | null;
  url: string; // the hike's address, shown as text at the bottom
  organiserLabel: string; // "Կազմակերպող"
  signUpLabel: string; // "Գրանցում"
};
export type CardFormat = "post" | "story";

const SIZE: Record<CardFormat, [number, number]> = { post: [1080, 1350], story: [1080, 1920] };
const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="66" cy="34" r="18" fill="#F2B134"/><path d="M36 10 L6 84 L36 84 Z" fill="#4FA08D" stroke="#4FA08D" stroke-width="4" stroke-linejoin="round"/><path d="M36 10 L66 84 L36 84 Z" fill="#EE7F58" stroke="#EE7F58" stroke-width="4" stroke-linejoin="round"/><path d="M44 84 Q64 58 92 84 Z" fill="#F3EADA" stroke="#F3EADA" stroke-width="4" stroke-linejoin="round"/></svg>';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // the storage serves public files to any site
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Words onto at most `max` lines of `width`; the last one ends with "…" if cut.
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    let last = kept[max - 1];
    while (ctx.measureText(`${last}…`).width > width && last.length) last = last.slice(0, -1);
    kept[max - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

export async function drawShareCard(tour: CardTour, format: CardFormat): Promise<Blob | null> {
  const [W, H] = SIZE[format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await document.fonts?.ready;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const font = (weight: number, px: number) => `${weight} ${px}px ${family}`;

  // The photo fills the top part (cropped to fit), else the brand's green.
  const photoH = Math.round(H * (format === "story" ? 0.56 : 0.62));
  const photo = tour.photo ? await loadImage(tour.photo) : null;
  if (photo) {
    const scale = Math.max(W / photo.width, photoH / photo.height);
    const w = photo.width * scale;
    const h = photo.height * scale;
    ctx.drawImage(photo, (W - w) / 2, (photoH - h) / 2, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, photoH);
    g.addColorStop(0, "#1E5B4F");
    g.addColorStop(1, "#4FA08D");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, photoH);
  }
  // A soft fade into the text panel.
  const fade = ctx.createLinearGradient(0, photoH - 220, 0, photoH);
  fade.addColorStop(0, "rgba(18,51,45,0)");
  fade.addColorStop(1, "rgba(18,51,45,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, photoH - 220, W, 220);
  ctx.fillStyle = "#12332D";
  ctx.fillRect(0, photoH, W, H - photoH);

  // The mark and the name, top left over the photo.
  const mark = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(MARK)}`);
  ctx.fillStyle = "rgba(18,51,45,0.72)";
  ctx.beginPath();
  ctx.roundRect(48, 48, 300, 96, 48);
  ctx.fill();
  if (mark) ctx.drawImage(mark, 66, 60, 72, 72);
  ctx.fillStyle = "#FFFDF8";
  ctx.font = font(700, 46);
  ctx.textBaseline = "middle";
  ctx.fillText("Culmen", 152, 97);

  // The text.
  const pad = 72;
  const inner = W - pad * 2;
  let y = photoH + (format === "story" ? 40 : 10);
  ctx.textBaseline = "top";
  ctx.font = font(700, format === "story" ? 76 : 68);
  for (const l of wrap(ctx, tour.title, inner, 3)) {
    ctx.fillStyle = "#FFFDF8";
    ctx.fillText(l, pad, y);
    y += format === "story" ? 92 : 82;
  }
  y += 24;
  const row = (icon: string, text: string, color = "#F3EADA") => {
    ctx.font = font(600, 40);
    ctx.fillStyle = "#F7CE7A";
    ctx.fillText(icon, pad, y);
    ctx.fillStyle = color;
    for (const l of wrap(ctx, text, inner - 64, 2)) {
      ctx.fillText(l, pad + 64, y);
      y += 52;
    }
    y += 12;
  };
  row("📅", tour.when);
  if (tour.place) row("📍", tour.place);
  row("🏔", `${tour.organiserLabel}՝ ${tour.club}`);

  // The address at the foot, on an orange band.
  const band = 120;
  ctx.fillStyle = "#C9491F";
  ctx.fillRect(0, H - band, W, band);
  ctx.fillStyle = "#FFFDF8";
  ctx.font = font(700, 40);
  ctx.textBaseline = "middle";
  // Only the site: a long link cannot be tapped on a picture anyway.
  const foot = `${tour.signUpLabel}՝ ${tour.url.replace(/^https?:\/\//, "").split("/")[0]}`;
  ctx.fillText(wrap(ctx, foot, inner, 1)[0], pad, H - band / 2);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9));
}

// Phones: the system sheet with the picture (Instagram, Telegram…); elsewhere
// the picture is downloaded. Returns how it went.
export async function shareOrDownload(blob: Blob, name: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], name, { type: "image/jpeg" });
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return "downloaded";
}
