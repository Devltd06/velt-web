import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://velt.app' // Update this to your actual domain

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/app/',
          '/pay/',
          '/renew-subscription/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
