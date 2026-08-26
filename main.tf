# Bloque de configuración general de Terraform, no crea nada en AWS
terraform {
  # Aquí declaras qué proveedores (plugins) necesita este proyecto
  required_providers {
    # Le pones el nombre "aws" a este proveedor, tú lo eliges
    aws = {
      source  = "hashicorp/aws" # de dónde descarga el plugin: HashiCorp, plugin oficial de AWS
      version = "~> 5.0"        # usa cualquier versión 5.x, pero nunca salta a la 6.0
    }
  }
}

# Configura la conexión real con AWS: con qué credenciales y en qué región trabaja
provider "aws" {
  region = "us-east-1" # la región de AWS donde se van a crear los recursos (Virginia, EE.UU.)
}

resource "aws_apigatewayv2_api" "api_manager" {
  name          = "api-mindicador"
  protocol_type = "HTTP"

  # Bloque CORS: le dice al navegador qué orígenes, métodos y headers
  # puede aceptar cuando el frontend llama a esta API desde otro dominio.
  cors_configuration {
    allow_origins = ["*"] # "*" = cualquier origen. Solo válido en DESARROLLO.
    # En producción cambia esto por ["http://localhost:5173"] o tu dominio real.

    allow_methods = ["GET", "OPTIONS"]
    # ↑ verbos HTTP permitidos. OPTIONS siempre debe ir, es el que responde el preflight.

    allow_headers = ["Content-Type", "Authorization", "X-Api-Key"]
    # ↑ headers que el frontend puede enviar. Authorization es clave porque
    #   ahí va el Access Token de Cognito una vez que integres el JWT Authorizer.

    max_age = 300 # segundos que el navegador cachea el resultado del preflight
    #                  antes de volver a preguntar. Reduce peticiones OPTIONS repetidas.
  }
}

# Segundo recurso: define a quién llama la API cuando le llega una petición
resource "aws_apigatewayv2_integration" "backend" {
  api_id = aws_apigatewayv2_api.api_manager.id
  # ↑ esta línea es una REFERENCIA: usa el id de la API creada arriba.
  #   Por esto Terraform sabe que debe crear la API primero, y esta integración después.

  integration_type       = "HTTP_PROXY"                # reenvía la petición tal cual, sin transformarla
  integration_method     = "GET"                       # método HTTP que usa para llamar al backend
  integration_uri        = "https://mindicador.cl/api" # la URL real a la que se conecta
  payload_format_version = "1.0"                       # formato del mensaje que viaja entre API Gateway y el backend
}

# Tercer recurso: la "ruta", decide qué responde según lo que pida el cliente
resource "aws_apigatewayv2_route" "datos" {
  api_id    = aws_apigatewayv2_api.api_manager.id # de nuevo, referencia a la API de arriba
  route_key = "GET /datos"                        # activa esta ruta solo si piden GET en /datos

  target = "integrations/${aws_apigatewayv2_integration.backend.id}"
  # ↑ le dice a la ruta a qué integración enviar la petición.
  #   ${...} es interpolación: inserta el id de la integración del bloque anterior dentro del texto.

  # A partir de aquí la ruta exige un JWT válido antes de dejar pasar la petición.
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Sexta ruta: misma integración, pero SIN authorizer. Ruta abierta,
# sirve para comparar contra /datos en la demo.
resource "aws_apigatewayv2_route" "publico_datos" {
  api_id    = aws_apigatewayv2_api.api_manager.id
  route_key = "GET /publico/datos"
  target    = "integrations/${aws_apigatewayv2_integration.backend.id}"
}

# Cuarto recurso: el "stage", el ambiente publicado que hace que la API responda de verdad
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api_manager.id # referencia a la API otra vez
  name        = "$default"                          # nombre especial de AWS para el stage por defecto
  auto_deploy = true                                # cada cambio se publica automático, sin comando extra
}

# Bloque de salida: qué valor quieres ver impreso al final del "terraform apply"
output "url_datos" {
  value = "${aws_apigatewayv2_stage.default.invoke_url}/datos"
  # ↑ arma la URL final juntando la URL base del stage + "/datos"
}

# Quinto recurso: el AUTHORIZER, valida el token JWT antes de dejar pasar
# a la ruta. Se conecta con tu User Pool de Cognito.
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.api_manager.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  name = "cognito-jwt-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.spa.id]
    issuer   = "https://cognito-idp.us-east-1.amazonaws.com/${aws_cognito_user_pool.pool.id}"
  }
}
