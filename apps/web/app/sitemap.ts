import type { MetadataRoute } from 'next';
import { content } from '@/lib/content';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL || 'http://127.0.0.1:3000';
  return ['', ...Object.keys(content), 'pricing', 'guides', 'book-call'].map((path) => ({
    url: `${base}/${path}`,
    changeFrequency: 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));
}
