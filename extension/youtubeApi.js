/**
 * YouTube API client
 * Handles API key retrieval, storage, and standard requests.
 */
const YouTubeApi = {
  getApiKey() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get("youtubeApiKey", (result) => {
          resolve(result.youtubeApiKey);
        });
      } else {
        // Fallback for Node.js unit tests or debugging
        resolve(global.youtubeApiKey);
      }
    });
  },

  setApiKey(key) {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ youtubeApiKey: key }, () => {
          resolve();
        });
      } else {
        global.youtubeApiKey = key;
        resolve();
      }
    });
  },

  async fetchFromApi(endpoint, params = {}) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error("YOUTUBE_API_KEY_MISSING");
    }

    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });
    url.searchParams.append("key", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorMsg = errorJson?.error?.message || `HTTP error! status: ${response.status}`;
      
      // Detect invalid API key
      if (response.status === 400 && 
          (errorMsg.includes("API key") || 
           errorMsg.toLowerCase().includes("key invalid") || 
           errorMsg.toLowerCase().includes("not valid"))) {
        throw new Error("YOUTUBE_API_KEY_INVALID");
      }
      throw new Error(errorMsg);
    }
    return await response.json();
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = YouTubeApi;
}
