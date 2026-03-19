/**
 * Decoy History Service
 * Generates convincing fake browsing history entries
 */

export interface DecoyEntry {
  url: string;
  title: string;
  timestamp: number;
  domain: string;
}

const DECOY_SITES = [
  { url: 'https://www.cnn.com/2024/01/15/politics/election-updates', title: 'Latest Election Updates - CNN Politics', domain: 'cnn.com' },
  { url: 'https://www.cnn.com/2024/01/15/world/climate-summit-results', title: 'Climate Summit Concludes with New Agreements - CNN', domain: 'cnn.com' },
  { url: 'https://en.wikipedia.org/wiki/Photosynthesis', title: 'Photosynthesis - Wikipedia', domain: 'en.wikipedia.org' },
  { url: 'https://en.wikipedia.org/wiki/Solar_System', title: 'Solar System - Wikipedia', domain: 'en.wikipedia.org' },
  { url: 'https://en.wikipedia.org/wiki/World_War_II', title: 'World War II - Wikipedia', domain: 'en.wikipedia.org' },
  { url: 'https://weather.com/weather/today/l/New+York+NY', title: 'New York, NY Weather Forecast | Weather.com', domain: 'weather.com' },
  { url: 'https://weather.com/weather/tenday/l/Los+Angeles+CA', title: '10-Day Weather - Los Angeles, CA', domain: 'weather.com' },
  { url: 'https://www.espn.com/nba/scoreboard', title: 'NBA Scores - ESPN', domain: 'espn.com' },
  { url: 'https://www.espn.com/nfl/story/_/id/38921', title: 'NFL Playoff Race Heats Up - ESPN', domain: 'espn.com' },
  { url: 'https://www.espn.com/soccer/scores', title: 'Soccer Scores - ESPN', domain: 'espn.com' },
  { url: 'https://www.allrecipes.com/recipe/24002/pasta-primavera/', title: 'Pasta Primavera Recipe | Allrecipes', domain: 'allrecipes.com' },
  { url: 'https://www.allrecipes.com/recipe/26317/chicken-pot-pie/', title: 'Chicken Pot Pie Recipe | Allrecipes', domain: 'allrecipes.com' },
  { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Best Study Music Playlist 2024 - YouTube', domain: 'youtube.com' },
  { url: 'https://www.youtube.com/watch?v=abc123', title: 'How to Make Perfect Pancakes - YouTube', domain: 'youtube.com' },
  { url: 'https://www.youtube.com/watch?v=xyz789', title: 'National Geographic: Ocean Life - YouTube', domain: 'youtube.com' },
  { url: 'https://www.bbc.com/news/world', title: 'World News - BBC News', domain: 'bbc.com' },
  { url: 'https://www.bbc.com/news/science-environment', title: 'Science & Environment - BBC News', domain: 'bbc.com' },
  { url: 'https://www.amazon.com/dp/B09V3KXJPB', title: 'Best Sellers in Books - Amazon.com', domain: 'amazon.com' },
  { url: 'https://stackoverflow.com/questions/tagged/javascript', title: 'javascript - Stack Overflow', domain: 'stackoverflow.com' },
  { url: 'https://www.google.com/search?q=best+restaurants+near+me', title: 'best restaurants near me - Google Search', domain: 'google.com' },
  { url: 'https://www.google.com/search?q=weather+today', title: 'weather today - Google Search', domain: 'google.com' },
  { url: 'https://www.google.com/search?q=movie+showtimes', title: 'movie showtimes - Google Search', domain: 'google.com' },
  { url: 'https://maps.google.com/maps?q=coffee+shops+near+me', title: 'coffee shops near me - Google Maps', domain: 'maps.google.com' },
  { url: 'https://www.nytimes.com/2024/01/15/technology/ai-news', title: 'AI Advances Reshape Tech Industry - NYT', domain: 'nytimes.com' },
];

class DecoyHistoryService {
  generateDailyHistory(): DecoyEntry[] {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(7, 0, 0, 0);
    const startMs = todayStart.getTime();
    const rangeMs = Math.min(now - startMs, 14 * 60 * 60 * 1000);

    // Pick 8-14 random entries
    const count = 8 + Math.floor(Math.random() * 7);
    const shuffled = [...DECOY_SITES].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count);

    // Spread timestamps throughout the day
    return picked.map((site, i) => ({
      ...site,
      timestamp: startMs + Math.floor((rangeMs / count) * i + Math.random() * (rangeMs / count * 0.6)),
    })).sort((a, b) => b.timestamp - a.timestamp);
  }
}

export const decoyHistoryService = new DecoyHistoryService();
export default decoyHistoryService;
