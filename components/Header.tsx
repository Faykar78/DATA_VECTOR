'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';

export default function Header() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className={`${isScrolled ? 'header-scrolled' : ''}`}>
            <Link href="/" className="logo">
                DataVector
            </Link>

            <button
                className="mobile-menu-btn md:hidden text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
                <Menu size={24} />
            </button>

            <nav className={`nav-links ${mobileMenuOpen ? 'active' : ''}`}>
                <div className="dropdown">
                    <a href="#merge" className="dropbtn">MERGE PDF</a>
                    <div className="dropdown-content">
                        <Link href="/tool/merge-pdf">Merge PDF Files</Link>
                    </div>
                </div>
                <div className="dropdown">
                    <a href="#split" className="dropbtn">SPLIT PDF</a>
                    <div className="dropdown-content">
                        <Link href="/tool/split-pdf">Split PDF Files</Link>
                    </div>
                </div>
                <div className="dropdown">
                    <a href="#convert" className="dropbtn">CONVERT PDF</a>
                    <div className="dropdown-content grid-menu">
                        <div className="menu-col flex flex-col gap-2">
                            <span className="text-sm font-bold text-white/50 mb-2">Convert To PDF</span>
                            <Link href="/tool/jpg-to-pdf">JPG to PDF</Link>
                            <Link href="/tool/word-to-pdf">WORD to PDF</Link>
                            <Link href="/tool/powerpoint-to-pdf">POWERPOINT to PDF</Link>
                            <Link href="/tool/excel-to-pdf">EXCEL to PDF</Link>
                            <Link href="/tool/html-to-pdf">HTML to PDF</Link>
                        </div>
                    </div>
                </div>
                <div className="dropdown">
                    <a href="#search" className="dropbtn">SEARCH TOOLS</a>
                    <div className="dropdown-content">
                        <Link href="/tool/od-search">Open Directories</Link>
                        <Link href="/tool/web-search">Web Search</Link>
                    </div>
                </div>
            </nav>

            <div className="nav-actions flex gap-4">
                <Link href="#" className="btn-login text-white/70 hover:text-white px-4 py-2 transition-colors">Login</Link>
                <Link href="#" className="btn-signup bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors">Sign up</Link>
            </div>
        </header>
    );
}
