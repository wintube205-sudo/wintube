// YouTube API Proxy - hides API key from client
import { Hono } from 'hono';
import type { HonoEnv } from '../lib/types';

const videos = new Hono<HonoEnv>();

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

// ═══ GET FEED (Shorts) ═══
videos.get('/feed', async (c) => {
  const pageToken = c.req.query('pageToken') || '';
  const apiKey = c.env.YT_API_KEY;

  if (!apiKey) {
    return c.json({ error: 'YouTube API not configured' }, 500);
  }

  try {
    // Search for shorts
    const searchUrl = `${YT_BASE}/search?part=snippet&type=video&videoDuration=short&q=%23shorts&maxResults=12&order=viewCount&key=${apiKey}${pageToken ? '&pageToken=' + pageToken : ''}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as any;

    if (searchData.error) {
      console.error('YT Search Error:', searchData.error);
      return c.json({ error: 'Failed to load videos' }, 502);
    }

    const ids = (searchData.items || [])
      .map((i: any) => i?.id?.videoId)
      .filter(Boolean);

    if (!ids.length) {
      return c.json({ items: [], nextPageToken: '' });
    }

    // Get video details
    const detailsUrl = `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json() as any;

    // Sanitize response - only return what frontend needs
    const items = (detailsData.items || []).map((item: any) => ({
      id: item.id,
      title: item.snippet?.title || '',
      channel: item.snippet?.channelTitle || '',
      thumbnail: item.snippet?.thumbnails?.high?.url || '',
      duration: item.contentDetails?.duration || '',
      views: item.statistics?.viewCount || '0',
      publishedAt: item.snippet?.publishedAt || '',
    }));

    return c.json({
      items,
      nextPageToken: searchData.nextPageToken || '',
    });
  } catch (err) {
    console.error('YT Proxy Error:', err);
    return c.json({ error: 'Failed to fetch videos' }, 500);
  }
});

// ═══ SEARCH VIDEOS ═══
videos.get('/search', async (c) => {
  const q = (c.req.query('q') || '').trim();
  const pageToken = c.req.query('pageToken') || '';
  const apiKey = c.env.YT_API_KEY;

  if (!q) return c.json({ error: 'Search query required' }, 400);
  if (q.length > 100) return c.json({ error: 'Query too long' }, 400);
  if (!apiKey) return c.json({ error: 'YouTube API not configured' }, 500);

  try {
    const searchUrl = `${YT_BASE}/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=10&key=${apiKey}${pageToken ? '&pageToken=' + pageToken : ''}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as any;

    if (searchData.error) {
      return c.json({ error: 'Search failed' }, 502);
    }

    const ids = (searchData.items || [])
      .map((i: any) => i?.id?.videoId)
      .filter(Boolean);

    if (!ids.length) {
      return c.json({ items: [], nextPageToken: '' });
    }

    const detailsUrl = `${YT_BASE}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json() as any;

    const items = (detailsData.items || []).map((item: any) => ({
      id: item.id,
      title: item.snippet?.title || '',
      channel: item.snippet?.channelTitle || '',
      thumbnail: item.snippet?.thumbnails?.high?.url || '',
      duration: item.contentDetails?.duration || '',
      views: item.statistics?.viewCount || '0',
      publishedAt: item.snippet?.publishedAt || '',
    }));

    return c.json({
      items,
      nextPageToken: searchData.nextPageToken || '',
    });
  } catch (err) {
    return c.json({ error: 'Search failed' }, 500);
  }
});

export default videos;
