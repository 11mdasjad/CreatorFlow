import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app', '/admin', '/api', '/learn', '/reset-password', '/verify', '/invite'],
    },
    sitemap: `${process.env.APP_URL || 'http://127.0.0.1:3000'}/sitemap.xml`,
  };
}
