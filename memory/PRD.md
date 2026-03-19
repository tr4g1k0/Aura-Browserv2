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

### Accessibility
- Live Captions overlay
- Text-to-Speech (Read Aloud) with control bar
- Ambient Awareness alerts
- Accessibility modal

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

### Settings
- Premium glossy glassmorphic design
- Sections: Shield & Privacy, AI & Accessibility, System
- All settings persist via AsyncStorage

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
- `/app/frontend/app/index.tsx` - Main browser (2500+ lines)
- `/app/frontend/app/settings.tsx` - Settings screen
- `/app/frontend/src/components/BrowserMenu.tsx` - 3-dot menu
- `/app/frontend/src/components/DownloadsModal.tsx` - Downloads manager (enhanced)
- `/app/frontend/src/components/DownloadNotificationBanner.tsx` - Background download banner
- `/app/frontend/src/store/useDownloadsStore.ts` - Active downloads Zustand store
- `/app/frontend/src/services/FileDownloadManager.ts` - Download service
- `/app/backend/server.py` - All API routes
