const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (videoIdPattern.test(input)) return input;

  try {
    const url = new URL(input);
    if (url.protocol !== 'https:') return null;
    const youtubeHost = ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname);
    let id;
    if (url.hostname === 'youtu.be') {
      id = url.pathname.slice(1);
    } else if (youtubeHost && url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else if (youtubeHost) {
      id = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)$/)?.[1];
    }
    return id && videoIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function finderVideoUrl(settings, language, slot, fallbackId) {
  const id = youtubeVideoId(settings?.[language]?.[slot]) || youtubeVideoId(fallbackId);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
