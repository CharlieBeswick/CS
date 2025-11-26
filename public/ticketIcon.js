/**
 * Premium Ticket Icon System
 * Generates premium SVG ticket icons for all 8 tiers
 */

// Tier configuration with gradients, border colors, and icon types
const TIER_CONFIG = {
  BRONZE: {
    name: 'BRONZE',
    gradient: { topLeft: '#7A4E26', bottomRight: '#D59A6A' },
    borderColor: '#FFC37A',
    iconType: 'coin',
    iconLetter: 'B',
    iconColor: '#CD7F32'
  },
  SILVER: {
    name: 'SILVER',
    gradient: { topLeft: '#8B8B8B', bottomRight: '#ECECEC' },
    borderColor: '#DCEBFF',
    iconType: 'coin',
    iconLetter: 'S',
    iconColor: '#C0C0C0'
  },
  GOLD: {
    name: 'GOLD',
    gradient: { topLeft: '#C9A43A', bottomRight: '#F7D97A' },
    borderColor: '#FFDF63',
    iconType: 'coin',
    iconLetter: 'G',
    iconColor: '#FFD700'
  },
  EMERALD: {
    name: 'EMERALD',
    gradient: { topLeft: '#0C5E41', bottomRight: '#22DFA1' },
    borderColor: '#33FFBB',
    iconType: 'gem',
    gemColor: '#22DFA1'
  },
  SAPPHIRE: {
    name: 'SAPPHIRE',
    gradient: { topLeft: '#0A2B6F', bottomRight: '#1E74FF' },
    borderColor: '#4BD1FF',
    iconType: 'gem',
    gemColor: '#1E74FF'
  },
  RUBY: {
    name: 'RUBY',
    gradient: { topLeft: '#6F0A0A', bottomRight: '#FF3B52' },
    borderColor: '#FF4A6A',
    iconType: 'gem',
    gemColor: '#FF3B52'
  },
  AMETHYST: {
    name: 'AMETHYST',
    gradient: { topLeft: '#43176F', bottomRight: '#C36BFF' },
    borderColor: '#E273FF',
    iconType: 'gem',
    gemColor: '#C36BFF'
  },
  DIAMOND: {
    name: 'DIAMOND',
    gradient: { topLeft: '#1C2A36', bottomRight: '#A9E7FF' },
    borderColor: '#AFFFFF',
    iconType: 'gem',
    gemColor: '#A9E7FF'
  }
};

// Size presets (reduced but still visible, icons stay same size)
const SIZE_PRESETS = {
  sm: { width: 45, height: 30 },
  md: { width: 60, height: 40 },
  lg: { width: 75, height: 50 }
};

// Icon sizes (kept at original size, but will appear larger relative to tickets)
const ICON_SIZES = {
  sm: 30,
  md: 40,
  lg: 50
};

/**
 * Generate ticket stub SVG path
 * Creates a horizontal ticket with rounded corners and side notches
 */
function generateTicketPath(width, height, notchRadius = 4) {
  const radius = 6;
  const notchY = height / 2;
  
  // Build the path: start from top-left, go clockwise
  // Top edge
  let path = `M ${radius} 0 `;
  path += `L ${width - radius} 0 `;
  
  // Top-right corner
  path += `A ${radius} ${radius} 0 0 1 ${width} ${radius} `;
  
  // Right edge (down to notch)
  path += `L ${width} ${notchY - notchRadius} `;
  
  // Right notch (semi-circle cutout going inward)
  path += `A ${notchRadius} ${notchRadius} 0 0 0 ${width - notchRadius * 2} ${notchY} `;
  path += `A ${notchRadius} ${notchRadius} 0 0 0 ${width} ${notchY + notchRadius} `;
  
  // Right edge (continue down)
  path += `L ${width} ${height - radius} `;
  
  // Bottom-right corner
  path += `A ${radius} ${radius} 0 0 1 ${width - radius} ${height} `;
  
  // Bottom edge
  path += `L ${radius} ${height} `;
  
  // Bottom-left corner
  path += `A ${radius} ${radius} 0 0 1 0 ${height - radius} `;
  
  // Left edge (up to notch)
  path += `L 0 ${notchY + notchRadius} `;
  
  // Left notch (semi-circle cutout going inward)
  path += `A ${notchRadius} ${notchRadius} 0 0 0 ${notchRadius * 2} ${notchY} `;
  path += `A ${notchRadius} ${notchRadius} 0 0 0 0 ${notchY - notchRadius} `;
  
  // Left edge (continue up)
  path += `L 0 ${radius} `;
  
  // Top-left corner
  path += `A ${radius} ${radius} 0 0 1 ${radius} 0 Z`;
  
  return path;
}

/**
 * Generate coin icon SVG (for Bronze, Silver, Gold)
 */
function generateCoinIcon(letter, color, size = 40) {
  const center = size / 2;
  const radius = size * 0.4;
  
  return `
    <g class="ticket-coin">
      <!-- Outer ring with highlight -->
      <circle cx="${center}" cy="${center}" r="${radius}" fill="${color}" opacity="0.9" />
      <circle cx="${center}" cy="${center}" r="${radius * 0.95}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
      <circle cx="${center}" cy="${center}" r="${radius * 0.85}" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="0.5" />
      
      <!-- Inner bevel effect -->
      <circle cx="${center}" cy="${center}" r="${radius * 0.7}" fill="${color}" opacity="0.6" />
      
      <!-- Letter -->
      <text 
        x="${center}" 
        y="${center}" 
        text-anchor="middle" 
        dominant-baseline="central" 
        font-family="Arial, sans-serif" 
        font-weight="bold" 
        font-size="${size * 0.35}" 
        fill="rgba(0,0,0,0.7)"
        style="text-shadow: 0 1px 2px rgba(255,255,255,0.5);"
      >${letter}</text>
      
      <!-- Drop shadow -->
      <circle cx="${center + 2}" cy="${center + 2}" r="${radius}" fill="rgba(0,0,0,0.2)" opacity="0.5" />
    </g>
  `;
}

/**
 * Generate gem icon SVG (for Emerald, Sapphire, Ruby, Amethyst, Diamond)
 */
function generateGemIcon(color, size = 40) {
  const center = size / 2;
  const topY = center - size * 0.25;
  const bottomY = center + size * 0.25;
  const leftX = center - size * 0.2;
  const rightX = center + size * 0.2;
  
  return `
    <g class="ticket-gem">
      <!-- Main gem body (faceted) -->
      <path 
        d="M ${center} ${topY} 
           L ${rightX} ${center - size * 0.1} 
           L ${center} ${bottomY} 
           L ${leftX} ${center - size * 0.1} Z" 
        fill="${color}" 
        opacity="0.9"
      />
      
      <!-- Top facet -->
      <path 
        d="M ${center} ${topY} 
           L ${rightX} ${center - size * 0.1} 
           L ${center} ${center - size * 0.05} Z" 
        fill="rgba(255,255,255,0.4)"
      />
      
      <!-- Left facet highlight -->
      <path 
        d="M ${center} ${topY} 
           L ${leftX} ${center - size * 0.1} 
           L ${center} ${center - size * 0.05} Z" 
        fill="rgba(255,255,255,0.2)"
      />
      
      <!-- Bottom highlight -->
      <path 
        d="M ${center} ${center - size * 0.05} 
           L ${rightX} ${center - size * 0.1} 
           L ${center} ${bottomY} Z" 
        fill="rgba(0,0,0,0.2)"
      />
      
      <!-- Outer glow -->
      <path 
        d="M ${center} ${topY} 
           L ${rightX} ${center - size * 0.1} 
           L ${center} ${bottomY} 
           L ${leftX} ${center - size * 0.1} Z" 
        fill="none" 
        stroke="${color}" 
        stroke-width="1.5" 
        opacity="0.6"
      />
      
      <!-- Drop shadow -->
      <ellipse 
        cx="${center + 1}" 
        cy="${bottomY + 2}" 
        rx="${size * 0.15}" 
        ry="${size * 0.08}" 
        fill="rgba(0,0,0,0.3)"
      />
    </g>
  `;
}


/**
 * Main function to generate premium ticket icon
 * @param {string} tier - Tier name (BRONZE, SILVER, etc.)
 * @param {string} size - Size preset: 'sm', 'md', or 'lg'
 * @param {boolean} showLabel - Whether to show tier label (default: true) - NOTE: label is now rendered outside SVG
 * @returns {string} HTML string with SVG ticket icon (label is separate)
 */
function createTicketIcon(tier, size = 'md', showLabel = true) {
  const config = TIER_CONFIG[tier.toUpperCase()];
  if (!config) {
    console.error(`Unknown tier: ${tier}`);
    return '';
  }
  
  const dimensions = SIZE_PRESETS[size] || SIZE_PRESETS.md;
  const ticketWidth = dimensions.width;
  const ticketHeight = dimensions.height;
  
  // Icon size is independent of ticket size (kept at original size)
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;
  
  // ViewBox and SVG size should match ticket size (icon will be centered inside ticket)
  const viewBox = `0 0 ${ticketWidth} ${ticketHeight}`;
  
  const ticketPath = generateTicketPath(ticketWidth, ticketHeight);
  
  // Center icon in ticket
  const iconX = ticketWidth / 2;
  const iconY = ticketHeight / 2;
  
  // Generate centerpiece icon (centered in viewBox, overlapping ticket)
  let centerpieceIcon = '';
  if (config.iconType === 'coin') {
    centerpieceIcon = `<g transform="translate(${iconX - iconSize/2}, ${iconY - iconSize/2})">${generateCoinIcon(config.iconLetter, config.iconColor, iconSize)}</g>`;
  } else {
    centerpieceIcon = `<g transform="translate(${iconX - iconSize/2}, ${iconY - iconSize/2})">${generateGemIcon(config.gemColor, iconSize)}</g>`;
  }
  
  // Generate unique ID for this ticket instance
  const ticketId = `ticket-${tier.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return `
    <svg 
      class="premium-ticket-icon premium-ticket-${tier.toLowerCase()}" 
      viewBox="${viewBox}" 
      width="${ticketWidth}" 
      height="${ticketHeight}"
      xmlns="http://www.w3.org/2000/svg"
      data-tier="${tier.toUpperCase()}"
      style="overflow: visible;"
    >
      <defs>
        <!-- Background gradient -->
        <linearGradient id="gradient-${ticketId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${config.gradient.topLeft};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${config.gradient.bottomRight};stop-opacity:1" />
        </linearGradient>
        
        <!-- Noise texture pattern -->
        <pattern id="noise-${ticketId}" patternUnits="userSpaceOnUse" width="4" height="4">
          <rect width="4" height="4" fill="rgba(255,255,255,0.02)"/>
          <circle cx="1" cy="1" r="0.5" fill="rgba(0,0,0,0.02)"/>
          <circle cx="3" cy="3" r="0.5" fill="rgba(0,0,0,0.02)"/>
        </pattern>
        
        <!-- Glow filter for border with pulse animation support -->
        <filter id="glow-${ticketId}" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Layer 1: Background with gradient and texture -->
      <path 
        d="${ticketPath}" 
        fill="url(#gradient-${ticketId})"
      />
      <path 
        d="${ticketPath}" 
        fill="url(#noise-${ticketId})"
        opacity="0.3"
      />
      
      <!-- Layer 2: Glowing border (with pulse animation class) -->
      <path 
        class="ticket-border-glow"
        d="${ticketPath}" 
        fill="none" 
        stroke="${config.borderColor}" 
        stroke-width="2" 
        stroke-linejoin="round"
        filter="url(#glow-${ticketId})"
        opacity="0.8"
      />
      
      <!-- Inner border for depth -->
      <path 
        d="${ticketPath}" 
        fill="none" 
        stroke="rgba(255,255,255,0.2)" 
        stroke-width="0.5" 
        stroke-linejoin="round"
      />
      
      <!-- Layer 3: Centerpiece icon (centered in ticket) -->
      ${centerpieceIcon}
    </svg>
  `;
}

/**
 * Create ticket icon with label below (wrapper function)
 * @param {string} tier - Tier name (BRONZE, SILVER, etc.)
 * @param {string} size - Size preset: 'sm', 'md', or 'lg'
 * @param {boolean} showLabel - Whether to show tier label below (default: true)
 * @returns {string} HTML string with SVG ticket icon and label wrapper
 */
function createTicketIconWithLabel(tier, size = 'md', showLabel = true) {
  const config = TIER_CONFIG[tier.toUpperCase()];
  if (!config) {
    console.error(`Unknown tier: ${tier}`);
    return '';
  }
  
  const ticketIcon = createTicketIcon(tier, size, false); // Always false for label inside SVG
  
  if (!showLabel) {
    return ticketIcon;
  }
  
  // Wrap ticket with label below
  return `
    <div class="ticket-with-label">
      ${ticketIcon}
      <span class="ticket-label-below" style="color: ${config.borderColor};">${config.name}</span>
    </div>
  `;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createTicketIcon, createTicketIconWithLabel, TIER_CONFIG, SIZE_PRESETS, ICON_SIZES };
}

