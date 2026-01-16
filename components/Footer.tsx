import Link from 'next/link';

export default function Footer() {
    return (
        <footer>
            <div className="footer-cols">
                <div className="footer-col">
                    <h4>DataVector</h4>
                    <ul>
                        <li><Link href="/">Home</Link></li>
                        <li><Link href="/about">About Us</Link></li>
                        <li><Link href="/pricing">Pricing</Link></li>
                        <li><Link href="/contact">Contact</Link></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>Tools</h4>
                    <ul>
                        <li><Link href="/tool/merge-pdf">Merge PDF</Link></li>
                        <li><Link href="/tool/split-pdf">Split PDF</Link></li>
                        <li><Link href="/tool/compress-pdf">Compress PDF</Link></li>
                        <li><Link href="/tool/convert-pdf">Convert PDF</Link></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>Legal</h4>
                    <ul>
                        <li><Link href="/privacy">Privacy Policy</Link></li>
                        <li><Link href="/terms">Terms of Service</Link></li>
                        <li><Link href="/cookies">Cookie Policy</Link></li>
                    </ul>
                </div>
                <div className="footer-col">
                    <h4>Connect</h4>
                    <ul>
                        <li><a href="#">Twitter</a></li>
                        <li><a href="#">GitHub</a></li>
                        <li><a href="#">LinkedIn</a></li>
                    </ul>
                </div>
            </div>
            <div className="copyright">
                &copy; {new Date().getFullYear()} DataVector. All rights reserved.
            </div>
        </footer>
    );
}
