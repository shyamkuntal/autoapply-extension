
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'savePosts') {
    chrome.storage.local.set({ linkedinPosts: request.data }, () => {
      console.log('[BG] Posts saved:', request.data?.totalPosts, 'items');
      sendResponse({ success: true });
    });
    return true;
  }
});


chrome.runtime.onInstalled.addListener(() => {
  console.log('[BG] LinkedIn Hiring Post Collector v4.0 installed');
});