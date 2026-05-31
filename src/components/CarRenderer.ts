/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function drawPixelCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  angle: number,
  type: 'WHITE_GREEN' | 'BLACK_RED' | 'TRAFFIC_BLUE' | 'TRAFFIC_YELLOW' | 'TRAFFIC_ORANGE',
  isBraking: boolean = false,
  turnDirection: 'LEFT' | 'RIGHT' | null = null,
  flashFactor: number = 0,
  headlightsOn: boolean = true
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const halfW = width / 2;
  const halfH = height / 2;

  // Draw flat high-performance retro styled shadow silhouette (no slow shadowBlur lag!)
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(3, 4, halfW * 0.95, halfH * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 1. Headlight Shaft cones (if headlights pointing forward)
  if (headlightsOn && (type === 'WHITE_GREEN' || type === 'BLACK_RED')) {
    ctx.save();

    // Headlight cones
    const beamLength = 120;
    const beamAngle = 0.25; // width of beam cone
    const gradL = ctx.createRadialGradient(-8, -halfH + 2, 2, -12, -halfH - beamLength, beamLength);
    gradL.addColorStop(0, 'rgba(255, 255, 200, 0.55)');
    gradL.addColorStop(0.3, 'rgba(255, 255, 200, 0.25)');
    gradL.addColorStop(1, 'rgba(255, 255, 200, 0.0)');

    const gradR = ctx.createRadialGradient(8, -halfH + 2, 2, 12, -halfH - beamLength, beamLength);
    gradR.addColorStop(0, 'rgba(255, 255, 200, 0.55)');
    gradR.addColorStop(0.3, 'rgba(255, 255, 200, 0.25)');
    gradR.addColorStop(1, 'rgba(255, 255, 200, 0.0)');

    // Left beam
    ctx.fillStyle = gradL;
    ctx.beginPath();
    ctx.moveTo(-8, -halfH + 2);
    ctx.lineTo(-8 - Math.sin(beamAngle) * beamLength, -halfH - beamLength);
    ctx.lineTo(-8 + Math.sin(beamAngle) * beamLength, -halfH - beamLength);
    ctx.closePath();
    ctx.fill();

    // Right beam
    ctx.fillStyle = gradR;
    ctx.beginPath();
    ctx.moveTo(8, -halfH + 2);
    ctx.lineTo(8 - Math.sin(beamAngle) * beamLength, -halfH - beamLength);
    ctx.lineTo(8 + Math.sin(beamAngle) * beamLength, -halfH - beamLength);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Define colors based on car type
  let primaryColor = '#FFFFFF';
  let stripeColor = '#10B981'; // Green
  let spoilerColor = '#059669'; // Darker Green
  let mirrorColor = '#10B981';
  let rimColor = '#34D399';
  let windshieldColor = '#111827';

  if (type === 'BLACK_RED') {
    primaryColor = '#0f172a'; // Carbon black/deep slate
    stripeColor = '#f43f5e'; // Vivid cherry red
    spoilerColor = '#be123c'; // Dark hot pink
    mirrorColor = '#f43f5e';
    rimColor = '#fbbf24'; // Golden rims!
    windshieldColor = '#020617';
  } else if (type === 'TRAFFIC_BLUE') {
    primaryColor = '#1e3a8a'; // Midnight racing blue
    stripeColor = '#60a5fa'; // Electric drift blue
    spoilerColor = '#f8fafc'; // Pure white spoiler wing
    mirrorColor = '#3b82f6';
    rimColor = '#fcd34d'; // Anodized gold rims
    windshieldColor = '#020617';
  } else if (type === 'TRAFFIC_YELLOW') {
    primaryColor = '#D97706'; // Yellow/Orange Cab
    stripeColor = '#B45309';
    spoilerColor = '#27272A';
    mirrorColor = '#F59E0B';
    rimColor = '#FBBF24';
  } else if (type === 'TRAFFIC_ORANGE') {
    primaryColor = '#EA580C';
    stripeColor = '#C2410C';
    spoilerColor = '#27272A';
    mirrorColor = '#F97316';
    rimColor = '#FB923C';
  }

  // Draw Main Shadows or Underglow
  if (type === 'WHITE_GREEN' || type === 'BLACK_RED' || type === 'TRAFFIC_BLUE') {
    ctx.fillStyle = type === 'BLACK_RED' ? 'rgba(244, 63, 94, 0.22)' : 'rgba(56, 189, 248, 0.22)';
    ctx.beginPath();
    ctx.arc(0, 0, width * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Wheels (Rear)
  ctx.fillStyle = '#111827';
  // Rear Left Wheel
  ctx.fillRect(-halfW - 2, halfH - 22, 5, 14);
  // Rear Right Wheel
  ctx.fillRect(halfW - 3, halfH - 22, 5, 14);

  // Wheel outlines/rims (Rear)
  ctx.fillStyle = rimColor;
  ctx.fillRect(-halfW - 1, halfH - 18, 2, 6);
  ctx.fillRect(halfW - 2, halfH - 18, 2, 6);

  // 3. Front Wheels (rotating if turning)
  ctx.save();
  const wheelTurnAngle = turnDirection === 'LEFT' ? -0.32 : turnDirection === 'RIGHT' ? 0.32 : 0;
  
  // Front Left Wheel
  ctx.save();
  ctx.translate(-halfW, -halfH + 18);
  ctx.rotate(wheelTurnAngle);
  ctx.fillStyle = '#111827';
  ctx.fillRect(-2, -7, 5, 14);
  ctx.fillStyle = rimColor;
  ctx.fillRect(-1, -3, 2, 6);
  ctx.restore();

  // Front Right Wheel
  ctx.save();
  ctx.translate(halfW, -halfH + 18);
  ctx.rotate(wheelTurnAngle);
  ctx.fillStyle = '#111827';
  ctx.fillRect(-3, -7, 5, 14);
  ctx.fillStyle = rimColor;
  ctx.fillRect(-2, -3, 2, 6);
  ctx.restore();

  ctx.restore();

  // 4. Car Chassis / Body (Rounded Rectangle base)
  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  // Front bumper curve
  ctx.moveTo(-halfW + 3, -halfH + 4);
  ctx.quadraticCurveTo(0, -halfH - 1, halfW - 3, -halfH + 4);
  // Right side skirt
  ctx.lineTo(halfW - 1, -halfH + 12);
  ctx.quadraticCurveTo(halfW, 0, halfW - 1, halfH - 12);
  // Rear bumper curve
  ctx.lineTo(halfW - 3, halfH - 3);
  ctx.quadraticCurveTo(0, halfH + 1, -halfW + 3, halfH - 3);
  // Left side skirt
  ctx.lineTo(-halfW + 1, halfH - 12);
  ctx.quadraticCurveTo(-halfW, 0, -halfW + 1, -halfH + 12);
  ctx.closePath();
  ctx.fill();

  // Draw borders for pixel-art definition
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 5. Racing Stripes
  ctx.fillStyle = stripeColor;
  if (type === 'WHITE_GREEN') {
    // Twin stripes down the middle
    ctx.fillRect(-3, -halfH, 2, height - 2);
    ctx.fillRect(1, -halfH, 2, height - 2);
  } else if (type === 'BLACK_RED') {
    // S-curve side decals matching image 2 (Black-Red GT3RS has red borders)
    ctx.fillRect(-halfW + 1.5, -halfH + 15, 2.5, height - 32);
    ctx.fillRect(halfW - 4, -halfH + 15, 2.5, height - 32);
    // Hood dual triangles
    ctx.beginPath();
    ctx.moveTo(-5, -halfH + 6);
    ctx.lineTo(-2, -halfH + 15);
    ctx.lineTo(-5, -halfH + 15);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(5, -halfH + 6);
    ctx.lineTo(2, -halfH + 15);
    ctx.lineTo(5, -halfH + 15);
    ctx.closePath();
    ctx.fill();
  } else {
    // Traffic car center single stripe
    ctx.fillRect(-2, -halfH, 4, height);
  }

  // 6. Cabin Glass (Windshield & Rear windows)
  ctx.fillStyle = windshieldColor;
  ctx.beginPath();
  // Front windshield
  ctx.moveTo(-halfW + 4, -9);
  ctx.quadraticCurveTo(0, -14, halfW - 4, -9);
  // Right side window
  ctx.lineTo(halfW - 3.5, 12);
  // Rear window
  ctx.quadraticCurveTo(0, 16, -halfW + 3.5, 12);
  ctx.closePath();
  ctx.fill();
  
  // Highlight reflection glint on windshield
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.moveTo(-halfW + 6, -8);
  ctx.lineTo(-1, -12);
  ctx.lineTo(1, -12);
  ctx.lineTo(-halfW + 8, -6);
  ctx.closePath();
  ctx.fill();

  // Window frame border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Roof striping (if white-green or black-red)
  if (type === 'WHITE_GREEN' || type === 'BLACK_RED') {
    ctx.fillStyle = primaryColor;
    ctx.fillRect(-6, -4, 12, 11);
    ctx.fillStyle = stripeColor;
    if (type === 'WHITE_GREEN') {
      ctx.fillRect(-3, -4, 2, 11);
      ctx.fillRect(1, -4, 2, 11);
    } else {
      ctx.fillRect(-4, -4, 1.5, 11);
      ctx.fillRect(2.5, -4, 1.5, 11);
    }
  }

  // 7. Side Mirrors
  ctx.fillStyle = mirrorColor;
  // Left Mirror
  ctx.fillRect(-halfW - 3, -halfH + 16, 4, 3.5);
  ctx.fillStyle = '#000000';
  ctx.strokeRect(-halfW - 3, -halfH + 16, 4, 3.5);

  // Right Mirror
  ctx.fillStyle = mirrorColor;
  ctx.fillRect(halfW - 1, -halfH + 16, 4, 3.5);
  ctx.fillStyle = '#000000';
  ctx.strokeRect(halfW - 1, -halfH + 16, 4, 3.5);

  // 8. Detailed spoiler wing (High spoiler GT3RS style)
  ctx.save();
  
  // Spoiler Mount struts (Black)
  ctx.fillStyle = '#000000';
  ctx.fillRect(-8, halfH - 8, 3, 7);
  ctx.fillRect(5, halfH - 8, 3, 7);

  // Main Spoiler blade
  ctx.fillStyle = spoilerColor;
  // Draws the wide spoiler overlapping side bounds
  const spoilerY = halfH - 4;
  ctx.fillRect(-halfW - 3, spoilerY, width + 6, 5);
  ctx.fillStyle = '#000000';
  ctx.strokeRect(-halfW - 3, spoilerY, width + 6, 5);

  // Spoiler Side wings
  ctx.fillStyle = stripeColor;
  ctx.fillRect(-halfW - 3, spoilerY - 2, 2.5, 9);
  ctx.fillRect(halfW + 1, spoilerY - 2, 2.5, 9);
  ctx.fillStyle = '#000000';
  ctx.strokeRect(-halfW - 3, spoilerY - 2, 2.5, 9);
  ctx.strokeRect(halfW + 1, spoilerY - 2, 2.5, 9);
  ctx.restore();

  // 9. Front Headlights / Air intake details
  if (type === 'WHITE_GREEN' || type === 'BLACK_RED') {
    // Air intakes in bumper (black slots)
    ctx.fillStyle = '#111827';
    ctx.fillRect(-halfW + 5, -halfH + 1, 4, 2);
    ctx.fillRect(halfW - 9, -halfH + 1, 4, 2);
    ctx.fillRect(-3, -halfH, 6, 1.5);

    // Glowing front Headlamps (yellow/green on white, yellow/red on black)
    ctx.fillStyle = '#FBBF24'; // Yellow
    ctx.beginPath();
    ctx.arc(-halfW + 4.5, -halfH + 3.5, 2.5, 0, Math.PI * 2);
    ctx.arc(halfW - 4.5, -halfH + 3.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.stroke();
  }

  // 10. Taillights (Glossy red LED strips)
  ctx.fillStyle = isBraking ? '#FF0000' : '#B91C1C';
  ctx.fillRect(-halfW + 4, halfH - 2, 6, 2.5);
  ctx.fillRect(halfW - 10, halfH - 2, 6, 2.5);

  // Brake light intense red glow overlay
  if (isBraking) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.beginPath();
    ctx.arc(-halfW + 7, halfH, 6, 0, Math.PI * 2);
    ctx.arc(halfW - 7, halfH, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 11. White damage screen flash (if hit)
  if (flashFactor > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${flashFactor})`;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillRect(-halfW - 6, -halfH - 6, width + 12, height + 12);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draws road hazards like Concrete barriers & Oil Slicks
 */
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 'BARRIER' | 'OIL_SLICK',
  width: number,
  height: number
) {
  ctx.save();
  ctx.translate(x, y);

  if (type === 'OIL_SLICK') {
    ctx.save();

    // Iridescent cherry blossom chemical splash
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, width / 2);
    grad.addColorStop(0, '#fbcfe8'); // Pale cherry center
    grad.addColorStop(0.4, '#f472b6'); // Sakura pink
    grad.addColorStop(0.75, '#be185d'); // Deep plum ring
    grad.addColorStop(1, 'rgba(190, 24, 93, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2, height / 2, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Outlining the puddle like GBA hand-drawn sprites
    ctx.strokeStyle = '#9f1239';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, width / 2 - 1, height / 2 - 1, -0.1, 0, Math.PI * 2);
    ctx.stroke();

    // Floating individual cherry blossom petal outlines inside puddle
    ctx.fillStyle = '#fdf2f8';
    ctx.strokeStyle = '#db2777';
    ctx.lineWidth = 1;

    // Petal 1
    ctx.save();
    ctx.translate(-4, -2);
    ctx.rotate(0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Petal 2
    ctx.save();
    ctx.translate(5, 3);
    ctx.rotate(-0.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();

  } else if (type === 'BARRIER') {
    // 16-bit GBA traditional Japanese construction striped barricade
    const halfW = width / 2;
    const halfH = height / 2;

    // High performance flat shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(-halfW - 2, 4, width + 4, height);
    ctx.restore();

    // Outer support frames (black-outlined yellow warning posts on details)
    ctx.fillStyle = '#1e293b'; // Slate dark steel frame
    ctx.fillRect(-halfW - 3, -halfH, 4, height);
    ctx.fillRect(halfW - 1, -halfH, 4, height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(-halfW - 3, -halfH, 4, height);
    ctx.strokeRect(halfW - 1, -halfH, 4, height);

    // Main barricade wood board (Traditional Japanese White & Red Stripes)
    ctx.fillStyle = '#f8fafc'; // White base board
    ctx.fillRect(-halfW, -halfH + 3, width, height - 6);
    
    // Draw GBA thick black outlines
    ctx.strokeRect(-halfW, -halfH + 3, width, height - 6);

    // Draw red warning slant hazard lines
    ctx.save();
    ctx.beginPath();
    ctx.rect(-halfW + 1, -halfH + 4, width - 2, height - 8);
    ctx.clip();

    ctx.fillStyle = '#ef4444'; // Safety Red
    ctx.beginPath();
    for (let offset = -width; offset < width; offset += 16) {
      ctx.moveTo(offset, -halfH);
      ctx.lineTo(offset + 10, -halfH);
      ctx.lineTo(offset + 22, halfH);
      ctx.lineTo(offset + 12, halfH);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();

    // Draw little pixelated warning English text "SLOW" in center of barricade
    ctx.save();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 6px font-mono';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    // Draw background badge for readability
    ctx.fillStyle = 'rgba(251, 191, 36, 0.9)'; // Amber gold box
    ctx.fillRect(-14, -4.5, 28, 9);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(-14, -4.5, 28, 9);
    
    // Tiny black pixel icon representing caution symbol ⚠
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 6px font-mono';
    ctx.fillText('SLOW', 0, 2.5);
    ctx.restore();

    // Blinking golden warning beacon lantern on top right of the barricade
    const blinkActive = Math.floor(Date.now() / 160) % 2 === 0;
    
    // Bracket
    ctx.fillStyle = '#334155';
    ctx.fillRect(halfW - 7, -halfH - 2, 5, 5);
    ctx.strokeRect(halfW - 7, -halfH - 2, 5, 5);

    // Bulb housing / glass
    ctx.fillStyle = blinkActive ? '#fef08a' : '#d97706';
    ctx.beginPath();
    ctx.arc(halfW - 4.5, -halfH - 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Blinking halo bloom!
    if (blinkActive) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.beginPath();
      ctx.arc(halfW - 4.5, -halfH - 5, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
