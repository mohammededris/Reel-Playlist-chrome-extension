Instagram Reels Viewer Playlist

What it does

- Provides a popup UI to add Instagram reel URLs to a queue.
- "Open Viewer" opens (or reuses) a tab and loads the first URL in the queue.
- "Next" rotates the queue (moves first to the end) and loads the new first URL — creating a loop.

How to load the extension (Chrome / Edge)

1. Open Chrome and go to chrome://extensions
2. Enable "Developer mode" (top-right)
3. Click "Load unpacked" and choose this folder:

Notes & next improvements

- The extension uses chrome.storage.local to persist the queue and the viewer tab id.
- Improvements: validate instagram domain, add per-item remove, auto-advance when video ends (requires content script), nicer UI.
