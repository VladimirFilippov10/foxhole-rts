// ===== РЕНДЕР: ЛАНДШАФТ =====
// Трава, озёра, дороги, мосты, городские зоны, камни, кусты, деревья.
import { ROADS, CITY_ZONES, TREES, BUSHES, ROCKS, GRASS_PATCHES, LAKES } from '../map.js';

export function drawGrassPatches(ctx, cam, canvas) {
    GRASS_PATCHES.forEach(patch => {
        const x = patch.x - cam.x;
        const y = patch.y - cam.y;
        if (x < -100 || x > canvas.width + 100 || y < -100 || y > canvas.height + 100) return;

        // Gradient grass
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, patch.radius);
        gradient.addColorStop(0, 'rgba(120, 140, 80, 0.4)');
        gradient.addColorStop(0.7, 'rgba(100, 120, 60, 0.2)');
        gradient.addColorStop(1, 'rgba(80, 100, 40, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, patch.radius, patch.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
    });
}

export function drawLakes(ctx, lakes, cam, canvas) {
    lakes.forEach(lake => {
        const centerX = lake.col * 250 + 125;
        const centerY = lake.row * 150 + 75;
        const x = centerX - cam.x;
        const y = centerY - cam.y;
        
        if (x < -200 || x > canvas.width + 200 || y < -200 || y > canvas.height + 200) return;
        
        // Draw lake water with irregular shape
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, lake.radius);
        gradient.addColorStop(0, 'rgba(70, 130, 180, 0.8)');
        gradient.addColorStop(0.7, 'rgba(100, 149, 237, 0.6)');
        gradient.addColorStop(1, 'rgba(135, 206, 235, 0.4)');
        ctx.fillStyle = gradient;
        
        // Create irregular lake shape using multiple points
        ctx.beginPath();
        const points = 12;
        for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            // Add variation to radius for irregular shape
            const variation = 0.8 + Math.sin(angle * 3 + lake.col) * 0.2 + Math.cos(angle * 2 + lake.row) * 0.15;
            const radiusX = lake.radius * variation;
            const radiusY = lake.radius * 0.7 * (1 + Math.sin(angle * 2 + lake.col * 2) * 0.2);
            const px = x + Math.cos(angle) * radiusX;
            const py = y + Math.sin(angle) * radiusY;
            
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                // Use quadratic curves for smooth shape
                const prevAngle = ((i - 1) / points) * Math.PI * 2;
                const midAngle = (prevAngle + angle) / 2;
                const midVariation = 0.8 + Math.sin(midAngle * 3 + lake.col) * 0.2 + Math.cos(midAngle * 2 + lake.row) * 0.15;
                const midRadiusX = lake.radius * midVariation * 1.1;
                const midRadiusY = lake.radius * 0.7 * (1 + Math.sin(midAngle * 2 + lake.col * 2) * 0.2) * 1.1;
                const cpx = x + Math.cos(midAngle) * midRadiusX;
                const cpy = y + Math.sin(midAngle) * midRadiusY;
                ctx.quadraticCurveTo(cpx, cpy, px, py);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        // Draw water ripples with irregular shape
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        for (let r = 1; r <= 3; r++) {
            ctx.beginPath();
            const scale = r / 4;
            for (let i = 0; i <= points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const variation = 0.8 + Math.sin(angle * 3 + lake.col) * 0.2 + Math.cos(angle * 2 + lake.row) * 0.15;
                const radiusX = lake.radius * variation * scale;
                const radiusY = lake.radius * 0.7 * (1 + Math.sin(angle * 2 + lake.col * 2) * 0.2) * scale;
                const px = x + Math.cos(angle) * radiusX;
                const py = y + Math.sin(angle) * radiusY;
                
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();
            ctx.stroke();
        }
        
        // Draw fishing huts
        lake.huts.forEach(hut => {
            const hutX = x + hut.offsetX;
            const hutY = y + hut.offsetY;
            
            // Hut shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(hutX - 9, hutY - 9, 20, 20);
            
            // Hut body
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(hutX - 10, hutY - 10, 20, 20);
            
            // Hut roof
            ctx.fillStyle = '#654321';
            ctx.beginPath();
            ctx.moveTo(hutX - 12, hutY - 10);
            ctx.lineTo(hutX, hutY - 20);
            ctx.lineTo(hutX + 12, hutY - 10);
            ctx.closePath();
            ctx.fill();
            
            // Door
            ctx.fillStyle = '#4a2511';
            ctx.fillRect(hutX - 3, hutY, 6, 10);
        });
        
        // Draw docks
        lake.docks.forEach(dock => {
            const dockX = x + dock.offsetX;
            const dockY = y + dock.offsetY;
            
            // Dock planks
            ctx.fillStyle = '#a0522d';
            ctx.fillRect(dockX - 15, dockY - 3, 30, 6);
            
            // Dock posts
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(dockX - 15, dockY - 8, 3, 16);
            ctx.fillRect(dockX + 12, dockY - 8, 3, 16);
            
            // Dock ropes
            ctx.strokeStyle = '#d2691e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(dockX - 13, dockY - 5);
            ctx.lineTo(dockX + 13, dockY - 5);
            ctx.stroke();
        });
        
        // Lake name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(lake.name, x, y - lake.radius - 10);
    });
}

export function drawRoads(ctx, roads, cam) {
    roads.forEach(road => {
        const fromX = road.from[0] * 250 + 125;
        const fromY = road.from[1] * 150 + 75;
        const toX = road.to[0] * 250 + 125;
        const toY = road.to[1] * 150 + 75;
        
        // Road shadow
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 28;
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        // Add curve
        const midX = (fromX + toX) / 2 + (toY - fromY) * road.curve;
        const midY = (fromY + toY) / 2 - (toX - fromX) * road.curve;
        
        ctx.moveTo(fromX - cam.x, fromY - cam.y);
        ctx.quadraticCurveTo(midX - cam.x, midY - cam.y, toX - cam.x, toY - cam.y);
        ctx.stroke();
        
        // Road base
        ctx.strokeStyle = '#5a4a35';
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.moveTo(fromX - cam.x, fromY - cam.y);
        ctx.quadraticCurveTo(midX - cam.x, midY - cam.y, toX - cam.x, toY - cam.y);
        ctx.stroke();
        
        // Road surface
        ctx.strokeStyle = '#7a6a55';
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.moveTo(fromX - cam.x, fromY - cam.y);
        ctx.quadraticCurveTo(midX - cam.x, midY - cam.y, toX - cam.x, toY - cam.y);
        ctx.stroke();
        
        // Road markings
        ctx.strokeStyle = '#8a7a65';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.moveTo(fromX - cam.x, fromY - cam.y);
        ctx.quadraticCurveTo(midX - cam.x, midY - cam.y, toX - cam.x, toY - cam.y);
        ctx.stroke();
        ctx.setLineDash([]);
    });
}

export function drawBridges(ctx, bridges, cam) {
    bridges.forEach(br => {
        const x = br.x - cam.x;
        const y = br.y - cam.y;
        
        // Bridge shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(x - 37, y - 16, 74, 32);
        
        // Bridge structure
        ctx.fillStyle = '#6a5a45';
        ctx.fillRect(x - 35, y - 14, 70, 28);
        
        // Bridge planks
        ctx.strokeStyle = '#5a4a35';
        ctx.lineWidth = 1;
        for (let i = -30; i < 35; i += 5) {
            ctx.beginPath();
            ctx.moveTo(x + i, y - 14);
            ctx.lineTo(x + i, y + 14);
            ctx.stroke();
        }
        
        // Bridge details
        ctx.strokeStyle = '#4a3a25';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 35, y - 14, 70, 28);
        
        // Railings
        ctx.fillStyle = '#4a3a25';
        ctx.fillRect(x - 35, y - 16, 70, 3);
        ctx.fillRect(x - 35, y + 13, 70, 3);
        
        // Railing posts
        for (let i = -30; i <= 30; i += 10) {
            ctx.fillRect(x + i, y - 18, 2, 5);
            ctx.fillRect(x + i, y + 13, 2, 5);
        }
        
        // Bridge name
        ctx.fillStyle = '#d1d5db';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(br.name, x, y - 22);
    });
}

export function drawCityZones(ctx, zones, cam) {
    zones.forEach(zone => {
        const centerX = zone.col * 250 + 125;
        const centerY = zone.row * 150 + 75;
        
        // Ground texture for city
        ctx.fillStyle = 'rgba(90, 80, 70, 0.3)';
        ctx.beginPath();
        ctx.arc(centerX - cam.x, centerY - cam.y, zone.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Streets (lighter paths)
        ctx.strokeStyle = 'rgba(120, 110, 100, 0.5)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(centerX - cam.x, centerY - cam.y, zone.radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw buildings in city
        for (let i = 0; i < zone.buildings; i++) {
            const angle = (Math.PI * 2 * i) / zone.buildings + (i * 0.3);
            const dist = zone.radius * (0.3 + (i % 3) * 0.2);
            const bx = centerX + Math.cos(angle) * dist - cam.x;
            const by = centerY + Math.sin(angle) * dist - cam.y;
            
            drawDetailedBuilding(ctx, bx, by, zone.type, i);
        }
    });
}

export function drawRocks(ctx, rocks, cam, canvas) {
    rocks.forEach(rock => {
        const x = rock.x - cam.x;
        const y = rock.y - cam.y;
        if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) return;
        
        // Rock shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + 2, y + rock.size * 0.5, rock.size * 0.8, rock.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Rock body
        ctx.fillStyle = '#6a6a6a';
        ctx.beginPath();
        ctx.ellipse(x, y, rock.size, rock.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Rock highlight
        ctx.fillStyle = '#7a7a7a';
        ctx.beginPath();
        ctx.ellipse(x - rock.size * 0.3, y - rock.size * 0.3, rock.size * 0.5, rock.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    });
}

export function drawBushes(ctx, bushes, cam, canvas) {
    bushes.forEach(bush => {
        const x = bush.x - cam.x;
        const y = bush.y - cam.y;
        if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) return;
        
        // Bush shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(x + 1, y + bush.size * 0.5, bush.size * 0.8, bush.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Bush body
        ctx.fillStyle = '#4a6a3a';
        ctx.beginPath();
        ctx.arc(x, y, bush.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Bush highlight
        ctx.fillStyle = '#5a7a4a';
        ctx.beginPath();
        ctx.arc(x - bush.size * 0.3, y - bush.size * 0.3, bush.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
    });
}

export function drawTrees(ctx, trees, cam, canvas) {
    trees.forEach(tree => {
        const x = tree.x - cam.x;
        const y = tree.y - cam.y;
        
        if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) return;
        
        // Tree shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + 2, y + tree.size * 0.8, tree.size * 0.7, tree.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        if (tree.type === 'pine') {
            // Pine tree - triangular
            ctx.fillStyle = '#3a5a2a';
            ctx.beginPath();
            ctx.moveTo(x, y - tree.size);
            ctx.lineTo(x - tree.size * 0.6, y + tree.size * 0.3);
            ctx.lineTo(x + tree.size * 0.6, y + tree.size * 0.3);
            ctx.closePath();
            ctx.fill();
            
            // Trunk
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(x - 2, y + tree.size * 0.3, 4, tree.size * 0.4);
            
            // Highlight
            ctx.fillStyle = '#4a6a3a';
            ctx.beginPath();
            ctx.moveTo(x, y - tree.size * 0.7);
            ctx.lineTo(x - tree.size * 0.3, y);
            ctx.lineTo(x + tree.size * 0.3, y);
            ctx.closePath();
            ctx.fill();
        } else {
            // Oak tree - round
            // Trunk
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(x - 3, y, 6, tree.size * 0.6);
            
            // Canopy
            ctx.fillStyle = '#4a6a3a';
            ctx.beginPath();
            ctx.arc(x, y - tree.size * 0.3, tree.size * 0.8, 0, Math.PI * 2);
            ctx.fill();
            
            // Canopy highlights
            ctx.fillStyle = '#5a7a4a';
            ctx.beginPath();
            ctx.arc(x - tree.size * 0.3, y - tree.size * 0.4, tree.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#6a8a5a';
            ctx.beginPath();
            ctx.arc(x + tree.size * 0.2, y - tree.size * 0.2, tree.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}
