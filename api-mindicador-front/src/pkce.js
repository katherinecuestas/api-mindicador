// PKCE = Proof Key for Code Exchange. Evita que alguien intercepte el
// "code" y lo cambie por un token sin tener la clave secreta original,
// que en este caso es el "verifier" que solo existe en tu navegador.

// Genera un string aleatorio, es el "code_verifier"
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array); // números aleatorios criptográficamente seguros
  return base64UrlEncode(array.buffer);
}

// Convierte el verifier en su versión "hasheada" (SHA-256), es el "code_challenge"
// que sí se manda por la URL. El verifier real nunca viaja hasta el paso final.
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}