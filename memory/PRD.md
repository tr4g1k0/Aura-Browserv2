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

## Background Media Playback (Feb 2026) ✅

### Features Implemented
1. **Background Audio Playback**
   - Audio continues playing when app goes to background
   - expo-av configured with `staysActiveInBackground: true`
   - Audio session set to allow background playback

2. **YouTube Background Play**
   - Page Visibility API overridden so YouTube thinks page is always visible
   - Intercepts visibilitychange events to prevent pause
   - Works with all YouTube videos including Shorts

3. **Video Control Toolbar**
   - Floating toolbar appears when video is detected playing
   - Controls: Play/Pause, Mute/Unmute, Background Play toggle, PIP (Android)
   - Auto-hides after 3 seconds of inactivity
   - Glassmorphism design with blur effect

4. **Video Detection**
   - JavaScript injected to detect video elements on any page
   - Reports video state (playing, paused, muted, duration, currentTime)
   - Monitors for new videos added dynamically (SPAs)

5. **Permissions Configured**
   - iOS: UIBackgroundModes=["audio"]
   - Android: WAKE_LOCK, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK

### Key Files
- `/app/frontend/src/services/BackgroundMediaService.ts` - Core service
- `/app/frontend/src/hooks/useBackgroundMedia.ts` - React hook
- `/app/frontend/src/components/VideoControlToolbar.tsx` - UI component

## Professional Download Manager (Feb 2026) ✅

### Features Implemented
1. **Download Interception**
   - WebView onFileDownload intercepts all file downloads
   - Supports PDF, MP3, MP4, ZIP, APK, images, documents
   - Auto-detects downloadable URLs by extension

2. **Video & Audio Downloader**
   - JavaScript injected to detect video/audio elements on pages
   - Reports media sources back to React Native
   - MediaDownloadOverlay shows download button when media detected
   - Direct download of MP4/MP3 files

3. **Download Progress UI**
   - DownloadProgressSheet bottom sheet with:
     - File name and type icon
     - Progress bar with percentage
     - Download speed (MB/s calculation)
     - Estimated time remaining
     - Cancel button
   - Multiple downloads stack in sheet
   - Auto-hides after completion

4. **Downloads Store Enhancements**
   - Badge count for completed downloads
   - Storage usage tracking
   - Duplicate detection
   - Active downloads tracking with progress

5. **Storage Management**
   - Files saved to documentDirectory organized by category
   - Categories: Documents, Images, Media, Archives, Other
   - expo-file-system for all file operations
   - WRITE_EXTERNAL_STORAGE permission configured

### Key Files
- `/app/frontend/src/services/MediaDownloadService.ts` - Media detection scripts
- `/app/frontend/src/services/FileDownloadManager.ts` - Core download manager
- `/app/frontend/src/components/DownloadProgressSheet.tsx` - Progress UI
- `/app/frontend/src/components/MediaDownloadOverlay.tsx` - Video download button
- `/app/frontend/src/store/useDownloadsStore.ts` - Download state management

## Smart Tab Management System (Feb 2026) ✅

### Features Implemented

**1. Tab Groups**
- Color-coded groups with custom names
- Predefined suggestions: Work, Shopping, Social, Research, Entertainment, News
- Long-press to add tab to group
- Expand/collapse groups in tab switcher
- Group persistence via useSmartTabStore

**2. Tab Undo**
- 5-second snackbar on tab close with "Undo" button
- Progress bar countdown animation
- Last 5 closed tabs kept in memory
- TabUndoSnackbar component with haptic feedback

**3. Smart Tab Suggestions**
- Banner appears when 10+ tabs open
- Identifies stale tabs (not visited in 3+ days)
- TabCleanupSuggestions component with modal
- Bulk close with checkboxes

**4. Tab Sleep/Hibernation**
- Automatic hibernation after 30min inactive
- Sleep icon on hibernated tabs
- Memory savings tracking
- Wake on tap (reload from cache)

**5. Pinned Tabs**
- Long-press to pin/unpin
- Pinned tabs appear at top
- Cannot be accidentally closed
- Persist across sessions

**6. Tab Statistics**
- Total open tabs count
- Hibernated tabs count
- Memory saved display
- Grouped tabs count

**7. Quick Actions**
- Close All (with confirmation)
- Close Duplicates (auto-detect same URLs)
- New Tab / New Incognito Tab

**8. Search & Sort**
- Search tabs by title or URL
- Sort by: Recent, Alphabetical, By Group

### Key Files
- `/app/frontend/src/store/useSmartTabStore.ts` - Smart tab state management
- `/app/frontend/src/components/TabUndoSnackbar.tsx` - Undo close snackbar
- `/app/frontend/src/components/TabCleanupSuggestions.tsx` - Cleanup UI
- `/app/frontend/app/tabs-manager.tsx` - Tab switcher screen

## Download Notifications & Resumable Downloads (Feb 2026) ✅

### Notification Bar Download Progress
1. **expo-notifications Integration**
   - Android notification channel "downloads" configured
   - iOS background audio mode for download notifications
   - POST_NOTIFICATIONS permission added

2. **Notification Features**
   - Persistent notification during active downloads
   - Real-time progress bar with percentage
   - Download speed display (MB/s)
   - Complete notification with tap-to-open action
   - Failed notification with tap-to-retry action
   - Paused notification with resume hint
   - "Connection restored - resuming X downloads" notification

3. **Permission Handling**
   - Request permission on first download
   - Store permission state in AsyncStorage
   - Fallback to in-app UI if denied

### Resumable Downloads (HTTP Range Support)
1. **Resume Interrupted Downloads**
   - Check for partial files (.partial extension)
   - Send `Range: bytes=CURRENT_SIZE-` header
   - Append new data to existing partial file
   - Survives app crashes/restarts

2. **Download State Persistence**
   - AsyncStorage-based persistence every 5 seconds
   - Tracks: url, filename, filepath, total_bytes, downloaded_bytes, status, timestamp
   - Status values: pending, downloading, paused, completed, failed
   - Auto-check for interrupted downloads on app startup

3. **Network Reconnection**
   - NetInfo monitors WiFi/mobile connection
   - Auto-resume paused downloads when network restored
   - Auto-pause downloads when connection lost

4. **Pause/Resume Controls**
   - `pauseResumableDownload(id)` - Pause active download
   - `resumeResumableDownload(id)` - Resume paused download
   - `cancelResumableDownload(id)` - Cancel and delete partial
   - `retryDownload(id)` - Retry failed download from scratch

5. **File Integrity**
   - Verify downloaded_bytes matches total_bytes
   - Move .partial to final path on success
   - Auto-delete corrupted partial files

### Key Files
- `/app/frontend/src/services/DownloadNotificationService.ts` - Notification management
- `/app/frontend/src/services/ResumableDownloadService.ts` - HTTP Range & persistence
- `/app/frontend/src/services/FileDownloadManager.ts` - Enhanced with resume support

### Kids Mode (Mar 2026)
A comprehensive child-safe browsing mode for parents.

**Features Implemented:**
1. **Kids Mode Activation** - Menu item triggers setup wizard or direct activation
2. **4-Step Setup Wizard** - PIN creation, PIN confirmation, child name/age group, time limit selection
3. **Secure PIN Storage** - expo-secure-store for encrypted PIN, AsyncStorage for config persistence
4. **Full UI Transformation** - Colorful gradient background (purple/blue/green), animated floating bubbles, friendly shield mascot, large rounded tiles for safe sites, "Hi [Name]! Stay Safe Online" greeting
5. **Content Filtering** - Comprehensive adult content domain blocklist, age-based filtering (Little Kids: whitelist-only, Kids/Teens: blocklist+safe), custom parent-managed allow/block lists
6. **SafeSearch Enforcement** - Google (&safe=strict), DuckDuckGo (&kp=1), Bing (&adlt=strict), Yahoo (&vm=r)
7. **Time Limits** - 30min/1hr/2hrs/unlimited daily limits, live timer display, "Time's Up" screen with offline activity suggestions
8. **PIN-Protected Exit** - 4-digit PIN verification, 3-attempt lockout (5 min), friendly "Ask a grown-up" message
9. **Parent Dashboard** - Activity report (sites visited, time spent, blocked attempts), site management (add/remove allowed/blocked), settings (age group, time limit, child name), time extension (+30 min)
10. **Settings Integration** - Kids Mode status card with ON/OFF badge, age group and time limit display

**Architecture:**
- **Store**: `useKidsModeStore.ts` (Zustand) - State management for PIN, config, sessions, activity logs
- **Service**: `KidsContentFilter.ts` - URL filtering, SafeSearch enforcement, safe sites catalog
- **Components**: KidsModeSetupModal, KidsModeBrowser, KidsModeExitModal, KidsModeParentDashboard, KidsModeTimeUp
- **Integration**: index.tsx (overlay + content filtering in WebView), BrowserMenu (menu item), settings.tsx (status card), useWebViewEngine (URL blocking + activity logging)

**Key Files:**
- `/app/frontend/src/store/useKidsModeStore.ts` - Zustand store
- `/app/frontend/src/services/KidsContentFilter.ts` - Content filtering service
- `/app/frontend/src/components/KidsModeSetupModal.tsx` - 4-step setup wizard
- `/app/frontend/src/components/KidsModeBrowser.tsx` - Full-screen kids UI overlay
- `/app/frontend/src/components/KidsModeExitModal.tsx` - PIN exit modal
- `/app/frontend/src/components/KidsModeParentDashboard.tsx` - Parent controls (3 tabs)
- `/app/frontend/src/components/KidsModeTimeUp.tsx` - Time limit reached screen

### Home Screen Redesign (Mar 2026)
Complete premium redesign of NewTabPage to look more premium than Chrome, Brave, and Firefox.

**Design Elements:**
1. Living Aurora Background – animated teal/blue glow orbs + 8 floating particles
2. Hero Shield – 64px icon with multi-layer glow, breathing animation, 3 radar ripples
3. AURA Title – 36px bold, letter-spacing 14px, subtle text glow
4. Status Bar Pill – frosted glass, pulsing green dot, "Aura Active | Shielding your data"
5. Quick Access – 78x92px frosted glass cards, spring press, staggered entrance
6. AURA Shield Panel – glassmorphic card, green accent line, animated number counting, "Secure" glow
7. Search Bar – 52px frosted pill, cycling placeholders (3s), teal focus glow, mic + QR icons
8. Bottom Nav – 5 icons with active teal indicator bar/dot, spring bounce press
9. Staggered entrance animations (100ms-1000ms)

**Key File:** `/app/frontend/src/components/NewTabPage.tsx`

### Ghost Mode (Mar 2026)
The most advanced private browsing mode on any mobile browser.

**Features:**
1. **Biometric Lock** - expo-local-authentication for fingerprint/face unlock, 3-attempt lockout (30s), fallback to device PIN
2. **Self-Destruct Timer** - 0/5/15/30/60 min + custom, countdown in floating toolbar, dramatic "SELF DESTRUCTING" animation + screen flash, auto-clears all cookies/cache/history/localStorage
3. **Decoy Mode** - Generates 8-14 fake history entries (CNN, Wikipedia, Weather, ESPN, recipes, YouTube) with realistic timestamps throughout the day
4. **GPS Spoofing** - 6 preset locations (NYC, London, Tokyo, Paris, Sydney, Toronto) + random + custom, injects navigator.geolocation override
5. **Enhanced Privacy Engine** - WebRTC leak blocking, canvas fingerprint noise, audio context fingerprint blocking, font fingerprint blocking, User-Agent rotation, DNT+GPC headers, third-party cookie blocking, UTM param stripping, hardware info masking
6. **Dramatic Animations** - Entry: dark ripple + skull icon + "You are now invisible", Exit: dissolve particles + "Ghost Mode destroyed", Self-destruct: red screen flash + progress bar
7. **Floating Toolbar** - Ghost icon, location spoof indicator, timer countdown, self-destruct button, auto-hides after 4s
8. **Settings** - 6 toggles: biometric lock, entry animation, decoy mode, WebRTC blocking, UA rotation; DECOY badge when active
9. **Menu Integration** - Skull icon "Ghost Mode" in browser menu
10. **Marketing** - "Chrome has Incognito. Aura has Ghost Mode." tagline in biometric lock screen

**Key Files:**
- `/app/frontend/src/store/useGhostModeStore.ts`
- `/app/frontend/src/services/GhostModePrivacyEngine.ts`
- `/app/frontend/src/services/DecoyHistoryService.ts`
- `/app/frontend/src/components/GhostMode*.tsx` (6 component files)



## Upcoming Tasks
- (P1) Wire AI Actions: Implement Explain/Summarize in AuraActionPill + Aura Vision in ImageContextMenu using GPT-4o
- (P2) Add Define Button: Dictionary lookups in AuraActionPill
- (P2) Add Translate Button: Translation in text/image menus
- (P3) Downloads Storage Insights: Visual chart of storage by category
- (P3) Cloud Sync: Backup/sync for bookmarks and download history

