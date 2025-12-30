/**
 * Nixtio-style "Weaving" Line Animation
 * Renders multiple flowing sine waves to create a mesh/weave effect.
 */

const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let waves = [];

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
    constructor(y, color, speed, amp, freq) {
        this.y = y;
        this.color = color;
        this.speed = speed;
        this.amplitude = amp;
        this.frequency = freq;
        this.offset = Math.random() * 100;
        this.phase = Math.random() * Math.PI * 2;
    }

    draw(time) {
        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;

        for (let x = 0; x < width; x += 5) {
            // Complex sine wave for "weaving" look
            const y1 = Math.sin(x * this.frequency + time * this.speed + this.offset);
            const y2 = Math.cos(x * this.frequency * 0.5 + time * this.speed * 0.8);

            const y = this.y + (y1 * this.amplitude) + (y2 * this.amplitude * 0.5);

            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.stroke();
    }
}

function init() {
    resize();
    createWaves();
    window.addEventListener('resize', resize);
    requestAnimationFrame(animate);
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createWaves(); // Re-center waves
}

function createWaves() {
    waves = [];
    const step = height / config.waveCount;

    // Create distinct waves centered vertically
    for (let i = 0; i < config.waveCount; i++) {
        const color = config.colors[i % config.colors.length];
        // Randomize params slightly for organic feel
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
}

function animate(time) {
    ctx.clearRect(0, 0, width, height);

    // Optional: Fade trail for motion blur effect
    // ctx.fillStyle = 'rgba(3, 3, 3, 0.1)';
    // ctx.fillRect(0, 0, width, height);

    waves.forEach(wave => wave.draw(time));
    requestAnimationFrame(animate);
}

// Start
document.addEventListener('DOMContentLoaded', init);
