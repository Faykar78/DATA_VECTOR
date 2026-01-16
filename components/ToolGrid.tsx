import Link from 'next/link';
import { tools } from '@/lib/tools';

export default function ToolGrid() {
    return (
        <section id="toolGrid" className="tool-grid">
            {tools.map((tool) => (
                <Link
                    key={tool.id}
                    href={`/tool/${tool.id}`}
                    className="tool-card group"
                >
                    {/* Icon */}
                    <img
                        src={tool.icon}
                        alt={`${tool.title} Icon`}
                        className="icon"
                        width={48}
                        height={48}
                    />

                    {/* Content */}
                    <h3>{tool.title}</h3>
                    <p>{tool.desc}</p>

                    {/* Hover Glow Effect (Handled by CSS ::before) */}
                </Link>
            ))}
        </section>
    );
}
