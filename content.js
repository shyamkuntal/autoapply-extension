
window.__liCollecting = false;

const HIRING_KEYWORDS = [
  'hiring', 'we are hiring', "we're hiring", 'now hiring',
  'job opening', 'job opportunity', 'open position', 'open role',
  'looking for', 'seeking', 'join our team', 'join us',
  'career opportunity', 'apply now', 'apply here', 'apply today',
  'vacancy', 'vacancies', 'recruitment', 'recruiter',
  'talent acquisition', 'job alert', '#hiring', '#nowhiring',
  '#jobopening', '#jobopportunity', '#careers', '#jobs',
  '#recruitment', '#jobalert', '#opentowork', '#jobsearch',
  'urgent', 'urgently hiring', 'immediate joiner', 'immediate opening',
  'freshers', 'fresher', 'entry level', 'walk-in', 'walkin'
];

console.log('[LI-Collector v4.2] Loaded on:', window.location.href);

function containsHiringKeyword(text, customKeywords = []) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const all = [...HIRING_KEYWORDS, ...customKeywords.map(k => k.toLowerCase())];
  return all.some(kw => lower.includes(kw));
}

function getMatchedKeywords(text, customKeywords = []) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const all = [...HIRING_KEYWORDS, ...customKeywords.map(k => k.toLowerCase())];
  return all.filter(kw => lower.includes(kw));
}


const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+\s*(?:@|\[at\]|\(at\)|\bat\b)\s*[a-zA-Z0-9.\-]+\s*(?:\.|\.\s*|\[dot\]|\(dot\)|\bdot\b)\s*[a-zA-Z]{2,}/gi;

function extractEmail(text) {
  if (!text) return null;
  EMAIL_REGEX.lastIndex = 0;
  const matches = text.match(EMAIL_REGEX);
  if (!matches || matches.length === 0) return null;
  return matches[0]
    .replace(/\s*\[at\]\s*/gi, '@').replace(/\s*\(at\)\s*/gi, '@').replace(/\s+at\s+/gi, '@')
    .replace(/\s*\[dot\]\s*/gi, '.').replace(/\s*\(dot\)\s*/gi, '.').replace(/\s+dot\s+/gi, '.')
    .replace(/\s/g, '').toLowerCase();
}

function findPostContainer(el) {
  let node = el;
  for (let i = 0; i < 15; i++) {
    if (!node || node === document.body) break;
    node = node.parentElement;
    if (!node) break;
    const tag  = node.tagName;
    const role = node.getAttribute('role');
    const dataId  = node.getAttribute('data-id')  || '';
    const dataUrn = node.getAttribute('data-urn') || '';
    if (dataId.includes('urn:li:activity') || dataUrn.includes('urn:li:activity')) return node;
    if (tag === 'LI' && node.closest('ul')) return node;
    if (tag === 'ARTICLE') return node;
    if (role === 'article') return node;
  }
  return el.parentElement;
}

function findPostsViaTextBoxes() {
  const textBoxes = document.querySelectorAll('[data-testid="expandable-text-box"]');
  if (textBoxes.length === 0) return [];
  const containers = new Map();
  textBoxes.forEach(tb => {
    const c = findPostContainer(tb);
    if (c && !containers.has(c)) containers.set(c, tb);
  });
  return Array.from(containers.keys());
}

function findPostsViaFeedSelectors() {
  const selectors = [
    'div[data-id^="urn:li:activity"]', 'div[data-urn^="urn:li:activity"]',
    '.feed-shared-update-v2', '.occludable-update', '.update-components-update-v2',
  ];
  for (const sel of selectors) {
    try {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) return Array.from(els);
    } catch (_) {}
  }
  return [];
}

function findPostsViaSearchSelectors() {
  const selectors = [
    'li.reusable-search__result-container', '.reusable-search__result-container',
    '.search-results__list > li', '.search-results-container li',
    '[data-chameleon-result-urn]',
  ];
  for (const sel of selectors) {
    try {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) return Array.from(els);
    } catch (_) {}
  }
  return [];
}

function findAllPostContainers() {
  const isSearch = window.location.href.includes('/search/');
  let containers = findPostsViaTextBoxes();
  if (containers.length > 0) return { containers, method: 'testid-anchor' };
  if (isSearch) {
    containers = findPostsViaSearchSelectors();
    if (containers.length > 0) return { containers, method: 'search-selectors' };
  }
  containers = findPostsViaFeedSelectors();
  if (containers.length > 0) return { containers, method: 'feed-selectors' };
  const broadEls = Array.from(document.querySelectorAll('li, article')).filter(el => {
    return el.textContent.trim().length > 100 && el.querySelector('a[href*="linkedin.com"]');
  });
  if (broadEls.length > 0) return { containers: broadEls, method: 'broad-fallback' };
  return { containers: [], method: 'none' };
}

function extractDescription(container) {
  const textBox = container.querySelector('[data-testid="expandable-text-box"]');
  if (textBox) {
    const clone = textBox.cloneNode(true);
    const btn = clone.querySelector('[data-testid="expandable-text-button"]');
    if (btn) btn.remove();
    const text = clone.textContent.trim();
    if (text.length > 5) return text;
  }
  const classicSelectors = [
    '.update-components-text.update-components-update-v2__commentary',
    '.update-components-text', '.feed-shared-text__text-view',
    '.feed-shared-update-v2__description',
    '[data-test-id="main-feed-activity-card__commentary"]',
    '.attributed-text-segment-list__content',
  ];
  for (const sel of classicSelectors) {
    try {
      const el = container.querySelector(sel);
      if (el) {
        let text = el.textContent.trim().replace(/…more$/i, '').replace(/\.\.\.more$/i, '').trim();
        if (text.length > 10) return text;
      }
    } catch (_) {}
  }
  const spans = container.querySelectorAll('span[dir="ltr"]');
  for (const span of spans) {
    const text = span.textContent.trim();
    if (text.length > 30) return text;
  }
  return '';
}

function extractAuthor(container) {
  const selectors = [
    '[data-testid="actor-name"]', '[data-testid="feed-actor-name"]',
    '.update-components-actor__name span[aria-hidden="true"]',
    '.feed-shared-actor__name span[aria-hidden="true"]',
    '.update-components-actor__name', '.feed-shared-actor__name',
    '.artdeco-entity-lockup__title span[aria-hidden="true"]',
    'a[data-field="actor"] span[aria-hidden="true"]',
    'a[href*="/in/"] span[aria-hidden="true"]',
    'a[href*="/company/"] span[aria-hidden="true"]',
  ];
  for (const sel of selectors) {
    try {
      const el = container.querySelector(sel);
      if (el) {
        const text = el.textContent.trim();
        if (text && text.length > 1 && text.length < 100) return text;
      }
    } catch (_) {}
  }
  return 'Unknown Author';
}

function extractAuthorTitle(container) {
  const selectors = [
    '[data-testid="actor-description"]',
    '.update-components-actor__description span[aria-hidden="true"]',
    '.feed-shared-actor__description span[aria-hidden="true"]',
    '.artdeco-entity-lockup__subtitle span[aria-hidden="true"]',
  ];
  for (const sel of selectors) {
    try {
      const el = container.querySelector(sel);
      if (el) {
        const text = el.textContent.trim();
        if (text && text.length > 1) return text;
      }
    } catch (_) {}
  }
  return '';
}

function extractPostUrl(container) {
  const selectors = [
    'a[href*="/posts/"]', 'a[href*="/feed/update/"]',
    'a[href*="linkedin.com/feed/update"]', 'a[data-field="timestamp"]',
    'a[data-view-name="feed-shared-main-feed-card-timestamp"]',
    '.update-components-actor__meta-link',
  ];
  for (const sel of selectors) {
    try {
      const el = container.querySelector(sel);
      if (el && el.href && el.href.includes('linkedin.com')) return el.href;
    } catch (_) {}
  }
  return '';
}

function extractTimestamp(container) {
  const selectors = [
    'a[data-field="timestamp"] span[aria-hidden="true"]',
    '.update-components-actor__sub-description span[aria-hidden="true"]',
    'time', '[data-testid="feed-shared-main-feed-card-timestamp"]',
  ];
  for (const sel of selectors) {
    try {
      const el = container.querySelector(sel);
      if (el) {
        const t = el.getAttribute('datetime') || el.textContent.trim();
        if (t && t.length > 0) return t;
      }
    } catch (_) {}
  }
  return '';
}

function extractCount(container, selectors) {
  for (const sel of selectors) {
    try {
      const el = container.querySelector(sel);
      if (el) {
        const match = el.textContent.trim().replace(/,/g, '').match(/\d+/);
        if (match) return parseInt(match[0]);
      }
    } catch (_) {}
  }
  return 0;
}

function extractLikes(c)    { return extractCount(c, ['.social-details-social-counts__reactions-count','button[aria-label*="reaction"] span[aria-hidden="true"]','[data-testid="social-actions__reaction-count"]']); }
function extractComments(c) { return extractCount(c, ['button[aria-label*="comment"] span[aria-hidden="true"]','[data-testid="social-actions__comments"] span[aria-hidden="true"]']); }
function extractShares(c)   { return extractCount(c, ['button[aria-label*="repost"] span[aria-hidden="true"]','[data-testid="social-actions__reposts"] span[aria-hidden="true"]']); }


function processContainer(container, customKeywords, seen) {
  const description = extractDescription(container);
  if (!description || description.length < 10) return null;

  
  const key = description.substring(0, 80);
  if (seen.has(key)) return null;
  seen.add(key);

  const author   = extractAuthor(container);
  const fullText = `${author} ${description}`;

  
  if (!containsHiringKeyword(fullText, customKeywords)) return null;

  
  const email = extractEmail(fullText);
  if (!email) return null;

  return {
    id: -1, // assigned by caller
    collectedAt: new Date().toISOString(),
    postedAt:    extractTimestamp(container),
    author,
    authorTitle: extractAuthorTitle(container),
    description,
    email,
    likes:    extractLikes(container),
    comments: extractComments(container),
    shares:   extractShares(container),
    postUrl:  extractPostUrl(container),
    matchedKeywords: getMatchedKeywords(fullText, customKeywords),
  };
}


function sendProgress(collected, target, scrollRound, status) {
  try {
    chrome.runtime.sendMessage({
      action: 'scrollProgress',
      collected, target, scrollRound, status
    });
  } catch (_) {} 
}

async function autoScrollAndCollect(targetCount, customKeywords) {
  const posts   = [];
  const seen    = new Set();
  const MAX_SCROLL_ROUNDS = 30;  
  const SCROLL_WAIT_MS    = 2200; 
  const MAX_STALE_ROUNDS  = 3;

  let scrollRound  = 0;
  let staleRounds  = 0;
  let method       = 'unknown';
  let skipped      = 0;

  console.log(`[LI-Collector] Auto-scroll: target=${targetCount}`);

  while (posts.length < targetCount && scrollRound < MAX_SCROLL_ROUNDS) {
    scrollRound++;
    sendProgress(posts.length, targetCount, scrollRound, 'scrolling');

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

    await new Promise(r => setTimeout(r, SCROLL_WAIT_MS));

    sendProgress(posts.length, targetCount, scrollRound, 'extracting');

    const { containers, method: m } = findAllPostContainers();
    method = m;

    if (containers.length === 0 && scrollRound === 1) {
      return { posts: [], skipped: 0, reason: 'no_containers', method };
    }

    const prevCount = posts.length;

    for (const container of containers) {
      if (posts.length >= targetCount) break;
      try {
        const post = processContainer(container, customKeywords, seen);
        if (post) {
          post.id = posts.length + 1;
          posts.push(post);
          console.log(`[LI-Collector] ✅ #${post.id}: ${post.author.substring(0, 30)} — ${post.email}`);
        } else {
          skipped++;
        }
      } catch (err) {
        console.warn('[LI-Collector] Container error:', err.message);
      }
    }

    const newThisRound = posts.length - prevCount;
    console.log(`[LI-Collector] Round ${scrollRound}: +${newThisRound} posts (total ${posts.length}/${targetCount})`);

    if (newThisRound === 0) {
      staleRounds++;
      console.log(`[LI-Collector] Stale round ${staleRounds}/${MAX_STALE_ROUNDS}`);
      if (staleRounds >= MAX_STALE_ROUNDS) {
        console.log('[LI-Collector] No new posts after stale rounds — stopping scroll');
        break;
      }
    } else {
      staleRounds = 0; 
    }
  }

  sendProgress(posts.length, targetCount, scrollRound, 'done');
  console.log(`[LI-Collector] Finished: ${posts.length} posts in ${scrollRound} scroll rounds`);
  return { posts, skipped, method, scrollRounds: scrollRound };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[LI-Collector] Message:', request.action);

  if (request.action === 'ping') {
    sendResponse({ success: true, message: 'pong' });
    return true;
  }

  if (request.action === 'collectPosts') {
    if (window.__liCollecting) {
      sendResponse({ success: false, message: 'Collection already in progress' });
      return true;
    }
    window.__liCollecting = true;

    const customKeywords = request.customKeywords || [];
    const targetCount    = request.targetCount    || 10;

    
    autoScrollAndCollect(targetCount, customKeywords).then(({ posts, skipped, reason, method, scrollRounds }) => {
      window.__liCollecting = false;

      if (posts.length === 0) {
        if (reason === 'no_containers') {
          sendResponse({
            success: false,
            message: `No post containers found (method: ${method}). Try scrolling down manually first, then collect again.`,
            debug: { url: window.location.href, bodyLength: document.body.innerHTML.length }
          });
        } else {
          sendResponse({
            success: false,
            message: `No hiring posts with email found after ${scrollRounds} scroll rounds (${skipped} posts scanned). Try adding custom keywords or scrolling manually.`,
            skipped
          });
        }
        return;
      }

      const result = {
        success: true,
        data: {
          collectedAt:     new Date().toISOString(),
          url:             window.location.href,
          pageType:        window.location.href.includes('/search/') ? 'search' : 'feed',
          detectionMethod: method,
          scrollRounds,
          totalPosts:      posts.length,
          skippedPosts:    skipped,
          targetCount,
          keywords:        [...HIRING_KEYWORDS, ...customKeywords],
          posts
        }
      };

      chrome.storage.local.set({ linkedinPosts: result.data }, () => {
        sendResponse(result);
      });

    }).catch(err => {
      window.__liCollecting = false;
      console.error('[LI-Collector] Fatal:', err);
      sendResponse({ success: false, message: 'Error: ' + err.message });
    });

    return true;
  }

  if (request.action === 'getStoredPosts') {
    chrome.storage.local.get(['linkedinPosts'], (result) => {
      sendResponse({ success: true, data: result.linkedinPosts || null });
    });
    return true;
  }
});

console.log('[LI-Collector v4.2] Ready on', window.location.href);