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

  async function move(advance) {
    if (moving) return { playing: false };
    moving = true;
    try {
      if (advance) document.querySelector('[data-e2e="feed-navigation-next"]')?.click();
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
            if (active) void move(true);
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
      const result = await move(Boolean(options.advance));
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

  window.__moyuHoverVideo = {
    play,
    pause,
    setMuted(value) {
      muted = Boolean(value);
      if (current) current.muted = muted;
    }
  };

  const observer = new MutationObserver(() => {
    if (active && !current && !moving) void move(false);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})()`

function createRandomPlayerScript(feedUrl: string, linkSelector: string): string {
  return String.raw`(() => {
    if (window.__moyuHoverVideo) return;

    const FEED_URL = ${JSON.stringify(feedUrl)};
    const LINK_SELECTOR = ${JSON.stringify(linkSelector)};
    const style = document.createElement('style');
    style.textContent = 'body.moyu-hover-video-mode *{visibility:hidden!important;}body.moyu-hover-video-mode .moyu-hover-player,body.moyu-hover-video-mode .moyu-hover-player *{visibility:visible!important;}.moyu-hover-player{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;margin:0!important;transform:none!important;z-index:2147483647!important;background:#000!important;overflow:hidden!important;}.moyu-hover-player video{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:contain!important;opacity:1!important;}';
    document.documentElement.append(style);

    let active = false;
    let muted = true;
    let current = null;
    let playerContainer = null;
    let moving = false;

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
        if (active) location.assign(FEED_URL);
      });
      if (active) await startPlayback(video);
      return { playing: active ? !video.paused : true };
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
      return [...new Map(links.map((url) => [url.href, url])).values()];
    }

    async function move(advance) {
      if (moving) return { playing: false };
      moving = true;
      try {
        if (isVideoPage()) {
          if (!advance) {
            const video = await waitForVideo();
            return video ? await attach(video) : { playing: false };
          }
          setTimeout(() => location.assign(FEED_URL), 0);
          return { pendingNavigation: true, playing: false };
        }

        const links = feedLinks();
        if (!links.length) return { playing: false };
        let last = '';
        try { last = sessionStorage.getItem('moyu-hover-last-video') || ''; } catch {}
        const candidates = links.filter((url) => url.href !== last);
        const pool = candidates.length ? candidates : links;
        const next = pool[Math.floor(Math.random() * pool.length)];
        try { sessionStorage.setItem('moyu-hover-last-video', next.href); } catch {}
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
      if (!current || options.advance) return move(Boolean(options.advance));
      await startPlayback(current);
      return { playing: !current.paused };
    }

    window.__moyuHoverVideo = {
      play,
      pause,
      setMuted(value) {
        muted = Boolean(value);
        if (current) current.muted = muted;
      }
    };

    const observer = new MutationObserver(() => {
      if (active && !current && !moving && isVideoPage()) void move(false);
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
    playerScript: createRandomPlayerScript('https://www.douyin.com/', '[href*="/video/"]'),
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
