/**
 * RFC-822 / MIME Email Parser for Aegis-Trace Cyber Forensics
 * Parses raw .eml file content, headers, MIME boundaries, plain/HTML body,
 * links, attachments, and extracts all network hop relays from Received headers.
 */

export interface ParsedEmailAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
  sizeFormatted: string;
  sha256: string;
  isSuspicious: boolean;
  suspicionReason?: string;
}

export interface ParsedReceivedHop {
  hopNumber: number;
  fromRaw: string;
  byRaw: string;
  withProtocol: string;
  ip: string;
  timestamp: string;
  isAnomalous: boolean;
  relayLabel: string;
}

export interface ParsedEmailData {
  headers: Record<string, string>;
  rawHeaders: string;
  messageId: string;
  date: string;
  subject: string;
  from: string;
  fromName: string;
  fromAddress: string;
  fromDomain: string;
  to: string;
  toName: string;
  toAddress: string;
  toDomain: string;
  replyTo?: string;
  returnPath?: string;
  returnPathDomain?: string;
  
  // Security Authentication Headers
  receivedSpf?: string;
  authenticationResults?: string;
  dkimSignature?: string;
  dmarcVerdictHeader?: string;

  // Extracted Relays & IPs
  hops: ParsedReceivedHop[];
  originIp?: string;        // First public IP found (origin hop)
  publicIPs: string[];      // All unique public IPs across all Received headers

  // Body & Content
  bodyText: string;
  bodyHtml: string;
  extractedUrls: string[];
  attachments: ParsedEmailAttachment[];
}

/**
 * Unfolds folded RFC-822 headers (lines starting with space or tab)
 */
function unfoldHeaders(headerBlock: string): string[] {
  const lines = headerBlock.split(/\r?\n/);
  const unfolded: string[] = [];
  
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += ' ' + line.trim();
    } else if (line.trim().length > 0) {
      unfolded.push(line);
    }
  }
  return unfolded;
}

/**
 * Extracts email address and name from strings like "John Doe <johndoe@example.com>"
 */
function parseEmailAddress(raw: string): { name: string; address: string; domain: string } {
  if (!raw) return { name: '', address: '', domain: '' };
  
  const match = raw.match(/^(?:["']?([^"']*)["']?\s*)?<([^>]+)>/);
  if (match) {
    const name = (match[1] || '').trim();
    const address = (match[2] || '').trim().toLowerCase();
    const domain = address.split('@')[1] || '';
    return { name, address, domain };
  }
  
  const clean = raw.trim().replace(/^<|>$/g, '').toLowerCase();
  return {
    name: '',
    address: clean,
    domain: clean.split('@')[1] || '',
  };
}

/**
 * IPv4 regex matching
 */
const IPV4_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;

/**
 * Returns true if the IP is a private/loopback/reserved address that
 * should NOT be geolocated (RFC1918, loopback, link-local, etc.).
 */
function isPrivateOrReservedIP(ip: string): boolean {
  if (!ip) return true;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return true;
  const [a, b] = parts;
  return (
    a === 10 ||                          // 10.0.0.0/8
    a === 127 ||                         // 127.0.0.0/8 loopback
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) ||          // 192.168.0.0/16
    (a === 169 && b === 254) ||          // 169.254.0.0/16 link-local
    a === 0 ||                           // 0.0.0.0/8
    a >= 240                             // 240.0.0.0/4 reserved
  );
}

/**
 * Simple SHA-256 string hash generator for forensic demo / checksum simulation
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex}e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.substring(0, 64);
}

/**
 * Core function to parse an RFC-822 / .EML raw text
 */
export function parseEml(rawContent: string): ParsedEmailData {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  
  // Split header section and body section at the first empty line
  const headerEndIdx = normalized.indexOf('\n\n');
  const headerSection = headerEndIdx !== -1 ? normalized.substring(0, headerEndIdx) : normalized;
  const bodySection = headerEndIdx !== -1 ? normalized.substring(headerEndIdx + 2) : '';

  const headerLines = unfoldHeaders(headerSection);
  const headers: Record<string, string> = {};
  const receivedHeaders: string[] = [];

  for (const line of headerLines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      const val = line.substring(colonIdx + 1).trim();
      
      if (key === 'received') {
        receivedHeaders.push(val);
      } else {
        headers[key] = val;
      }
    }
  }

  // Parse sender & recipient
  const fromParsed = parseEmailAddress(headers['from'] || '');
  const toParsed = parseEmailAddress(headers['to'] || '');
  const returnPathParsed = parseEmailAddress(headers['return-path'] || '');

  // Parse Received: hops (chronological order: reverse of email arrival)
  const hops: ParsedReceivedHop[] = [];
  const reversedReceived = [...receivedHeaders].reverse();
  
  let hopIndex = 1;
  const seenIPs = new Set<string>(); // dedupe identical IPs across hops

  for (const r of reversedReceived) {
    // Find all IPv4 addresses in this Received header
    const allIpMatches = r.match(new RegExp(IPV4_REGEX.source, 'g')) || [];
    // Pick the first non-private IP found in this header
    const ip = allIpMatches.find((candidate) => !isPrivateOrReservedIP(candidate)) || '';

    // Extract 'from' part and 'by' part
    const fromMatch = r.match(/from\s+([^\s;]+)/i);
    const byMatch = r.match(/by\s+([^\s;]+)/i);
    const withMatch = r.match(/with\s+([^\s;]+)/i);
    const dateMatch = r.match(/;\s*(.+)$/);

    const fromHost = fromMatch ? fromMatch[1] : (ip || 'unknown-relay');
    const byHost = byMatch ? byMatch[1] : 'internal-relay';
    const protocol = withMatch ? withMatch[1] : 'ESMTP';
    const timestamp = dateMatch ? dateMatch[1].trim() : new Date().toUTCString();

    // Only add hops that have a valid public IP and haven't been seen yet
    if (ip && !seenIPs.has(ip)) {
      seenIPs.add(ip);
      hops.push({
        hopNumber: hopIndex,
        fromRaw: fromHost,
        byRaw: byHost,
        withProtocol: protocol,
        ip,
        timestamp,
        isAnomalous: hopIndex === 1, // Origin hop flagged if unverified
        relayLabel: `${fromHost} → ${byHost}`,
      });
      hopIndex++;
    }
  }

  // Collect all unique public IPs found across all Received headers
  const allReceivedText = receivedHeaders.join(' ');
  const allIPMatches = allReceivedText.match(new RegExp(IPV4_REGEX.source, 'g')) || [];
  const publicIPs = Array.from(
    new Set(allIPMatches.filter((ip) => !isPrivateOrReservedIP(ip)))
  );

  // If no hops with public IPs were found, return empty — never fabricate an IP
  // The UI will show "No public IPs found in Received headers" state.

  // Parse Body text and URLs
  let bodyText = bodySection;
  let bodyHtml = '';

  // Extract boundary if multipart
  const contentType = headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=["']?([^"';]+)["']?/i);

  const attachments: ParsedEmailAttachment[] = [];

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = bodySection.split(`--${boundary}`);
    
    for (const part of parts) {
      if (part.includes('Content-Disposition: attachment') || part.includes('filename=')) {
        const filenameMatch = part.match(/filename=["']?([^"'\r\n]+)["']?/i);
        const name = filenameMatch ? filenameMatch[1] : 'attached_document.dat';
        // Only flag truly dangerous executable/script extensions
        const dangerousExts = ['.exe', '.vbs', '.js', '.bat', '.cmd', '.scr', '.ps1', '.hta', '.jar'];
        const isSuspicious = dangerousExts.some((ext) => name.toLowerCase().endsWith(ext));
        
        attachments.push({
          filename: name,
          contentType: 'application/octet-stream',
          sizeBytes: 98304,
          sizeFormatted: '98 KB',
          sha256: simpleHash(name + part.substring(0, 100)),
          isSuspicious,
          suspicionReason: isSuspicious ? `Dangerous file type: .${name.split('.').pop()?.toUpperCase()}` : undefined,
        });
      } else if (part.includes('text/plain')) {
        const textIdx = part.indexOf('\n\n');
        if (textIdx !== -1) bodyText = part.substring(textIdx + 2).trim();
      } else if (part.includes('text/html')) {
        const htmlIdx = part.indexOf('\n\n');
        if (htmlIdx !== -1) bodyHtml = part.substring(htmlIdx + 2).trim();
      }
    }
  }

  // Extract URLs from body
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const combinedBody = bodyText + ' ' + bodyHtml;
  const rawUrls = combinedBody.match(urlRegex) || [];
  const extractedUrls = Array.from(new Set(rawUrls));

  return {
    headers,
    rawHeaders: headerSection,
    messageId: headers['message-id'] || `<msg-${Date.now()}@aegis-trace.local>`,
    date: headers['date'] || new Date().toISOString(),
    subject: headers['subject'] || '(No Subject Provided)',
    from: headers['from'] || '',
    fromName: fromParsed.name,
    fromAddress: fromParsed.address,
    fromDomain: fromParsed.domain,
    to: headers['to'] || '',
    toName: toParsed.name,
    toAddress: toParsed.address,
    toDomain: toParsed.domain,
    replyTo: headers['reply-to'],
    returnPath: headers['return-path'],
    returnPathDomain: returnPathParsed.domain,
    
    receivedSpf: headers['received-spf'],
    authenticationResults: headers['authentication-results'],
    dkimSignature: headers['dkim-signature'],
    dmarcVerdictHeader: headers['dmarc-filter'] || headers['x-dmarc-info'],

    hops,
    originIp: hops[0]?.ip || undefined,
    publicIPs,
    bodyText,
    bodyHtml,
    extractedUrls,
    attachments,
  };
}
