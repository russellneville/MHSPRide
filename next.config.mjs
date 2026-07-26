/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['firebase-admin'],
  async redirects() {
    // Pages folded into the dashboard by the #70 overhaul. Old emails and
    // bookmarks still point here.
    return [
      { source: '/dashboard/bookings', destination: '/dashboard', permanent: false },
      { source: '/dashboard/bookings/:id', destination: '/dashboard', permanent: false },
      { source: '/dashboard/rides', destination: '/dashboard', permanent: false },
      { source: '/dashboard/networks', destination: '/dashboard', permanent: false },
    ];
  },
};

export default nextConfig;
