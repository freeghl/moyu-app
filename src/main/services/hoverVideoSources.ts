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
  style.textContent = 'html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important;}body.moyu-hover-video-mode [data-e2e="feed-navigation-prev"],body.moyu-hover-video-mode [data-e2e="feed-navigation-next"]{display:none!important;}body.moyu-hover-video-mode *{visibility:hidden!important;}body.moyu-hover-video-mode .moyu-hover-player,body.moyu-hover-video-mode .moyu-hover-player *{visibility:visible!important;}.moyu-hover-player{width:100vw!important;height:100vh!important;margin:0!important;transform:none!important;z-index:2147483647!important;background:#000!important;overflow:hidden!important;}.moyu-hover-player video{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;object-fit:cover!important;opacity:1!important;pointer-events:none!important;z-index:0!important;}';
  document.documentElement.append(style);

  let active = false;
  let muted = true;
  let current = null;
  let moving = false;
  let lastSwitchAt = 0;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function startPlayback(video) {
    const deadline = Date.now() + 6000;
    let playingSince = 0;
    while (Date.now() < deadline) {
      try {
        const playback = video.play();
        playback?.catch(() => {});
      } catch {}
      await delay(100);
      if (video.paused) {
        playingSince = 0;
      } else {
        if (!playingSince) playingSince = Date.now();
        if (Date.now() - playingSince >= 1200) return;
      }
    }
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

  function renderCurrent() {
    if (!current) return;
    const card = current.closest('[data-e2e="feed-video"]');
    for (const element of document.querySelectorAll('.moyu-hover-player')) {
      if (element !== card) element.classList.remove('moyu-hover-player');
    }
    card?.classList.add('moyu-hover-player');
    if (card && !card.__moyuHoverSized) {
      for (const animation of card.getAnimations()) {
        if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.cancel();
      }
      card.style.setProperty('position', 'relative', 'important');
      card.style.setProperty('width', '100vw', 'important');
      card.style.setProperty('min-width', '100vw', 'important');
      card.style.setProperty('max-width', '100vw', 'important');
      card.style.setProperty('height', '100vh', 'important');
      card.style.setProperty('min-height', '100vh', 'important');
      card.style.setProperty('max-height', '100vh', 'important');
      card.style.setProperty('margin', '0', 'important');
      card.style.setProperty('transform', 'none', 'important');
      card.style.setProperty('translate', 'none', 'important');
      card.style.setProperty('inset', '0', 'important');
      for (let ancestor = card.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        ancestor.style.setProperty('width', '100vw', 'important');
        ancestor.style.setProperty('min-width', '100vw', 'important');
        ancestor.style.setProperty('max-width', '100vw', 'important');
        ancestor.style.setProperty('left', '0', 'important');
        ancestor.style.setProperty('inset', '0', 'important');
        ancestor.style.setProperty('inset-inline', '0', 'important');
        ancestor.style.setProperty('right', 'auto', 'important');
        ancestor.style.setProperty('transform', 'none', 'important');
        ancestor.style.setProperty('translate', 'none', 'important');
        ancestor.style.setProperty('padding', '0', 'important');
        ancestor.style.setProperty('margin', '0', 'important');
        ancestor.style.setProperty('margin-inline', '0', 'important');
      }
      card.__moyuHoverSized = true;
    }
    document.body.classList.add('moyu-hover-video-mode');
  }

  async function showVideo(video) {
    const previous = current;
    current = video;
    renderCurrent();
    video.muted = muted;
    previous?.pause();
    if (active) await startPlayback(video);
    return { playing: active ? !video.paused : true };
  }

  async function move(direction) {
    if (moving || (direction !== -1 && direction !== 1)) return { playing: false };
    moving = true;
    try {
      const selector = direction < 0
        ? '[data-e2e="feed-navigation-prev"]'
        : '[data-e2e="feed-navigation-next"]';
      const button = document.querySelector(selector);
      if (!button) return { playing: false };
      button.click();
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const next = findFeedVideo(current);
        if (next?.currentSrc) return await showVideo(next);
        await delay(100);
      }
      return { playing: false };
    } finally {
      moving = false;
    }
  }

  async function initialize() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const video = findFeedVideo();
      if (video?.currentSrc) return await showVideo(video);
      await delay(100);
    }
    return { playing: false };
  }

  function pause() {
    active = false;
    current?.pause();
  }

  async function play(options) {
    active = true;
    muted = Boolean(options.muted);
    if (current) current.muted = muted;
    if (!current) return initialize();
    await startPlayback(current);
    return { playing: !current.paused };
  }

  function wheel(direction) {
    if (!active || moving || Date.now() - lastSwitchAt < 650) return { playing: false };
    lastSwitchAt = Date.now();
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
    if (active && !current) void initialize();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(() => {
    if (!active || !current) return;
    renderCurrent();
    if (current.paused && !current.ended) {
      const playback = current.play();
      playback?.catch(() => {});
    }
  }, 500);
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
  let initializing = false;
  let moving = false;
  let lastSwitchAt = 0;
  let preparedNextId = '';
  let prepareNextPromise;

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
    if (active) await startPlayback(video);
    return { playing: active ? !video.paused : true };
  }

  function parseFeedVideoIds(html) {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const ids = [...document.querySelectorAll('[data-aweme-id]')]
      .map((element) => element.getAttribute('data-aweme-id'))
      .filter((id) => id && /^\d+$/.test(id));
    if (ids.length) return [...new Set(ids)];
    return [...new Set([...html.matchAll(/\/video\/(\d+)/g)].map((match) => match[1]))];
  }

  function feedVideoIds() {
    const cardIds = [...document.querySelectorAll('[data-aweme-id]')]
      .map((element) => element.getAttribute('data-aweme-id'))
      .filter((id) => id && /^\d+$/.test(id));
    if (cardIds.length) return [...new Set(cardIds)];
    const html = document.documentElement?.innerHTML || '';
    return [...new Set([...html.matchAll(/\/video\/(\d+)/g)].map((match) => match[1]))];
  }

  function chooseNextVideoId(ids, currentId = '') {
    let last = '';
    try { last = sessionStorage.getItem(LAST_VIDEO_KEY) || ''; } catch {}
    const candidates = ids.filter((id) => id !== last && id !== currentId);
    const pool = candidates.length ? candidates : ids.filter((id) => id !== currentId);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';
  }

  function prepareNext() {
    if (prepareNextPromise) return prepareNextPromise;
    if (!active || !isVideoPage()) return Promise.resolve();
    prepareNextPromise = (async () => {
      const currentId = location.pathname.match(/^\/video\/(\d+)/)?.[1] || '';
      const ids = feedVideoIds();
      if (ids.length) {
        preparedNextId = chooseNextVideoId(ids, currentId);
        return;
      }
      try {
        const response = await fetch(FEED_URL, { credentials: 'include' });
        if (!response.ok) return;
        preparedNextId = chooseNextVideoId(parseFeedVideoIds(await response.text()), currentId);
      } catch {
      }
    })().finally(() => { prepareNextPromise = null; });
    return prepareNextPromise;
  }

  function videoUrl(id) {
    return 'https://www.douyin.com/video/' + id;
  }

  async function target(direction) {
    if (!isVideoPage()) return null;
    const currentId = location.pathname.match(/^\/video\/(\d+)/)?.[1];
    if (direction < 0) {
      const history = videoHistory();
      const index = history.lastIndexOf(currentId);
      return index > 0
        ? { url: videoUrl(history[index - 1]), previousUrl: index > 1 ? videoUrl(history[index - 2]) : '' }
        : null;
    }
    if (direction > 0) {
      await prepareNext();
      return preparedNextId ? { url: videoUrl(preparedNextId), previousUrl: videoUrl(currentId) } : null;
    }
    return null;
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
    if (moving || (direction !== -1 && direction !== 1)) return { playing: false };
    moving = true;
    try {
      if (!isVideoPage()) return direction > 0 ? await initialize() : { playing: false };
      const currentId = location.pathname.match(/^\/video\/(\d+)/)?.[1];
      if (currentId) rememberVideo(currentId);
      if (direction < 0) {
        const history = videoHistory();
        const index = history.lastIndexOf(currentId);
        if (index <= 0) return { playing: false };
        const previous = history[index - 1];
        try { sessionStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history.slice(0, index))); } catch {}
        setTimeout(() => location.assign('https://www.douyin.com/video/' + previous), 0);
      } else {
        const nextId = preparedNextId || chooseNextVideoId(feedVideoIds(), currentId);
        preparedNextId = '';
        if (nextId) {
          try { sessionStorage.setItem(LAST_VIDEO_KEY, nextId); } catch {}
          setTimeout(() => location.assign('https://www.douyin.com/video/' + nextId), 0);
        } else {
          setTimeout(() => location.assign(FEED_URL), 0);
        }
      }
      return { pendingNavigation: true, playing: false };
    } finally {
      moving = false;
    }
  }

  async function initialize() {
    if (initializing) return { playing: false };
    initializing = true;
    try {
      if (isVideoPage()) {
        const currentId = location.pathname.match(/^\/video\/(\d+)/)?.[1];
        if (currentId) rememberVideo(currentId);
        const video = await waitForVideo();
        return video ? await attach(video) : { playing: false };
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
      initializing = false;
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
    if (!current) return initialize();
    await startPlayback(current);
    return { playing: !current.paused };
  }

  function wheel(direction) {
    if (!active || moving || Date.now() - lastSwitchAt < 650) return { playing: false };
    lastSwitchAt = Date.now();
    return move(direction);
  }

  function remember(value) {
    const id = String(value).match(/\/video\/(\d+)/)?.[1];
    if (id) rememberVideo(id);
  }

  async function prepare() {
    const wasActive = active;
    active = true;
    muted = true;
    try {
      const result = current ? { playing: true } : await initialize();
      if (result.pendingNavigation || !current) return { ready: false };
      current.muted = true;
      await startPlayback(current);
      current.pause();
      return { ready: true, url: location.href };
    } finally {
      active = wasActive;
    }
  }

  window.__moyuHoverVideo = {
    play,
    pause,
    wheel,
    target,
    remember,
    prepare,
    setMuted(value) {
      muted = Boolean(value);
      if (current) current.muted = muted;
    }
  };

  const observer = new MutationObserver(() => {
    if (active && !current && isVideoPage()) void initialize();
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
    const CONTROL_SELECTORS = [
      '[class*="bpx-player-control"]',
      '[class*="bpx-player-ctrl"]',
      '[class*="bilibili-player-video-control"]',
      '[class*="bpx-player-progress"]',
      '[class*="bilibili-player-video-progress"]',
      '.bpx-player-top-wrap',
      '.bpx-player-shadow-progress-area',
      '.bpx-player-sending-area',
      '.squirtle-progress-wrap',
      '.squirtle-controller-wrap'
    ].join(',');
    const style = document.createElement('style');
    style.textContent = 'html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;scrollbar-width:none!important;}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}body.moyu-hover-video-mode *{visibility:hidden!important;}body.moyu-hover-video-mode .moyu-hover-player,body.moyu-hover-video-mode .moyu-hover-player *{visibility:visible!important;}body.moyu-hover-video-mode ' + CONTROL_SELECTORS + '{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;}.moyu-hover-player{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;margin:0!important;transform:none!important;z-index:2147483647!important;background:#000!important;overflow:hidden!important;}.moyu-hover-player video{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:contain!important;opacity:1!important;}';
    document.documentElement.append(style);

    let active = false;
    let muted = true;
    let current = null;
    let playerContainer = null;
    let initializing = false;
    let moving = false;
    let lastSwitchAt = 0;
    let preparedNextUrl = '';
    let prepareNextPromise;

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

    function hidePlayerControls() {
      for (const element of document.querySelectorAll(CONTROL_SELECTORS)) {
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('opacity', '0', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
      }
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
      video.controls = false;
      video.removeAttribute('controls');
      video.muted = muted;
      hidePlayerControls();
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

    function feedLinksFrom(root) {
      const links = [];
      for (const element of root.querySelectorAll(LINK_SELECTOR)) {
        const href = element.getAttribute('href');
        if (!href) continue;
        try {
          const url = new URL(href, location.href);
          if (url.origin === location.origin && /\/video\//.test(url.pathname)) links.push(url);
        } catch {}
      }
      return [...new Map(links.map((url) => [canonicalVideoUrl(url.href), url])).values()];
    }

    function feedLinks() {
      return feedLinksFrom(document);
    }

    function chooseNextUrl(links, currentUrl = '') {
      let last = '';
      try { last = canonicalVideoUrl(sessionStorage.getItem('moyu-hover-last-video') || ''); } catch {}
      const candidates = links.filter((url) => {
        const key = canonicalVideoUrl(url.href);
        return key !== last && key !== currentUrl;
      });
      const pool = candidates.length ? candidates : links.filter((url) => canonicalVideoUrl(url.href) !== currentUrl);
      return pool.length ? canonicalVideoUrl(pool[Math.floor(Math.random() * pool.length)].href) : '';
    }

    function prepareNext() {
      if (prepareNextPromise) return prepareNextPromise;
      if (!active || !isVideoPage()) return Promise.resolve();
      prepareNextPromise = (async () => {
        const currentUrl = canonicalVideoUrl(location.href);
        const links = feedLinks();
        if (links.length) {
          preparedNextUrl = chooseNextUrl(links, currentUrl);
          return;
        }
        try {
          const response = await fetch(FEED_URL, { credentials: 'include' });
          if (!response.ok) return;
          const html = await response.text();
          const parsed = new DOMParser().parseFromString(html, 'text/html');
          preparedNextUrl = chooseNextUrl(feedLinksFrom(parsed), currentUrl);
        } catch {
        }
      })().finally(() => { prepareNextPromise = null; });
      return prepareNextPromise;
    }

    async function target(direction) {
      if (!isVideoPage()) return null;
      const currentUrl = canonicalVideoUrl(location.href);
      if (direction < 0) {
        const history = videoHistory();
        const index = history.lastIndexOf(currentUrl);
        return index > 0
          ? { url: history[index - 1], previousUrl: index > 1 ? history[index - 2] : '' }
          : null;
      }
      if (direction > 0) {
        await prepareNext();
        return preparedNextUrl ? { url: preparedNextUrl, previousUrl: currentUrl } : null;
      }
      return null;
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
      if (moving || (direction !== -1 && direction !== 1)) return { playing: false };
      moving = true;
      try {
        if (!isVideoPage()) return direction > 0 ? await initialize() : { playing: false };
        const currentUrl = canonicalVideoUrl(location.href);
        rememberVideo(currentUrl);
        if (direction < 0) {
          const history = videoHistory();
          const index = history.lastIndexOf(currentUrl);
          if (index <= 0) return { playing: false };
          const previous = history[index - 1];
          try { sessionStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history.slice(0, index))); } catch {}
          setTimeout(() => location.assign(previous), 0);
        } else {
          const nextUrl = preparedNextUrl || chooseNextUrl(feedLinks(), currentUrl);
          preparedNextUrl = '';
          if (nextUrl) {
            try { sessionStorage.setItem('moyu-hover-last-video', nextUrl); } catch {}
            setTimeout(() => location.assign(nextUrl), 0);
          } else {
            setTimeout(() => location.assign(FEED_URL), 0);
          }
        }
        return { pendingNavigation: true, playing: false };
      } finally {
        moving = false;
      }
    }

    async function initialize() {
      if (initializing) return { playing: false };
      initializing = true;
      try {
        if (isVideoPage()) {
          rememberVideo(canonicalVideoUrl(location.href));
          const video = await waitForVideo();
          return video ? await attach(video) : { playing: false };
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
        initializing = false;
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
      if (!current) return initialize();
      await startPlayback(current);
      return { playing: !current.paused };
    }

    function wheel(direction) {
      if (!active || moving || Date.now() - lastSwitchAt < 650) return { playing: false };
      lastSwitchAt = Date.now();
      return move(direction);
    }

    function remember(value) {
      const url = canonicalVideoUrl(value);
      if (url) rememberVideo(url);
    }

    async function prepare() {
      const wasActive = active;
      active = true;
      muted = true;
      try {
        const result = current ? { playing: true } : await initialize();
        if (result.pendingNavigation || !current) return { ready: false };
        current.muted = true;
        await startPlayback(current);
        current.pause();
        return { ready: true, url: location.href };
      } finally {
        active = wasActive;
      }
    }

    window.__moyuHoverVideo = {
      play,
      pause,
      wheel,
      target,
      remember,
      prepare,
      setMuted(value) {
        muted = Boolean(value);
        if (current) current.muted = muted;
      }
    };

    const observer = new MutationObserver(() => {
      hidePlayerControls();
      if (active && !current && isVideoPage()) void initialize();
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
