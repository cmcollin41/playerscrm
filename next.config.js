/**
 * @type {import('next').NextConfig}
 */
module.exports = {
  images: {
    remotePatterns: [
      { hostname: "public.blob.vercel-storage.com" },
      { hostname: "res.cloudinary.com" },
      { hostname: "abs.twimg.com" },
      { hostname: "pbs.twimg.com" },
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "www.google.com" },
      { hostname: "flag.vercel.app" },
      { hostname: "illustrations.popsy.co" },
      { hostname: "zkoxnmdrhgbjovfvparc.supabase.co" },
      { hostname: "framerusercontent.com" },
      { hostname: "bloximages.chicago2.vip.townnews.com" },
      { hostname: "cdn.shopify.com" },
    ],
  },
  reactStrictMode: false
}
