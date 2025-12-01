/**
 * IP Address Helper
 * Extracts IP address from request, handling proxies and load balancers
 */

function getClientIp(req) {
  // Check various headers for IP (in order of preference)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = forwarded.split(',');
    return ips[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }
  
  const cfConnectingIp = req.headers['cf-connecting-ip']; // Cloudflare
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Fallback to connection remote address
  return req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.ip || 
         'unknown';
}

function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

module.exports = {
  getClientIp,
  getUserAgent,
};





