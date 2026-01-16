'use client';

import { useEffect, useRef } from 'react';

export default function BackgroundCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width: number, height: number;
        let waves: Wave[] = [];
        let animationFrameId: number;

        // Configuration
        const config = {
            waveCount: 5,
            colors: [
                'rgba(0, 71, 255, 0.3)',   // Primary Blue
                'rgba(0, 200, 255, 0.2)',  // Cyan
                'rgba(100, 50, 255, 0.15)' // Purple
            ],
            speed: 0.005,
            amplitude: 80,
            frequency: 0.002
        };

        class Wave {
            y: number;
            color: string;
            speed: number;
            amplitude: number;
            frequency: number;
            offset: number;
            phase: number;

            constructor(y: number, color: string, speed: number, amp: number, freq: number) {
                this.y = y;
                this.color = color;
                this.speed = speed;
                this.amplitude = amp;
                this.frequency = freq;
                this.offset = Math.random() * 100;
                this.phase = Math.random() * Math.PI * 2;
            }

            draw(time: number) {
                if (!ctx) return;
                ctx.beginPath();
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2;

                // Optimization: Increase step size (15-20px is sufficient for smooth waves)
                for (let x = 0; x < width; x += 20) {
                    // Complex sine wave for "weaving" look
                    const y1 = Math.sin(x * this.frequency + time * this.speed + this.offset);
                    const y2 = Math.cos(x * this.frequency * 0.5 + time * this.speed * 0.8);

                    const y = this.y + (y1 * this.amplitude) + (y2 * this.amplitude * 0.5);

                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.bezierCurveTo(x - 10, y, x - 10, y, x, y); // Smooth curve
                }

                // Ensure the last point reaches the edge
                ctx.lineTo(width, this.y);
                ctx.stroke();
            }
        }

        const createWaves = () => {
            waves = [];
            const step = height / config.waveCount;

            // Create distinct waves centered vertically
            for (let i = 0; i < config.waveCount; i++) {
                const color = config.colors[i % config.colors.length];
                const amp = config.amplitude + Math.random() * 50;
                const freq = config.frequency + (Math.random() - 0.5) * 0.001;
                const speed = config.speed + (Math.random() - 0.5) * 0.002;

                waves.push(new Wave(
                    height / 2, // Center all waves for the "knot" effect
                    color,
                    speed,
                    amp,
                    freq
                ));
            }
        };

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            createWaves();
        };

        const animate = (time: number) => {
            ctx.clearRect(0, 0, width, height);
            waves.forEach(wave => wave.draw(time));
            animationFrameId = requestAnimationFrame(animate);
        };

        // Init
        resize();
        window.addEventListener('resize', resize);
        animationFrameId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            id="bgCanvas"
            className="fixed top-0 left-0 w-full h-full -z-20 pointer-events-none"
        />
    );
}
