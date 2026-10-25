import { ProtocolError } from '../shared/protocol.js';

const sameOrigin = (url, origin) => { try { return new URL(url).origin === origin; } catch { return false; } };
const trustedContents = (contents, origin) => !!contents && !contents.isDestroyed() && sameOrigin(contents.getURL(), origin);
function trustedRequest(contents, details, origin) {
  return trustedContents(contents, origin) && details?.isMainFrame === true &&
    sameOrigin(details.requestingUrl, origin) && (!details.securityOrigin || sameOrigin(details.securityOrigin, origin));
}
export function allowPermissionCheck(contents, permission, requestingOrigin, details, origin) {
  return sameOrigin(requestingOrigin, origin) && trustedRequest(contents, details, origin) &&
    (permission === 'display-capture' || (permission === 'media' && details.mediaType === 'audio'));
}
export function allowPermissionRequest(contents, permission, details, origin) {
  return trustedRequest(contents, details, origin) && (permission === 'display-capture' ||
    (permission === 'media' && Array.isArray(details.mediaTypes) && details.mediaTypes.length > 0 && details.mediaTypes.every(type => type === 'audio')));
}
export function trustedIpc(event, origin) {
  return trustedContents(event.sender, origin) && event.senderFrame === event.sender.mainFrame && sameOrigin(event.senderFrame?.url, origin);
}
export function allowDisplayCapture(contents, request, origin) {
  return trustedContents(contents, origin) && request.frame === contents.mainFrame &&
    sameOrigin(request.securityOrigin, origin) && sameOrigin(request.frame?.url, origin);
}
export function validatePreferences(value) {
  if (!value || Array.isArray(value) || typeof value.name !== 'string' || value.name.length > 32 ||
      typeof value.server !== 'string' || value.server.length > 2048 || !['720', '1080'].includes(value.quality)) throw new ProtocolError('INVALID_INPUT');
  if (value.server) {
    let url;
    try { url = new URL(value.server); } catch { throw new ProtocolError('INVALID_INPUT'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new ProtocolError('INVALID_INPUT');
  }
  return { name: value.name, server: value.server, quality: value.quality };
}
