import { tools } from '@/lib/tools';
import { notFound } from 'next/navigation';
import ToolInterface from '@/components/ToolInterface';

export default async function ToolPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const tool = tools.find((t) => t.id === id);

    if (!tool) {
        notFound();
    }

    // Pass serialized tool data to Client Component
    return <ToolInterface tool={tool} />;
}
