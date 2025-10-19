import './globals.css'

import { Geist, Geist_Mono } from 'next/font/google'

import { AuthProvider } from '@/contexts/AuthContext'
import type { Metadata } from 'next'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Collaborative Todo',
  description: 'A collaborative todo app built with Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' className='h-full'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
