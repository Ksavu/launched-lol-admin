export const metadata = {
  title: 'Admin Dashboard - Launched.lol',
  description: 'Platform admin panel for managing graduated tokens',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}