"""Tests del backend. Ninguno llama a la IA real ni a Clerk real:
- el proveedor de IA se sustituye por una función falsa,
- los tokens de Clerk se firman aquí mismo con una clave RSA de prueba.
"""
import time
from types import SimpleNamespace

import index
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

client = TestClient(index.app)

TEXTO_VALIDO = "La fotosíntesis es el proceso por el que las plantas convierten luz en energía química."

# Valores de prueba de la configuración de Clerk
JWKS_URL = "https://demo.clerk.accounts.dev/.well-known/jwks.json"
EMISOR = "https://demo.clerk.accounts.dev"
ORIGEN = "http://localhost:5173"


# ---------------------------------------------------------------------------
# Utilidades para simular Clerk
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def clave_privada():
    """Par de claves RSA de prueba: hace de 'clave de firma de Clerk'."""
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def clerk_simulado(monkeypatch, clave_privada):
    """Configura el backend como si Clerk estuviera conectado."""
    monkeypatch.setenv("CLERK_JWKS_URL", JWKS_URL)
    monkeypatch.setenv("CLERK_AUTHORIZED_PARTIES", ORIGEN)
    # En vez de descargar las claves públicas de Clerk, usamos la de prueba
    falso = SimpleNamespace(
        get_signing_key_from_jwt=lambda token: SimpleNamespace(key=clave_privada.public_key())
    )
    monkeypatch.setattr(index, "_cliente_jwks", lambda url: falso)


def crear_token(clave_privada, **cambios):
    """Crea un token como el de Clerk. 'cambios' permite romper algún campo."""
    ahora = int(time.time())
    claims = {
        "sub": "user_123",
        "iss": EMISOR,
        "azp": ORIGEN,
        "iat": ahora,
        "exp": ahora + 60,
    }
    claims.update(cambios)
    return jwt.encode(claims, clave_privada, algorithm="RS256")


@pytest.fixture
def cabecera(clave_privada):
    """Cabecera Authorization con una sesión válida."""
    return {"Authorization": f"Bearer {crear_token(clave_privada)}"}


# ---------------------------------------------------------------------------
# Salud
# ---------------------------------------------------------------------------
def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Operación de IA con usuario autenticado
# ---------------------------------------------------------------------------
def test_generar_entrada_valida(monkeypatch, cabecera):
    async def falso(texto, n):
        return ["¿Qué es la fotosíntesis?", "¿Dónde ocurre?"]

    monkeypatch.setattr(index, "llamar_proveedor", falso)
    r = client.post(
        "/api/generar", json={"texto": TEXTO_VALIDO, "num_preguntas": 2}, headers=cabecera
    )
    assert r.status_code == 200
    assert r.json() == {"preguntas": ["¿Qué es la fotosíntesis?", "¿Dónde ocurre?"]}


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"texto": ""},
        {"texto": "corto"},
        {"texto": TEXTO_VALIDO, "num_preguntas": 99},
        {"texto": "x" * (index.MAX_TEXTO + 1)},
    ],
)
def test_generar_entrada_incorrecta(cuerpo, cabecera):
    r = client.post("/api/generar", json=cuerpo, headers=cabecera)
    assert r.status_code == 422


@pytest.mark.parametrize("codigo", [502, 504])
def test_generar_error_del_proveedor(monkeypatch, cabecera, codigo):
    async def falla(texto, n):
        raise index.ProviderError("La IA devolvió un error", status_code=codigo)

    monkeypatch.setattr(index, "llamar_proveedor", falla)
    r = client.post("/api/generar", json={"texto": TEXTO_VALIDO}, headers=cabecera)
    assert r.status_code == codigo
    assert r.json() == {"detail": "La IA devolvió un error"}


# ---------------------------------------------------------------------------
# Autenticación: peticiones que deben rechazarse con 401
# ---------------------------------------------------------------------------
@pytest.fixture
def ia_vigilada(monkeypatch):
    """Sustituye la IA por una función que anota si se ha llamado."""
    llamadas = []

    async def falso(texto, n):
        llamadas.append(1)
        return ["¿Pregunta?"]

    monkeypatch.setattr(index, "llamar_proveedor", falso)
    return llamadas


def test_sin_token_se_rechaza(ia_vigilada):
    r = client.post("/api/generar", json={"texto": TEXTO_VALIDO})
    assert r.status_code == 401
    assert ia_vigilada == []  # la IA no se ha consumido


def test_token_caducado_se_rechaza(clave_privada, ia_vigilada):
    token = crear_token(clave_privada, exp=int(time.time()) - 3600)
    r = client.post(
        "/api/generar",
        json={"texto": TEXTO_VALIDO},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 401
    assert ia_vigilada == []


def test_token_con_firma_falsa_se_rechaza(ia_vigilada):
    otra_clave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = crear_token(otra_clave)  # firmado con una clave que no es la de Clerk
    r = client.post(
        "/api/generar",
        json={"texto": TEXTO_VALIDO},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 401
    assert ia_vigilada == []


def test_token_de_otro_origen_se_rechaza(clave_privada, ia_vigilada):
    token = crear_token(clave_privada, azp="https://sitio-ajeno.example")
    r = client.post(
        "/api/generar",
        json={"texto": TEXTO_VALIDO},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 401
    assert ia_vigilada == []
