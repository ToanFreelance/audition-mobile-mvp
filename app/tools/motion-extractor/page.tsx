import { notFound } from 'next/navigation';
import { enabled } from '@/lib/motion-extraction/server';
import MotionExtractor from './MotionExtractor';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Astra Motion Extractor — Internal', robots: { index: false, follow: false } };
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true };
export default function Page() {
  if (!enabled()) notFound();
  return <MotionExtractor />;
}
