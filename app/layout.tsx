import type { Metadata } from 'next'
import { Instrument_Sans, Bricolage_Grotesque, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'CivicPulse',
  description: 'Report civic issues. Track resolutions. Build your city.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${instrument.variable} ${bricolage.variable} ${geistMono.variable} font-sans bg-background text-foreground antialiased`}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
