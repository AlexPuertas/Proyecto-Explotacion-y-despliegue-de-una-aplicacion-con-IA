import index
import pytest
from fastapi.testclient import TestClient

client = TestClient(index.app)

TEXTO_VALIDO = "La fotosíntesis es el proceso por el que las plantas convierten luz en energía química."


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_generar_entrada_valida(monkeypatch):
    async def falso(texto, n):
        return ["¿Qué es la fotosíntesis?", "¿Dónde ocurre?"]

    monkeypatch.setattr(index, "llamar_proveedor", falso)
    r = client.post("/api/generar", json={"texto": TEXTO_VALIDO, "num_preguntas": 2})
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
def test_generar_entrada_incorrecta(cuerpo):
    r = client.post("/api/generar", json=cuerpo)
    assert r.status_code == 422


@pytest.mark.parametrize("codigo", [502, 504])
def test_generar_error_del_proveedor(monkeypatch, codigo):
    async def falla(texto, n):
        raise index.ProviderError("La IA devolvió un error", status_code=codigo)

    monkeypatch.setattr(index, "llamar_proveedor", falla)
    r = client.post("/api/generar", json={"texto": TEXTO_VALIDO})
    assert r.status_code == codigo
    assert r.json() == {"detail": "La IA devolvió un error"}