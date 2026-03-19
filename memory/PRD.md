# Aura Browser - Product Requirements Document

## Overview
Aura Browser is a privacy-focused AI-powered mobile browser built with React Native/Expo (frontend) and FastAPI (backend). It features intelligent tab management, AI-powered page summarization, privacy shielding, and an accessible browsing experience.

## Architecture
- **Frontend**: React Native + Expo SDK 54, Expo Router, WebView, Zustand state management
- **Backend**: FastAPI + MongoDB + Emergent Integrations (GPT-4o)
- **Styling**: Deep dark theme (#0D0D0D), Electric Cyan (#00FFFF) accent, Aura Blue (#00F2FF)

## Core Features Implemented

### Browser Engine
- WebView-based browsing with tab management
- Chrome-like navigation bar (5-icon: Home, Library, AI Agent, Tabs, Menu)
- Desktop mode toggle with user agent switching
- Native pinch-to-zoom on all sites
- Pull-to-refresh (native)
- Swipe navigation (Android)
- Find in Page

### AI Features
- Tab categorization via GPT-4o (with URL-based fallback)
- AI brief generation for tab groups
- AI agent command execution
- AI Summarize drawer
- Semantic history service
- Predictive caching

### Privacy & Security
- Aggressive ad/tracker blocking (network + JS injection)
- Do Not Track header injection
- VPN service
- Ghost Mode
- Privacy Shredder (data burn)
- Burn This Site
- Bot detection / reCAPTCHA fix (mobile User-Agent, DuckDuckGo default)

### Accessibility
- Live Captions overlay
- Text-to-Speech (Read Aloud) with control bar
- Ambient Awareness alerts
- Accessibility modal

### AURA Shield Panel ✅ (Feb 2026)
- **Layout Fix**: Tabular-nums font variant for consistent column alignment across iOS/Android/Web
- **Counter Mechanism**: Dual counting — network-level blocking in `onShouldStartLoadWithRequest` + DOM-level via injected MutationObserver in adblock.ts
- **Secure Status**: Green (#00FF88) connection indicator
- **Persistence**: Counts stored/loaded via AsyncStorage through PrivacyContext

### Bottom Navigation Bar ✅ (Feb 2026)
- **Absolutely positioned overlay**: Bar overlays WebView at bottom (position: absolute, bottom: 0), WebView fills full screen
- **Auto-hide on scroll**: translateY animation slides bar 200px down when scrolling down, returns on scroll up
- **Ultra-compact**: URL bar 30px + nav row 32px = ~66px total (+ safe area on devices)
- **No empty space**: Zero padding below icons, dock flush with screen bottom
- **Home page dock**: FloatingIslandDock absolutely positioned at bottom, full-width, no bottom border radius

### Downloads Manager (Feb 2026) ✅
**Core (v1):**
- WebView download interception (iOS onFileDownload + Android URL pattern matching)
- FileDownloadManager service with progress tracking
- DownloadToast for real-time download progress
- DownloadsModal — full-screen file manager with file type icons, tap-to-open (Sharing API), delete, clear all
- Downloads persisted to AsyncStorage
- Menu → Downloads button opens DownloadsModal

**Enhancements (v2):**
- **Active Downloads with Live Progress**: Zustand store (`useDownloadsStore`) tracks all active downloads with real-time progress bars displayed at the top of DownloadsModal
- **Search & Filter**: Search bar filters by filename; filter chips by file type (All, Docs, Images, Audio, Video, Archives) with extension-based categorization
- **Batch Download Support**: Long-press enables multi-select mode with checkboxes, bulk delete, select-all. "Download All Links" menu item scans current page for downloadable `<a>` href links via JS injection
- **Background Download Notifications**: `DownloadNotificationBanner` — persistent floating banner when downloads are active and modal is closed, shows aggregate progress, tap to open modal, auto-dismisses on completion
- **Auto-Categorization**: Files automatically sorted into 5 folders (Documents, Images, Media, Archives, Other) based on extension. Group-by-Category view with collapsible section headers, category badges on each file row, backfill for legacy items

### Image Context Menu (Feb 2026) ✅
- Custom AI-ready long-press context menu replacing default browser menu for images
- Animated bottom sheet with Aura aesthetic: image preview, URL display, drag handle
- Actions: Download Securely, Copy Image URL, Share Image, Aura Vision (Extract Text — Coming Soon)
- Backdrop tap to dismiss, spring animation, haptic feedback

### Text Selection — Aura Action Pill (Feb 2026) ✅
- Floating frosted-glass horizontal pill replaces default system text selection bubble
- Triggered via `selectionchange` listener (150ms debounce) — slides up when text highlighted, fades out when cleared
- 4 tools: Clean Copy (clipboard), Insight (AI placeholder), Flashcard (full-screen 48pt bold text modal), Share (native share sheet)
- FlashcardModal: dark overlay with large centered text, spring scale animation, tap-anywhere dismiss
- Unified injected JS: contextmenu handles images only, selectionchange handles text

### Settings Screen ✅ (Feb 2026)
- **Dark Theme Redesign**: Deep dark (#0a0a0f) background, glassmorphic cards (rgba(255,255,255,0.05) + blur), cyan section headers, cyan active toggles, red glowing burn button
- **ThemeProvider Integration**: AuraDarkTheme applied globally via @react-navigation/native ThemeProvider in _layout.tsx
- **All Settings Functional**:
  - Default Search Engine: Modal with Google, DuckDuckGo, Brave, Bing — AsyncStorage persisted
  - Local AI Assistant: Toggle (strictLocalAI)
  - Ad & Tracker Shield: Toggle (aggressiveAdBlocking) — consumed in WebView network interception
  - Strict Do Not Track: Toggle (doNotTrack) — injected via DNT header
  - Burn Browsing Data: Confirmation dialog → clears AsyncStorage + history + cache
  - App Theme: Modal (Dark/Light/System)
  - Force Dark Web: Toggle → CSS invert(1) hue-rotate(180deg) injection via WebView
  - Force Enable Zoom: Toggle → WebView scalesPageToFit override
- Brave search engine added to URL parser

### Other
- YouTube Shorts optimization
- Library/History screen
- Bookmarks (star in URL bar + menu)
- Share functionality (native Share API)
- Reader Mode

## Tech Stack
- expo@54, react-native@0.81.5, react-native-webview@13.15, zustand@5
- FastAPI, MongoDB (motor), emergentintegrations (GPT-4o)

## Key Files
- `/app/frontend/app/index.tsx` - Main browser (2800+ lines)
- `/app/frontend/app/settings.tsx` - Settings screen
- `/app/frontend/src/components/BrowserMenu.tsx` - 3-dot menu
- `/app/frontend/src/components/NewTabPage.tsx` - Home/New tab page with AURA Shield
- `/app/frontend/src/components/DownloadsModal.tsx` - Downloads manager (enhanced)
- `/app/frontend/src/components/DownloadNotificationBanner.tsx` - Background download banner
- `/app/frontend/src/components/AuraActionPill.tsx` - Text selection floating pill
- `/app/frontend/src/components/ImageContextMenu.tsx` - Image long-press menu
- `/app/frontend/src/store/useDownloadsStore.ts` - Active downloads Zustand store
- `/app/frontend/src/services/FileDownloadManager.ts` - Download service
- `/app/frontend/src/context/PrivacyContext.tsx` - Ad/tracker count management
- `/app/frontend/src/utils/adblock.ts` - Ad blocking + counting logic
- `/app/backend/server.py` - All API routes

## Upcoming Tasks
- **(P1) Wire AI Actions**: Implement Explain/Summarize in AuraActionPill + Aura Vision in ImageContextMenu using GPT-4o
- **(P2) Add Define Button**: Dictionary lookups in AuraActionPill
- **(P2) Add Translate Button**: Translation in text/image menus
- **(P3) Downloads Storage Insights**: Visual chart of storage by category
- **(P3) Cloud Sync**: Backup/sync for bookmarks and download history

## Refactoring Completed (Feb 2026)
- `index.tsx` refactored from 2855 → 545 lines (81% reduction)
- 7 custom hooks extracted: useAutoHideBar, useReaderMode, useFindInPage, useDownloads, useAISummarize, useBrowserNavigation, useWebViewEngine
- 4 components extracted: FindInPageBar, AISummarizerDrawer, BotDetectionBanner, PrivacyShredderToast
- All features preserved and verified via testing agent

## Performance Optimizations (Feb 2026) ✅

### 1. WebView Performance
- **Hardware Acceleration**: `androidLayerType="hardware"`, `renderToHardwareTextureAndroid={true}` for GPU rendering
- **Cache Optimization**: `cacheMode="LOAD_CACHE_ELSE_NETWORK"` for instant loads from cache
- **Smooth Rendering**: `shouldRasterizeIOS={true}` on animated views

### 2. DNS Prefetching
- Quick Access domains pre-resolved on app startup
- Local DNS cache with 30-minute TTL
- Favicon preloading for instant display

### 3. Lazy Loading & Code Splitting
- Heavy modals (BrowserMenu, Downloads, AI Summarizer, etc.) use `React.lazy()` with Suspense
- Only critical components loaded on startup

### 4. Memory Management
- Tab Virtualization Service: Pauses background tabs, limits to 5 active WebViews
- Auto-destroy tabs inactive >10 minutes
- Video buffer cleanup on navigation

### 5. Smooth Animations
- All animations use `useNativeDriver: true`
- `shouldRasterizeIOS` and `renderToHardwareTextureAndroid` on animated components
- Auto-hide bar uses 200px translateY animation

### 6. Startup Time Optimization
- Batch AsyncStorage reads via StartupOptimizer service
- WebView pre-warming on app launch
- Parallel DNS prefetch + storage load + WebView init

### 7. JavaScript Thread Optimization
- URL bar input debounced (300ms) but with instant UI feedback
- `useMemo()` for isNewTabPage, webViewKey computations
- `useCallback()` for all handlers
- `React.memo()` on UnifiedTopBar, NewTabPage components

### 8. Build Optimization
- Hermes JS engine enabled (`jsEngine: "hermes"` in app.json)
- Babel config with production console removal

### 9. Link Prefetching (Smart Predictive Cache) ✅ COMPLETE
- **Network Detection**: Uses `@react-native-community/netinfo` to detect WiFi vs mobile data
- **Battery Check**: Uses `expo-battery` to check battery > 20%
- **Smart Link Extraction**: Injected JS extracts top 5 links based on:
  - Above-the-fold position (visible without scrolling)
  - Main content area (not header/footer)
  - Previously visited pages (cross-referenced with history)
  - Link prominence scoring algorithm
- **Background Prefetching**: Fetches HTML of predicted links silently
- **Instant Loading**: Serves cached HTML when user taps prefetched link
- **Smart Conditions**:
  - Only prefetches on WiFi (saves mobile data)
  - Only when battery > 20%
  - Only when browser is idle (not loading)
  - Max 5 concurrent prefetches
  - Cancel all prefetches on navigation
- **Cache Policy**: 5-minute TTL, max 5 pages, 20MB limit

### Key Performance Services
- `/app/frontend/src/services/StartupOptimizer.ts` - Batch startup loading
- `/app/frontend/src/services/WebViewPrewarmer.ts` - WebView pre-warming
- `/app/frontend/src/services/TabVirtualizationService.ts` - Memory management
- `/app/frontend/src/services/DNSPrefetchService.ts` - DNS & favicon caching

