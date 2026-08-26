import { useState, useEffect } from "react";
import { generateCodeVerifier, generateCodeChallenge } from "./pkce";

// ── Configuración real de TU proyecto ─────────────────────────────
// Estos valores vienen directo de tu cognito.tf y de tu API Gateway.
const COGNITO_DOMAIN = "https://dsy1107-grupokatherine-cuestas.auth.us-east-1.amazoncognito.com";
const CLIENT_ID = "4548r58bu4pv5fuakmc55332fs"; // el id del recurso aws_cognito_user_pool_client.spa
const REDIRECT_URI = "http://localhost:5173/";   // debe coincidir EXACTO con callback_urls en cognito.tf
const API_BASE = "https://esadf9f7h5.execute-api.us-east-1.amazonaws.com";

function App() {
  const [token, setToken] = useState(null);   // guarda el access_token una vez logueada
  const [resultado, setResultado] = useState(null); // lo que devuelve la API, para mostrarlo en pantalla

  // ── PASO A: al cargar la página, revisa si Cognito nos devolvió un "code" ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      intercambiarCodePorToken(code);
    }
  }, []);

  // ── PASO B: el usuario hace clic en "Iniciar sesión" ──
  async function iniciarSesion() {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    // Guardamos el verifier en sessionStorage porque lo necesitaremos
    // DESPUÉS de que el navegador vuelva de Cognito (recarga la página).
    sessionStorage.setItem("pkce_verifier", verifier);

    const authUrl = new URL(`${COGNITO_DOMAIN}/oauth2/authorize`);
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    // Redirige el navegador ENTERO a la pantalla de login de Cognito.
    window.location.href = authUrl.toString();
  }

  // ── PASO C: Cognito ya nos devolvió el "code", lo cambiamos por tokens ──
  async function intercambiarCodePorToken(code) {
    const verifier = sessionStorage.getItem("pkce_verifier");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier, // la prueba de que somos quien inició el login
    });

    const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body,
    });

    const data = await response.json();
    setToken(data.id_token);

    // Limpia el "?code=..." de la URL para que quede bonita
    window.history.replaceState({}, "", REDIRECT_URI);
  }

  // ── PASO D: llamar a tu API, con o sin token, según el botón ──
  async function llamarApi(ruta, conToken) {
    const headers = conToken ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(`${API_BASE}${ruta}`, { headers, cache: "no-store" });
    const data = await response.json();
    setResultado({ status: response.status, data });
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>API Mindicador + Cognito</h1>

      {!token ? (
        <button onClick={iniciarSesion}>Iniciar sesión</button>
      ) : (
        <p> Sesión iniciada</p>
      )}

      <div style={{ marginTop: "1rem" }}>
        <button onClick={() => llamarApi("/datos", true)} disabled={!token}>
          /datos con token
        </button>
        <button onClick={() => llamarApi("/datos", false)}>
          /datos sin token
        </button>
        <button onClick={() => llamarApi("/publico/datos", false)}>
          /publico/datos
        </button>
      </div>

      {resultado && (
        <pre style={{ marginTop: "1rem", background: "#eee", padding: "1rem" }}>
          Status: {resultado.status}
          {"\n"}
          {JSON.stringify(resultado.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default App;