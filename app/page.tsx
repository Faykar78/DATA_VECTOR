import Header from '@/components/Header';
import Hero from '@/components/Hero';
import ToolGrid from '@/components/ToolGrid';
import Footer from '@/components/Footer';
import BackgroundCanvas from '@/components/BackgroundCanvas';
import Script from 'next/script';

export const metadata = {
  title: 'DataVector - Ultimate PDF & Data Tools',
  description: 'Merge, split, convert and edit PDFs with ease. DataVector is your all-in-one document processing solution.',
};

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background Animation */}
      <BackgroundCanvas />

      {/* Navigation */}
      <Header />

      {/* Main Content */}
      <Hero />
      <ToolGrid />
      <Footer />

      {/* Load Lucide Icons for dynamic content if needed (though we use lucide-react now) */}
    </main>
  );
}
