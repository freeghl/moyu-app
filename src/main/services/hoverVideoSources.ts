import type { HoverVideoSourceId } from '@shared/hoverVideo'

export interface HoverVideoSourceDefinition {
  id: HoverVideoSourceId
  name: string
  feedUrl: string
  loginUrl: string
  partition: string
  loginCookieNames: readonly string[]
  playerScript: string
  allowsUrl: (value: string) => boolean
}

const TIKTOK_PLAYER_SCRIPT = String.raw`(() => {
  if (window.__moyuHoverVideo) return;

  const style = document.createElement('style');
  style.textContent = 'body.moyu-hover-video-mode *{visibility:hidden!important;}body.moyu-hover-video-mode .moyu-hover-player,body.moyu-hover-video-mode .moyu-hover-player *{visibility:visible!important;}.moyu-hover-player{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;margin:0!important;transform:none!important;z-index:2147483647!important;background:#000!important;overflow:hidden!important;}.moyu-hover-player video{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;opacity:1!important;}';
  document.documentElement.append(style);

  let active = false;
  let muted = true;
  let current = null;
  let moving = false;
  let lastWheelAt = 0;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function startPlayback(video) {
    try {
      const playback = video.play();
      playback?.catch(() => {});
    } catch {}
    const deadline = Date.now() + 4000;
    while (video.paused && Date.now() < deadline) await delay(50);
  }

  function findFeedVideo(exclude) {
    return [...document.querySelectorAll('[data-e2e="feed-video"] video')].find((video) => {
      if (video === exclude) return false;
      const card = video.closest('[data-e2e="feed-video"]');
      if (!card) return false;
      const rect = card.getBoundingClientRect();
      return rect.top < innerHeight / 2 && rect.bottom > innerHeight / 2;
    });
  }

  async function move(direction) {
    if (moving) return { playing: false };
    moving = true;
    try {
      if (direction < 0) document.querySelector('[data-e2e="feed-navigation-prev"]')?.click();
      else if (direction > 0) document.querySelector('[data-e2e="feed-navigation-next"]')?.click();
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const next = findFeedVideo(current);
        if (next?.currentSrc) {
          const previous = current;
          previous?.classList.remove('moyu-hover-video');
          previous?.closest('[data-e2e="feed-video"]')?.classList.remove('moyu-hover-player');
          const nextCard = next.closest('[data-e2e="feed-video"]');
          nextCard?.classList.add('moyu-hover-player');
          document.body.classList.add('moyu-hover-video-mode');
          current = next;
          next.muted = muted;
          next.addEventListener('ended', () => {
            if (active) void move(1);
          });
          previous?.pause();
          if (active) await startPlayback(next);
          return { playing: active ? !next.paused : true };
        }
        await delay(100);
      }
      return { playing: false };
    } finally {
      moving = false;
    }
  }

  function pause() {
    active = false;
    current?.pause();
  }

  async function play(options) {
    active = true;
    muted = Boolean(options.muted);
    if (current) current.muted = muted;
    if (!current || options.advance) {
      const result = await move(options.advance ? 1 : 0);
      if (!result.playing && current) {
        await startPlayback(current)
        return { playing: !current.paused };
      }
      return result;
    }
    if (!current) return { playing: false };
    await startPlayback(current);
    return { playing: !current.paused };
  }

  function wheel(direction) {
    if (!active || moving || Date.now() - lastWheelAt < 650) return { playing: false };
    lastWheelAt = Date.now();
    return move(direction);
  }

  window.__moyuHoverVideo = {
    play,
    pause,
    wheel,
    setMuted(value) {
      muted = Boolean(value);
      if (current) current.muted = muted;
    }
  };

  const observer = new MutationObserver(() => {
    if (active && !current && !moving) void move(0);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})()`

function createDouyinPlayerScript(): string {
  return String.raw`(() => {
  if (window.__moyuHoverVideo) return;

  const FEED_URL = 'https://www.douyin.com/jingxuan';
  const LAST_VIDEO_KEY = 'moyu-hover-last-douyin-video';
  const VIDEO_HISTORY_KEY = 'moyu-hover-douyin-video-history';
  const style = document.createElement('style');
  style.textContent = 'html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important;}body.moyu-hover-video-mode *:not(.moyu-hover-player):not(.moyu-hover-player *){visibility:hidden!important;}body.moyu-hover-video-mode .moyu-hover-player,body.moyu-hover-video-mode .moyu-hover-player *{visibility:visible!important;}.moyu-hover-player{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;transform:none!important;z-index:2147483647!important;background:#000!important;overflow:hidden!important;display:block!important;}.moyu-hover-player video{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;transform:none!important;object-fit:cover!important;object-position:center!important;opacity:1!important;}';
  document.documentElement.append(style);

  let active = false;
  let muted = true;
  let current = null;
  let playerContainer = null;
  let moving = false;
  let lastWheelAt = 0;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isVideoPage = () => /^\/video\/\d+/.test(location.pathname);

  async function startPlayback(video) {
    try {
      const playback = video.play();
      playback?.catch(() => {});
    } catch {}
    const deadline = Date.now() + 4000;
    while (video.paused && Date.now() < deadline) await delay(50);
  }

  function findVideo() {
    const videos = [...document.querySelectorAll('video')]
      .filter((video) => video.currentSrc);
    const visible = videos.filter((video) => {
      const rect = video.getBoundingClientRect();
      return rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    });
    const candidates = visible.length ? visible : videos;
    return candidates.find((video) => video.currentSrc.startsWith('blob:') && video.readyState >= 2)
      || candidates.find((video) => video.readyState >= 2 && !video.currentSrc.includes('uuu_265'))
      || candidates.find((video) => video.readyState >= 2)
      || null;
  }

  async function waitForVideo() {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      const video = findVideo();
      if (video) return video;
      await delay(100);
    }
    return null;
  }

  async function attach(video) {
    const previous = current;
    const container = document.createElement('div');
    if (video.parentElement) video.replaceWith(container);
    container.append(video);
    document.body.append(container);
    previous?.pause();
    playerContainer?.classList.remove('moyu-hover-player');
    playerContainer = container;
    current = video;
    container.classList.add('moyu-hover-player');
    document.body.classList.add('moyu-hover-video-mode');
    video.muted = muted;
    video.playsInline = true;
    const landscape = video.videoWidth > video.videoHeight;
    video.style.setProperty('object-fit', 'cover', 'important');
    video.style.setProperty('object-position', 'center', 'important');
    video.style.setProperty('transform', landscape ? 'scale(0.92)' : 'none', 'important');
    if (!video.__moyuHoverEndedHandler) {
      video.__moyuHoverEndedHandler = () => {
        if (active) void move(1);
      };
      video.addEventListener('ended', video.__moyuHoverEndedHandler);
    }
    if (active) await startPlayback(video);
    return { playing: active ? !video.paused : true };
  }

  function feedVideoIds() {
    const cardIds = [...document.querySelectorAll('[data-aweme-id]')]
      .map((element) => element.getAttribute('data-aweme-id'))
      .filter((id) => id && /^\d+$/.test(id));
    if (cardIds.length) return [...new Set(cardIds)];
    const html = document.documentElement?.innerHTML || '';
    return [...new Set([...html.matchAll(/\/video\/(\d+)/g)].map((match) => match[1]))];
  }

  function videoHistory() {
    try {
      const value = JSON.parse(sessionStorage.getItem(VIDEO_HISTORY_KEY) || '[]');
      return Array.isArray(value) ? value.filter((id) => typeof id === 'string' && /^\d+$/.test(id)) : [];
    } catch {
      return [];
    }
  }

  function rememberVideo(id) {
    const history = videoHistory();
    if (history[history.length - 1] !== id) history.push(id);
    try { sessionStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history.slice(-20))); } catch {}
  }

  async function move(direction) {
    if (moving) return { playing: false };
    moving = true;
    try {
      if (isVideoPage()) {
        const currentId = location.pathname.match(/^\/video\/(\d+)/)?.[1];
        if (currentId) rememberVideo(currentId);
        if (direction === 0) {
          const video = await waitForVideo();
          return video ? await attach(video) : { playing: false };
        }
        if (direction < 0) {
          const history = videoHistory();
          const index = history.lastIndexOf(currentId);
          if (index <= 0) return { playing: false };
          const previous = history[index - 1];
          try { sessionStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history.slice(0, index))); } catch {}
          setTimeout(() => location.assign('https://www.douyin.com/video/' + previous), 0);
          return { pendingNavigation: true, playing: false };
        }
        setTimeout(() => location.assign(FEED_URL), 0);
        return { pendingNavigation: true, playing: false };
      }

      const ids = feedVideoIds();
      if (!ids.length) return { playing: false };
      let last = '';
      try { last = sessionStorage.getItem(LAST_VIDEO_KEY) || ''; } catch {}
      const candidates = ids.filter((id) => id !== last);
      const pool = candidates.length ? candidates : ids;
      const next = pool[Math.floor(Math.random() * pool.length)];
      try { sessionStorage.setItem(LAST_VIDEO_KEY, next); } catch {}
      rememberVideo(next);
      setTimeout(() => location.assign('https://www.douyin.com/video/' + next), 0);
      return { pendingNavigation: true, playing: false };
    } finally {
      moving = false;
    }
  }

  function pause() {
    active = false;
    current?.pause();
  }

  async function play(options) {
    active = true;
    muted = Boolean(options.muted);
    if (current) current.muted = muted;
    if (!current || options.advance) return move(options.advance ? 1 : 0);
    await startPlayback(current);
    return { playing: !current.paused };
  }

  function wheel(direction) {
    if (!active || moving || Date.now() - lastWheelAt < 650) return { playing: false };
    lastWheelAt = Date.now();
    return move(direction);
  }

  window.__moyuHoverVideo = {
    play,
    pause,
    wheel,
    setMuted(value) {
      muted = Boolean(value);
      if (current) current.muted = muted;
    }
  };

  const observer = new MutationObserver(() => {
    if (active && !current && !moving && isVideoPage()) void move(0);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})()`
}

function createRandomPlayerScript(feedUrl: string, linkSelector: string): string {
  return String.raw`(() => {
    if (window.__moyuHoverVideo) return;

    const FEED_URL = ${JSON.stringify(feedUrl)};
    const LINK_SELECTOR = ${JSON.stringify(linkSelector)};
    const VIDEO_HISTORY_KEY = 'moyu-hover-video-history';
    const style = document.createElement('style');
    style.textContent = 'body.moyu-hover-video-mode *{visibility:hidden!important;}body.moyu-hover-video-mode .moyu-hover-player,body.moyu-hover-video-mode .moyu-hover-player *{visibility:visible!important;}.moyu-hover-player{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;margin:0!important;transform:none!important;z-index:2147483647!important;background:#000!important;overflow:hidden!important;}.moyu-hover-player video{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:contain!important;opacity:1!important;}';
    document.documentElement.append(style);

    let active = false;
    let muted = true;
    let current = null;
    let playerContainer = null;
    let moving = false;
    let lastWheelAt = 0;

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isVideoPage = () => /\/video\//.test(location.pathname);

    async function startPlayback(video) {
      try {
        const playback = video.play();
        playback?.catch(() => {});
      } catch {}
      const deadline = Date.now() + 4000;
      while (video.paused && Date.now() < deadline) await delay(50);
    }

    function findVideo() {
      return [...document.querySelectorAll('video')].find((video) => video.currentSrc && video.readyState >= 2)
        || [...document.querySelectorAll('video')].find((video) => video.currentSrc)
        || null;
    }

    async function waitForVideo() {
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        const video = findVideo();
        if (video) return video;
        await delay(100);
      }
      return null;
    }

    async function attach(video) {
      const previous = current;
      const container = video.closest('.xgplayer-inner, .xgplayer, .bpx-player-video-wrap, #bilibili-player') || video;
      previous?.pause();
      playerContainer?.classList.remove('moyu-hover-player');
      playerContainer = container;
      current = video;
      document.body.append(container);
      container.classList.add('moyu-hover-player');
      document.body.classList.add('moyu-hover-video-mode');
      video.muted = muted;
      video.addEventListener('ended', () => {
        if (active) void move(1);
      });
      if (active) await startPlayback(video);
      return { playing: active ? !video.paused : true };
    }

    function canonicalVideoUrl(value) {
      try {
        const url = new URL(value, location.href);
        url.search = '';
        url.hash = '';
        return url.origin + url.pathname.replace(/\/+$/, '');
      } catch {
        return '';
      }
    }

    function feedLinks() {
      const links = [];
      for (const element of document.querySelectorAll(LINK_SELECTOR)) {
        const href = element.getAttribute('href');
        if (!href) continue;
        try {
          const url = new URL(href, location.href);
          if (url.origin === location.origin && /\/video\//.test(url.pathname)) links.push(url);
        } catch {}
      }
      return [...new Map(links.map((url) => [canonicalVideoUrl(url.href), url])).values()];
    }

    function videoHistory() {
      try {
        const value = JSON.parse(sessionStorage.getItem(VIDEO_HISTORY_KEY) || '[]');
        return Array.isArray(value)
          ? value.filter((url) => typeof url === 'string').map((url) => canonicalVideoUrl(url)).filter(Boolean)
          : [];
      } catch {
        return [];
      }
    }

    function rememberVideo(url) {
      const history = videoHistory();
      if (history[history.length - 1] !== url) history.push(url);
      try { sessionStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history.slice(-20))); } catch {}
    }

    async function move(direction) {
      if (moving) return { playing: false };
      moving = true;
      try {
        if (isVideoPage()) {
          const currentUrl = canonicalVideoUrl(location.href);
          rememberVideo(currentUrl);
          if (direction === 0) {
            const video = await waitForVideo();
            return video ? await attach(video) : { playing: false };
          }
          if (direction < 0) {
            const history = videoHistory();
            const index = history.lastIndexOf(currentUrl);
            if (index <= 0) return { playing: false };
            const previous = history[index - 1];
            try { sessionStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history.slice(0, index))); } catch {}
            setTimeout(() => location.assign(previous), 0);
            return { pendingNavigation: true, playing: false };
          }
          setTimeout(() => location.assign(FEED_URL), 0);
          return { pendingNavigation: true, playing: false };
        }

        const links = feedLinks();
        if (!links.length) return { playing: false };
        let last = '';
        try { last = canonicalVideoUrl(sessionStorage.getItem('moyu-hover-last-video') || ''); } catch {}
        const candidates = links.filter((url) => canonicalVideoUrl(url.href) !== last);
        const pool = candidates.length ? candidates : links;
        const next = pool[Math.floor(Math.random() * pool.length)];
        const nextKey = canonicalVideoUrl(next.href);
        try { sessionStorage.setItem('moyu-hover-last-video', nextKey); } catch {}
        rememberVideo(nextKey);
        setTimeout(() => location.assign(next.href), 0);
        return { pendingNavigation: true, playing: false };
      } finally {
        moving = false;
      }
    }

    function pause() {
      active = false;
      current?.pause();
    }

    async function play(options) {
      active = true;
      muted = Boolean(options.muted);
      if (current) current.muted = muted;
      if (!current || options.advance) return move(options.advance ? 1 : 0);
      await startPlayback(current);
      return { playing: !current.paused };
    }

    function wheel(direction) {
      if (!active || moving || Date.now() - lastWheelAt < 650) return { playing: false };
      lastWheelAt = Date.now();
      return move(direction);
    }

    window.__moyuHoverVideo = {
      play,
      pause,
      wheel,
      setMuted(value) {
        muted = Boolean(value);
        if (current) current.muted = muted;
      }
    };

    const observer = new MutationObserver(() => {
      if (active && !current && !moving && isVideoPage()) void move(0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  })()`
}

function allowsHost(value: string, hostname: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:'
      && (parsed.hostname === hostname || parsed.hostname.endsWith(`.${hostname}`))
  } catch {
    return false
  }
}

export const HOVER_VIDEO_SOURCES: Record<HoverVideoSourceId, HoverVideoSourceDefinition> = {
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    feedUrl: 'https://www.tiktok.com/foryou',
    loginUrl: 'https://www.tiktok.com/login',
    partition: 'persist:tiktok-hover',
    loginCookieNames: ['sessionid', 'sessionid_ss', 'sid_tt'],
    playerScript: TIKTOK_PLAYER_SCRIPT,
    allowsUrl: (value) => allowsHost(value, 'tiktok.com')
  },
  douyin: {
    id: 'douyin',
    name: '抖音',
    feedUrl: 'https://www.douyin.com/',
    loginUrl: 'https://www.douyin.com/',
    partition: 'persist:douyin-hover',
    loginCookieNames: ['sessionid', 'sessionid_ss', 'sid_tt'],
    playerScript: createDouyinPlayerScript(),
    allowsUrl: (value) => allowsHost(value, 'douyin.com')
  },
  bilibili: {
    id: 'bilibili',
    name: '哔哩哔哩',
    feedUrl: 'https://www.bilibili.com/',
    loginUrl: 'https://passport.bilibili.com/login',
    partition: 'persist:bilibili-hover',
    loginCookieNames: ['SESSDATA', 'bili_jct', 'DedeUserID'],
    playerScript: createRandomPlayerScript('https://www.bilibili.com/', 'a[href*="/video/"]'),
    allowsUrl: (value) => allowsHost(value, 'bilibili.com')
  }
}
