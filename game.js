// ==================== GEO WAVE - Wave Mode Game ====================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreDisplay = document.getElementById('score');
const progressFill = document.getElementById('progressFill');
const menuScreen = document.getElementById('menuScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const playBtn = document.getElementById('playBtn');
const retryBtn = document.getElementById('retryBtn');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const attemptEl = document.getElementById('attempt');
const speedEl = document.getElementById('speed');

// Game Constants
// Instant vertical movement (no acceleration)
const VERTICAL_SPEED = 6; // increased up/down speed per user request
const MAX_VELOCITY = 8;
const BASE_WIDTH = 900;
const BASE_HEIGHT = 600;
const ROTATION_LERP = 0.12; // smoothing for rotation
const BASE_ARROW_SIZE = 36; // base visual size for arrow player
let arrowSize = BASE_ARROW_SIZE;
const MIN_H_SPACING = 180; // minimum horizontal spacing between obstacle clusters
const SAFE_GAP = 140; // minimum free vertical space
const MIN_GAP_HEIGHT = 140;
const MIN_MARGIN = 80; // clearance from ceiling/ground for moving parts
const WAVE_TRAIL_LENGTH = 25;
const BASE_LEVEL_LENGTH = 15000;

// Difficulty Settings
const DIFFICULTY_CONFIG = {
    easy: { targetPercent: 100, levelMultiplier: 1, label: 'EASY', color: '#00ff00' },
    medium: { targetPercent: 250, levelMultiplier: 2.5, label: 'MEDIUM', color: '#ffff00' },
    hard: { targetPercent: 500, levelMultiplier: 5, label: 'HARD', color: '#ff8800' },
    infinite: { targetPercent: Infinity, levelMultiplier: 1, label: 'INFINITE', color: '#00ffff' },
    impossible: { targetPercent: 1000, levelMultiplier: 10, label: 'IMPOSSIBLE', color: '#ff0000' }
};
let currentDifficulty = 'easy';
let LEVEL_LENGTH = BASE_LEVEL_LENGTH;

// Game State
let gameState = 'menu';
let player;
let obstacles = [];
let particles = [];
let trailParticles = [];
let backgroundStars = [];
let distance = 0;
let bestScore = 0;
let attempt = 1;
let gameSpeed = 6;
let baseSpeed = 6;
let isHolding = false;
let lastTime = 0;
let groundY = canvas.height - 50;
let ceilingY = 50;
let prevCanvasWidth = canvas.width;
let prevCanvasHeight = canvas.height;

// Colors
const COLORS = {
    primary: '#00ffff',
    secondary: '#ff00ff',
    tertiary: '#ffff00',
    danger: '#ff4444',
    background: '#0a0a1a'
};

// ==================== Player Class ====================
class Player {
    constructor() {
        this.x = 150;
        this.y = canvas.height / 2;
        this.width = 35;
        this.height = 35;
        this.velocity = 0;
        this.rotation = 0;
        this.trail = [];
        this.glowIntensity = 0;
        this.pulsePhase = 0;
        this.renderY = this.y; // smoothed rendering position
    }

    update() {

        // Instant vertical movement: set velocity directly (no acceleration)
        if (isHolding) {
            this.velocity = -VERTICAL_SPEED;
            this.glowIntensity = Math.min(this.glowIntensity + 0.08, 1);
        } else {
            this.velocity = VERTICAL_SPEED;
            this.glowIntensity = Math.max(this.glowIntensity - 0.05, 0.3);
        }

        // Update position immediately (physics target)
        this.y += this.velocity;

        // Smooth rendering position for smoother visuals
        this.renderY += (this.y - this.renderY) * 0.25;

        // Smooth rotation towards target based on velocity
        const targetRotation = this.velocity * 0.2; // inverted so up tilt shows correctly
        this.rotation += (targetRotation - this.rotation) * ROTATION_LERP;

        // Boundary collision
        if (this.y <= ceilingY + this.height / 2) {
            this.y = ceilingY + this.height / 2;
            this.velocity = VERTICAL_SPEED;
            createImpactParticles(this.x, this.y, '#00ffff');
        }
        if (this.y >= groundY - this.height / 2) {
            this.y = groundY - this.height / 2;
            this.velocity = -VERTICAL_SPEED;
            createImpactParticles(this.x, this.y, '#ff00ff');
        }

        // Update trail (use renderY for smooth visuals)
        this.trail.unshift({ x: this.x - arrowSize * 0.3, y: this.renderY, alpha: 1 });
        if (this.trail.length > WAVE_TRAIL_LENGTH) {
            this.trail.pop();
        }

        // Update trail alpha
        this.trail.forEach((point, i) => {
            point.alpha = 1 - (i / WAVE_TRAIL_LENGTH);
        });

        // Pulse animation
        this.pulsePhase += 0.15;
    }

    draw() {
        // Draw trail
        this.drawTrail();

        // Draw glow (use smoothed renderY)
        const glowSize = 60 + Math.sin(this.pulsePhase) * 10;
        const gradient = ctx.createRadialGradient(
            this.x, this.renderY, 0,
            this.x, this.renderY, glowSize
        );
        gradient.addColorStop(0, `rgba(0, 255, 255, ${0.4 * this.glowIntensity})`);
        gradient.addColorStop(0.5, `rgba(255, 0, 255, ${0.2 * this.glowIntensity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x - glowSize, this.renderY - glowSize, glowSize * 2, glowSize * 2);

        // Draw wave shape
        ctx.save();
        ctx.translate(this.x, this.renderY);
        ctx.rotate(this.rotation);

        // Main body - draw polished arrow shape
        this.drawArrowShape();

        ctx.restore();
    }

    drawArrowShape() {
        const s = arrowSize;

        // Outer glow
        ctx.shadowColor = isHolding ? '#00ffff' : '#ff00ff';
        ctx.shadowBlur = 20;

        // Simple clean triangle arrow pointing right
        ctx.beginPath();
        ctx.moveTo(s * 0.5, 0);          // tip (right)
        ctx.lineTo(-s * 0.35, -s * 0.4); // top-left
        ctx.lineTo(-s * 0.15, 0);        // notch center
        ctx.lineTo(-s * 0.35, s * 0.4);  // bottom-left
        ctx.closePath();

        // Gradient fill
        const grad = ctx.createLinearGradient(-s * 0.4, 0, s * 0.5, 0);
        grad.addColorStop(0, '#ff00ff');
        grad.addColorStop(0.5, '#00ffff');
        grad.addColorStop(1, '#ffff00');
        ctx.fillStyle = grad;
        ctx.fill();

        // White edge highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;
    }

    drawTrail() {
        if (this.trail.length < 2) return;

        // Outer glow trail
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x - i * 1.5, this.trail[i].y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main colored trail
        ctx.beginPath();
        ctx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x - i * 1.5, this.trail[i].y);
        }
        const trailGrad = ctx.createLinearGradient(
            this.trail[0].x, this.renderY,
            this.trail[this.trail.length - 1].x, this.trail[this.trail.length - 1].y
        );
        trailGrad.addColorStop(0, 'rgba(0, 255, 255, 0.9)');
        trailGrad.addColorStop(0.5, 'rgba(255, 0, 255, 0.5)');
        trailGrad.addColorStop(1, 'rgba(255, 255, 0, 0)');
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    getBounds() {
        return {
            x: this.x - this.width / 3,
            y: this.y - this.height / 3,
            width: this.width / 1.5,
            height: this.height / 1.5
        };
    }
}

// ==================== Obstacle Classes ====================
class Obstacle {
    constructor(x, type, config = {}) {
        this.x = x;
        this.type = type;
        this.passed = false;
        this.config = config;
        this.pulsePhase = Math.random() * Math.PI * 2;
    }

    update(dt) {
        // dt is milliseconds since last frame; normalize to ~16.67ms (60fps)
        const factor = dt ? dt / 16.67 : 1;
        this.x -= gameSpeed * factor;
        this.pulsePhase += 0.1 * factor;
    }

    draw() {
        // Override in subclasses
    }

    checkCollision(playerBounds) {
        // Override in subclasses
        return false;
    }

    isOffScreen() {
        return this.x < -200;
    }
}

class SpikeObstacle extends Obstacle {
    constructor(x, y, height, fromTop = false) {
        super(x, 'spike', { y, height, fromTop });
        this.width = 40;
    }

    draw() {
        const { y, height, fromTop } = this.config;
        const pulse = Math.sin(this.pulsePhase) * 3;

        ctx.save();
        
        // Glow effect
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 15 + pulse;

        // Draw spike
        ctx.beginPath();
        if (fromTop) {
            ctx.moveTo(this.x, ceilingY);
            ctx.lineTo(this.x + this.width / 2, ceilingY + height + pulse);
            ctx.lineTo(this.x + this.width, ceilingY);
        } else {
            ctx.moveTo(this.x, groundY);
            ctx.lineTo(this.x + this.width / 2, groundY - height - pulse);
            ctx.lineTo(this.x + this.width, groundY);
        }
        ctx.closePath();

        // Gradient fill
        const gradient = ctx.createLinearGradient(
            this.x, fromTop ? ceilingY : groundY,
            this.x, fromTop ? ceilingY + height : groundY - height
        );
        gradient.addColorStop(0, '#ff0066');
        gradient.addColorStop(1, '#ff4444');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    checkCollision(playerBounds) {
        const { height, fromTop } = this.config;
        const spikeY = fromTop ? ceilingY : groundY - height;
        const spikeHeight = height;

        // Triangle collision approximation
        const spikeBounds = {
            x: this.x + 5,
            y: spikeY,
            width: this.width - 10,
            height: spikeHeight
        };

        return rectIntersect(playerBounds, spikeBounds);
    }
}

class SawObstacle extends Obstacle {
    constructor(x, y) {
        super(x, 'saw', { y });
        this.radius = 35;
        this.rotation = 0;
    }

    update(dt) {
        super.update(dt);
        this.rotation += 0.15 * (dt ? dt / 16.67 : 1);
    }

    draw() {
        const { y } = this.config;
        
        ctx.save();
        ctx.translate(this.x, y);
        ctx.rotate(this.rotation);

        // Glow
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 20;

        // Outer circle
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#ffaa00');
        gradient.addColorStop(1, '#ff4400');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw saw teeth
        const teeth = 8;
        for (let i = 0; i < teeth; i++) {
            const angle = (i / teeth) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(
                Math.cos(angle) * this.radius,
                Math.sin(angle) * this.radius
            );
            ctx.lineTo(
                Math.cos(angle + 0.2) * (this.radius + 15),
                Math.sin(angle + 0.2) * (this.radius + 15)
            );
            ctx.lineTo(
                Math.cos(angle + 0.4) * this.radius,
                Math.sin(angle + 0.4) * this.radius
            );
            ctx.closePath();
            ctx.fillStyle = '#ff4400';
            ctx.fill();
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Center circle
        ctx.beginPath();
        ctx.arc(0, 0, this.radius / 3, 0, Math.PI * 2);
        ctx.fillStyle = '#331100';
        ctx.fill();
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    checkCollision(playerBounds) {
        const { y } = this.config;
        const dx = playerBounds.x + playerBounds.width / 2 - this.x;
        const dy = playerBounds.y + playerBounds.height / 2 - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.radius + Math.min(playerBounds.width, playerBounds.height) / 2 - 5;
    }
}

class WallObstacle extends Obstacle {
    constructor(x, gapY, gapHeight) {
        super(x, 'wall', { gapY, gapHeight });
        this.width = 30;
    }

    draw() {
        const { gapY, gapHeight } = this.config;
        
        ctx.save();
        ctx.shadowColor = '#9900ff';
        ctx.shadowBlur = 15;

        // Top wall
        const topGradient = ctx.createLinearGradient(this.x, ceilingY, this.x + this.width, ceilingY);
        topGradient.addColorStop(0, '#6600cc');
        topGradient.addColorStop(1, '#9900ff');
        ctx.fillStyle = topGradient;
        ctx.fillRect(this.x, ceilingY, this.width, gapY - ceilingY);

        // Bottom wall
        ctx.fillRect(this.x, gapY + gapHeight, this.width, groundY - gapY - gapHeight);

        // Borders
        ctx.strokeStyle = '#cc66ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, ceilingY, this.width, gapY - ceilingY);
        ctx.strokeRect(this.x, gapY + gapHeight, this.width, groundY - gapY - gapHeight);

        // Gap indicator
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(this.x - 10, gapY);
        ctx.lineTo(this.x + this.width + 10, gapY);
        ctx.moveTo(this.x - 10, gapY + gapHeight);
        ctx.lineTo(this.x + this.width + 10, gapY + gapHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
    }

    checkCollision(playerBounds) {
        const { gapY, gapHeight } = this.config;
        
        // Check if player x overlaps with wall
        if (playerBounds.x + playerBounds.width > this.x && playerBounds.x < this.x + this.width) {
            // Check if player is outside the gap
            if (playerBounds.y < gapY || playerBounds.y + playerBounds.height > gapY + gapHeight) {
                return true;
            }
        }
        return false;
    }
}

class MovingSawObstacle extends Obstacle {
    constructor(x, startY, endY, speed) {
        super(x, 'movingSaw', { startY, endY, speed, currentY: startY, direction: 1 });
        this.radius = 30;
        this.rotation = 0;
    }

    update(dt) {
        super.update(dt);
        this.rotation += 0.2 * (dt ? dt / 16.67 : 1);

        // Move up and down (frame-rate independent)
        const factor = dt ? dt / 16.67 : 1;
        this.config.currentY += this.config.speed * this.config.direction * factor;
        if (this.config.currentY >= this.config.endY || this.config.currentY <= this.config.startY) {
            this.config.direction *= -1;
        }
    }

    draw() {
        const y = this.config.currentY;
        
        ctx.save();
        ctx.translate(this.x, y);
        ctx.rotate(this.rotation);

        // Glow
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 20;

        // Main circle
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#66ff66');
        gradient.addColorStop(1, '#00aa00');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Teeth
        const teeth = 6;
        for (let i = 0; i < teeth; i++) {
            const angle = (i / teeth) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(
                Math.cos(angle) * this.radius,
                Math.sin(angle) * this.radius
            );
            ctx.lineTo(
                Math.cos(angle + 0.25) * (this.radius + 12),
                Math.sin(angle + 0.25) * (this.radius + 12)
            );
            ctx.lineTo(
                Math.cos(angle + 0.5) * this.radius,
                Math.sin(angle + 0.5) * this.radius
            );
            ctx.closePath();
            ctx.fillStyle = '#00aa00';
            ctx.fill();
        }

        // Center
        ctx.beginPath();
        ctx.arc(0, 0, this.radius / 3, 0, Math.PI * 2);
        ctx.fillStyle = '#003300';
        ctx.fill();

        ctx.restore();

        // Draw movement line indicator
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.setLineDash([5, 10]);
        ctx.beginPath();
        ctx.moveTo(this.x, this.config.startY);
        ctx.lineTo(this.x, this.config.endY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    checkCollision(playerBounds) {
        const y = this.config.currentY;
        const dx = playerBounds.x + playerBounds.width / 2 - this.x;
        const dy = playerBounds.y + playerBounds.height / 2 - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.radius + Math.min(playerBounds.width, playerBounds.height) / 2 - 5;
    }
}

// ==================== Particle System ====================
class Particle {
    constructor(x, y, color, velocity, life = 1) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.velocity = velocity;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 5 + 2;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.velocity.x *= 0.98;
        this.velocity.y *= 0.98;
        this.life -= 0.02;
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

function createImpactParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        particles.push(new Particle(x, y, color, {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        }, 0.5));
    }
}

function createDeathParticles(x, y) {
    const colors = ['#ff0000', '#ff6600', '#ffff00', '#ffffff'];
    for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new Particle(x, y, color, {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        }, 1.5));
    }
}

// ==================== Background ====================
function initBackgroundStars() {
    backgroundStars = [];
    for (let i = 0; i < 100; i++) {
        backgroundStars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 2 + 0.5,
            brightness: Math.random()
        });
    }
}

function drawBackground() {
    // Base gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#0a0a2a');
    bgGradient.addColorStop(0.5, '#1a0a3a');
    bgGradient.addColorStop(1, '#0a1a2a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Animated stars
    backgroundStars.forEach(star => {
        star.x -= star.speed * (gameSpeed / 6);
        if (star.x < 0) {
            star.x = canvas.width;
            star.y = Math.random() * canvas.height;
        }

        const twinkle = 0.5 + Math.sin(Date.now() * 0.003 + star.brightness * 10) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * twinkle})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridOffset = (distance * gameSpeed) % 50;
    
    for (let x = -gridOffset; x < canvas.width + 50; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, ceilingY);
        ctx.lineTo(x, groundY);
        ctx.stroke();
    }

    for (let y = ceilingY; y <= groundY; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawBoundaries() {
    // Top boundary
    const topGradient = ctx.createLinearGradient(0, 0, 0, ceilingY);
    topGradient.addColorStop(0, '#1a0a3a');
    topGradient.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, canvas.width, ceilingY);

    // Bottom boundary
    const bottomGradient = ctx.createLinearGradient(0, groundY, 0, canvas.height);
    bottomGradient.addColorStop(0, '#0a0a1a');
    bottomGradient.addColorStop(1, '#1a0a3a');
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

    // Boundary lines with glow
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    
    // Top line
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, ceilingY);
    ctx.lineTo(canvas.width, ceilingY);
    ctx.stroke();

    // Bottom line
    ctx.strokeStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();

    ctx.shadowBlur = 0;
}

// ==================== Level Generation ====================
function generateObstacles() {
    obstacles = [];
    let x = 700;
    let lastX = x - MIN_H_SPACING;
    
    while (x < LEVEL_LENGTH) {
        const obstacleType = Math.random();
        const playableHeight = groundY - ceilingY;
        
        if (obstacleType < 0.25) {
            // Spike from bottom
            const maxHeight = playableHeight - SAFE_GAP;
            const height = Math.min(maxHeight * 0.5, Math.random() * 70 + 50);
            obstacles.push(new SpikeObstacle(x, groundY, height, false));
            
            // Sometimes add matching top spike (ensure gap remains)
            if (Math.random() > 0.5) {
                const topMaxHeight = playableHeight - height - SAFE_GAP;
                if (topMaxHeight > 30) {
                    const topHeight = Math.min(topMaxHeight, Math.random() * 50 + 30);
                    obstacles.push(new SpikeObstacle(x, ceilingY, topHeight, true));
                }
            }
            x += Math.random() * 180 + 120;
            if (x < lastX + MIN_H_SPACING) x = lastX + MIN_H_SPACING;
            lastX = x;
            
        } else if (obstacleType < 0.45) {
            // Spike from top
            const maxHeight = playableHeight - SAFE_GAP;
            const height = Math.min(maxHeight * 0.5, Math.random() * 70 + 50);
            obstacles.push(new SpikeObstacle(x, ceilingY, height, true));
            x += Math.random() * 180 + 120;
            if (x < lastX + MIN_H_SPACING) x = lastX + MIN_H_SPACING;
            lastX = x;
            
        } else if (obstacleType < 0.6) {
            // Static saw - ensure it's within safe margins
            const sawMargin = 60;
            const y = ceilingY + sawMargin + Math.random() * (playableHeight - sawMargin * 2);
            obstacles.push(new SawObstacle(x, y));
            x += Math.random() * 220 + 180;
            if (x < lastX + MIN_H_SPACING) x = lastX + MIN_H_SPACING;
            lastX = x;
            
        } else if (obstacleType < 0.75) {
            // Wall with gap - generous gap for fairness
            const gapHeight = Math.max(MIN_GAP_HEIGHT + 20, Math.random() * 60 + MIN_GAP_HEIGHT);
            const gapMinY = ceilingY + 60;
            const gapMaxY = groundY - 60 - gapHeight;
            if (gapMaxY > gapMinY) {
                const gapY = gapMinY + Math.random() * (gapMaxY - gapMinY);
                obstacles.push(new WallObstacle(x, gapY, gapHeight));
            }
            x += Math.random() * 250 + 180;
            if (x < lastX + MIN_H_SPACING) x = lastX + MIN_H_SPACING;
            lastX = x;
            
        } else if (obstacleType < 0.9) {
            // Moving saw
            const startY = ceilingY + MIN_MARGIN;
            const endY = groundY - MIN_MARGIN;
            const speed = Math.random() * 2 + 1.5;
            obstacles.push(new MovingSawObstacle(x, startY, endY, speed));
            x += Math.random() * 250 + 180;
            if (x < lastX + MIN_H_SPACING) x = lastX + MIN_H_SPACING;
            lastX = x;
            
        } else {
            // Spike corridor - fewer spikes, strict gap enforcement
            for (let i = 0; i < 2; i++) {
                const maxTotal = playableHeight - SAFE_GAP - 40;
                const bottomHeight = Math.min(maxTotal * 0.4, Math.random() * 50 + 40);
                const topHeight = Math.min(maxTotal - bottomHeight, Math.random() * 50 + 40);
                obstacles.push(new SpikeObstacle(x + i * 100, groundY, bottomHeight, false));
                obstacles.push(new SpikeObstacle(x + i * 100, ceilingY, topHeight, true));
            }
            x += 320;
            if (x < lastX + MIN_H_SPACING) x = lastX + MIN_H_SPACING;
            lastX = x;
        }

        // Gradually increase difficulty
        const progress = x / LEVEL_LENGTH;
        if (progress > 0.3) {
            x -= 20;
        }
        if (progress > 0.6) {
            x -= 20;
        }
    }

    // Validate and fix any impossible clusters created by generation
    validateAndFixObstacles();
}

// Validate obstacles after generation or spawn and fix impossible clusters
function validateAndFixObstacles() {
    const playableHeight = groundY - ceilingY;

    // Group obstacles by nearby x to reason about clusters
    const groups = {};
    obstacles.forEach((obs, idx) => {
        const key = Math.round(obs.x / 20) * 20;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ obs, idx });
    });

    // For every cluster, ensure there is at least SAFE_GAP free space
    Object.keys(groups).forEach(key => {
        const group = groups[key].map(g => g.obs);

        let blockedTop = 0, blockedBottom = 0;
        group.forEach(o => {
            if (o.type === 'spike') {
                const h = o.config.height || 0;
                if (o.config.fromTop) blockedTop += h;
                else blockedBottom += h;
            } else if (o.type === 'wall') {
                const gapY = o.config.gapY || ceilingY;
                const gapH = o.config.gapHeight || MIN_GAP_HEIGHT;
                blockedTop += Math.max(0, gapY - ceilingY);
                blockedBottom += Math.max(0, groundY - (gapY + gapH));
            }
        });

        const totalBlocked = blockedTop + blockedBottom;
        const allowedBlocked = Math.max(0, playableHeight - SAFE_GAP);

        if (totalBlocked > allowedBlocked) {
            // Try removing spike obstacles first (prefer largest)
            const spikes = group.filter(o => o.type === 'spike');
            if (spikes.length > 0) {
                spikes.sort((a, b) => (b.config.height || 0) - (a.config.height || 0));
                const toRemove = spikes[0];
                const i = obstacles.indexOf(toRemove);
                if (i >= 0) obstacles.splice(i, 1);
                return;
            }

            // Next try removing a wall (if present)
            const walls = group.filter(o => o.type === 'wall');
            if (walls.length > 0) {
                const toRemove = walls[0];
                const i = obstacles.indexOf(toRemove);
                if (i >= 0) obstacles.splice(i, 1);
                return;
            }

            // As last resort, shrink spike heights proportionally
            group.forEach(o => {
                if (o.type === 'spike') {
                    o.config.height = Math.max(20, (o.config.height || 0) - 30);
                }
            });
        }
    });

    // Ensure minimum horizontal spacing between obstacles
    obstacles.sort((a, b) => a.x - b.x);
    for (let i = 1; i < obstacles.length; i++) {
        const prev = obstacles[i - 1];
        const cur = obstacles[i];
        if (cur.x < prev.x + MIN_H_SPACING) {
            cur.x = prev.x + MIN_H_SPACING;
        }
    }

    // Prevent saws overlapping walls horizontally — move saws out of wall bounds
    obstacles.forEach(o => {
        if (o.type === 'saw' || o.type === 'movingSaw') {
            obstacles.forEach(w => {
                if (w.type === 'wall') {
                    const wx1 = w.x;
                    const wx2 = w.x + (w.width || 30);
                    if (o.x > wx1 - 10 && o.x < wx2 + 10) {
                        o.x = wx2 + 60; // push saw to the right of the wall
                    }
                }
            });
        }
    });
}

// ==================== Collision Detection ====================
function rectIntersect(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// ==================== Game Loop ====================
function update(deltaTime) {
    if (gameState !== 'playing') return;

    // Update distance
    distance += gameSpeed;

    // Gradually increase speed (stronger scaling as progress increases)
    const config = DIFFICULTY_CONFIG[currentDifficulty];
    const progress = config.targetPercent === Infinity 
        ? Math.min(1, distance / (BASE_LEVEL_LENGTH * 5)) // Infinite mode caps speed scaling
        : Math.min(1, distance / LEVEL_LENGTH);
    const speedMultiplier = currentDifficulty === 'infinite' ? 8 : (currentDifficulty === 'impossible' ? 10 : 6);
    gameSpeed = baseSpeed + Math.pow(progress, 0.9) * speedMultiplier;
    speedEl.textContent = (gameSpeed / baseSpeed).toFixed(2) + 'x';

    // Update player
    player.update();

    // Update obstacles
    const playerBounds = player.getBounds();
    obstacles.forEach(obstacle => {
        obstacle.update(deltaTime);
        
        // Check collision
        if (obstacle.checkCollision(playerBounds)) {
            gameOver();
            return;
        }
    });

    // Remove off-screen obstacles
    obstacles = obstacles.filter(obs => !obs.isOffScreen());

    // Dynamic spawns: occasionally add extra obstacles as difficulty increases
    const spawnChance = Math.min(0.08, progress * 0.1);
    let spawnedThisFrame = false;
    if (Math.random() < spawnChance) {
        const spawnX = canvas.width + 120 + Math.random() * 200;
        const t = Math.random();
        if (t < 0.4) {
            const y = ceilingY + MIN_MARGIN + Math.random() * (groundY - ceilingY - MIN_MARGIN * 2);
            obstacles.push(new SawObstacle(spawnX, y));
        } else if (t < 0.75) {
            const height = Math.random() * 80 + 40;
            obstacles.push(new SpikeObstacle(spawnX, groundY, height, false));
        } else {
            const gapHeight = Math.max(MIN_GAP_HEIGHT, 160 - progress * 80);
            const gapMinY = ceilingY + MIN_MARGIN;
            const gapMaxY = groundY - MIN_MARGIN - gapHeight;
            const gapY = Math.max(gapMinY, Math.min(gapMaxY, gapMinY + Math.random() * (gapMaxY - gapMinY)));
            obstacles.push(new WallObstacle(spawnX, gapY, gapHeight));
        }
        spawnedThisFrame = true;
    }

    if (spawnedThisFrame) validateAndFixObstacles();

    // Update particles
    particles.forEach(p => p.update());
    particles = particles.filter(p => !p.isDead());

    // Create trail particles occasionally
    if (Math.random() > 0.7) {
        const color = isHolding ? '#00ffff' : '#ff00ff';
        particles.push(new Particle(
            player.x - 20,
            player.y + (Math.random() - 0.5) * 10,
            color,
            { x: -2, y: (Math.random() - 0.5) * 2 },
            0.5
        ));
    }

    // Update score based on difficulty
    const targetPercent = config.targetPercent;
    const rawPercent = (distance / BASE_LEVEL_LENGTH) * 100;
    
    if (targetPercent === Infinity) {
        // Infinite mode - just show current percent
        scoreDisplay.textContent = Math.floor(rawPercent) + '%';
        progressFill.style.width = Math.min(100, rawPercent) + '%';
    } else {
        const displayPercent = Math.min(targetPercent, Math.floor(rawPercent));
        scoreDisplay.textContent = displayPercent + '%';
        progressFill.style.width = Math.min(100, (rawPercent / targetPercent) * 100) + '%';
        
        // Check win condition
        if (rawPercent >= targetPercent) {
            gameWin();
        }
    }
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    drawBackground();
    drawBoundaries();

    // Draw obstacles
    obstacles.forEach(obstacle => obstacle.draw());

    // Draw particles
    particles.forEach(p => p.draw());

    // Draw player
    if (gameState === 'playing') {
        player.draw();
    }
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// ==================== Game State Management ====================
function startGame() {
    gameState = 'playing';
    menuScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    // Reset game state
    distance = 0;
    gameSpeed = baseSpeed;
    particles = [];
    
    // Create player
    player = new Player();
    
    // Generate level
    generateObstacles();
    initBackgroundStars();
    
    // Update UI
    scoreDisplay.textContent = '0%';
    progressFill.style.width = '0%';
    attemptEl.textContent = attempt;
}

function gameOver() {
    gameState = 'gameOver';
    
    // Create death effect
    createDeathParticles(player.x, player.y);
    
    // Calculate score based on difficulty
    const rawPercent = (distance / BASE_LEVEL_LENGTH) * 100;
    const config = DIFFICULTY_CONFIG[currentDifficulty];
    const score = config.targetPercent === Infinity ? Math.floor(rawPercent) : Math.min(config.targetPercent, Math.floor(rawPercent));
    
    if (score > bestScore) {
        bestScore = score;
    }
    
    // Show game over screen after a delay
    setTimeout(() => {
        finalScoreEl.textContent = score + '%';
        bestScoreEl.textContent = bestScore + '%';
        gameOverScreen.classList.remove('hidden');
        attempt++;
    }, 500);
}

function gameWin() {
    gameState = 'win';
    const config = DIFFICULTY_CONFIG[currentDifficulty];
    bestScore = config.targetPercent;
    
    setTimeout(() => {
        finalScoreEl.textContent = config.targetPercent + '%';
        bestScoreEl.textContent = config.targetPercent + '%';
        document.querySelector('.game-over-title').textContent = 'VICTORY!';
        document.querySelector('.game-over-title').style.color = config.color;
        gameOverScreen.classList.remove('hidden');
        attempt++;
    }, 500);
}

// ==================== Input Handling ====================
function handleInputStart(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    e.preventDefault();
    isHolding = true;
    
    if (gameState === 'menu') {
        startGame();
    }
}

function handleInputEnd(e) {
    if (e.type === 'keyup' && e.code !== 'Space') return;
    isHolding = false;
}

// Keyboard events
document.addEventListener('keydown', handleInputStart);
document.addEventListener('keyup', handleInputEnd);

// Mouse events
canvas.addEventListener('mousedown', handleInputStart);
canvas.addEventListener('mouseup', handleInputEnd);
canvas.addEventListener('mouseleave', handleInputEnd);

// Touch events (prevent page scroll while interacting)
canvas.addEventListener('touchstart', handleInputStart, { passive: false });
canvas.addEventListener('touchend', handleInputEnd);
canvas.addEventListener('touchcancel', handleInputEnd);
canvas.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

// Pointer events (unified for mouse, touch, pen — improves touchscreen reliability)
function handlePointerStart(e) {
    // Accept primary pointers only to avoid multi-touch conflicts
    e.preventDefault();
    isHolding = true;
    if (gameState === 'menu') startGame();
}

function handlePointerEnd(e) {
    e.preventDefault();
    isHolding = false;
}

canvas.addEventListener('pointerdown', handlePointerStart, { passive: false });
canvas.addEventListener('pointerup', handlePointerEnd);
canvas.addEventListener('pointercancel', handlePointerEnd);
canvas.addEventListener('pointerleave', handlePointerEnd);

// Button events
playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
});

retryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelector('.game-over-title').textContent = 'CRASH!';
    document.querySelector('.game-over-title').style.color = '#ff4444';
    startGame();
});

// Main Menu button
const menuBtn = document.getElementById('menuBtn');
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelector('.game-over-title').textContent = 'CRASH!';
    document.querySelector('.game-over-title').style.color = '#ff4444';
    gameOverScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    gameState = 'menu';
});

// ==================== Fullscreen & Resize Handling ====================
const fullscreenBtn = document.getElementById('fullscreenBtn');
const container = document.querySelector('.game-container');

function enterFullscreen() {
    if (container.requestFullscreen) container.requestFullscreen();
}

function exitFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
}

function toggleFullscreen() {
    if (!document.fullscreenElement) enterFullscreen(); else exitFullscreen();
}

if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
}

function resizeCanvasForFullscreen() {
    const wasFullscreen = !!document.fullscreenElement;
    const newWidth = document.fullscreenElement ? window.innerWidth : BASE_WIDTH;
    const newHeight = document.fullscreenElement ? window.innerHeight : BASE_HEIGHT;

    // compute relative scale from previous canvas size
    const relX = newWidth / prevCanvasWidth;
    const relY = newHeight / prevCanvasHeight;

    canvas.width = newWidth;
    canvas.height = newHeight;

    // update boundaries
    groundY = canvas.height - 50;
    ceilingY = 50;

    // When toggling fullscreen we regenerate obstacles instead of scaling existing ones
    // to avoid visual artifacts and impossible layouts.
    const scale = newWidth / BASE_WIDTH;
    arrowSize = Math.max(12, Math.round(BASE_ARROW_SIZE * scale));

    // Reposition player safely (keep relative vertical position)
    if (player) {
        const relYPos = (player.y - ceilingY) / (prevCanvasHeight - ceilingY - (prevCanvasHeight - groundY));
        player.x = Math.max(120, Math.round(newWidth * 0.15));
        player.y = Math.min(Math.max(ceilingY + 60, player.y), groundY - 60);
        player.renderY = player.y;
    }

    // regenerate obstacles for the new canvas size to ensure fairness
    generateObstacles();

    // adjust UI title/subtitle sizes to match scale
    const titleEl = document.querySelector('.game-title');
    const subtitleEl = document.querySelector('.subtitle');
    if (titleEl) titleEl.style.fontSize = `${Math.max(28, 64 * scale)}px`;
    if (subtitleEl) subtitleEl.style.fontSize = `${Math.max(12, 20 * scale)}px`;

    prevCanvasWidth = newWidth;
    prevCanvasHeight = newHeight;

    initBackgroundStars();
}

document.addEventListener('fullscreenchange', () => {
    resizeCanvasForFullscreen();
});

window.addEventListener('resize', () => {
    if (document.fullscreenElement) resizeCanvasForFullscreen();
});

// ==================== Difficulty Selection ====================
const difficultyButtons = document.querySelectorAll('.diff-btn');
const difficultyInfo = document.getElementById('difficultyInfo');

function selectDifficulty(difficulty) {
    currentDifficulty = difficulty;
    const config = DIFFICULTY_CONFIG[difficulty];
    
    // Update LEVEL_LENGTH for obstacle generation
    LEVEL_LENGTH = BASE_LEVEL_LENGTH * config.levelMultiplier;
    
    // Update button states
    difficultyButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.difficulty === difficulty) {
            btn.classList.add('active');
        }
    });
    
    // Update info text
    if (config.targetPercent === Infinity) {
        difficultyInfo.textContent = 'Goal: Survive as long as you can!';
    } else {
        difficultyInfo.textContent = 'Goal: ' + config.targetPercent + '%';
    }
    difficultyInfo.style.color = config.color;
    
    // Reset best score when changing difficulty
    bestScore = 0;
}

difficultyButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectDifficulty(btn.dataset.difficulty);
    });
});

// ==================== Initialize ====================
selectDifficulty('easy'); // Set default difficulty
resizeCanvasForFullscreen();
initBackgroundStars();
requestAnimationFrame(gameLoop);
