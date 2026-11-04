## Docker

Un único contenedor sirve el frontend (React compilado) y el backend (FastAPI) en el puerto 8000.

### Construir la imagen

La clave pública de Clerk se incrusta al compilar el frontend, por eso se pasa como `--build-arg`
(no es un secreto). Los secretos **nunca** se pasan al construir.

```bash
docker build \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXX \
  -t generador:v0.5-docker .
```

### Ejecutar

Las variables se inyectan al ejecutar con un archivo privado (excluido de Git por `.gitignore`):

```bash
cp .env.example .env.docker      # edita: AI_API_KEY real, CLERK_JWKS_URL, CLERK_AUTHORIZED_PARTIES
docker run -d --name generador --restart unless-stopped \
  --env-file .env.docker -p 8000:8000 generador:v0.5-docker
```

`CLERK_AUTHORIZED_PARTIES` debe ser el origen exacto desde el que abres la app
(en local: `http://localhost:8000`).

### Operar

| Acción | Comando |
| --- | --- |
| Estado (muestra `healthy`) | `docker ps` |
| Logs | `docker logs -f generador` |
| Parar / iniciar / reiniciar | `docker stop generador` / `docker start generador` / `docker restart generador` |
| Comprobar salud | `curl http://localhost:8000/api/health` |
| Rechazo sin token | `curl -i -X POST http://localhost:8000/api/generar -H "Content-Type: application/json" -d '{"texto":"texto de prueba de más de veinte caracteres"}'` → `401` |

## AWS (EC2 con Docker)

- **Región:** _(anótala, p. ej. eu-west-3 París)_
- **Sistema:** Amazon Linux 2023 · **Tipo:** `t3.small` (2 GB; con 1 GB la compilación del frontend puede quedarse sin memoria)
- **URL final:** `http://IP_PUBLICA` · **Versión desplegada:** `v1.0-aws` (commit `____`)

### 1. Crear la instancia (consola de AWS → EC2 → Launch instance)

1. AMI: Amazon Linux 2023. Tipo: `t3.small`.
2. Key pair: crea uno nuevo (`.pem`), guárdalo fuera del repositorio y en Linux/Mac `chmod 400 clave.pem`.
3. Security Group nuevo con **solo** estas reglas de entrada:

| Tipo | Protocolo | Puerto | Origen | Para qué |
| --- | --- | --- | --- | --- |
| SSH | TCP | 22 | **My IP** | Administración (nunca 0.0.0.0/0) |
| HTTP | TCP | 80 | 0.0.0.0/0 _(o las IP de la demo)_ | Acceso web a la app |

   No se abre el 8000 (el contenedor se publica en el 80) ni el puerto del demonio de Docker (2375/2376).
4. Almacenamiento: 8–16 GB es suficiente.

### 2. Conectar e instalar Docker

```bash
ssh -i clave.pem ec2-user@IP_PUBLICA
sudo dnf install -y docker git
sudo systemctl enable --now docker          # arranca también al reiniciar la instancia
sudo usermod -aG docker ec2-user && exit    # sal y vuelve a entrar para aplicar el grupo
docker run --rm hello-world                 # comprueba que Docker funciona
```

### 3. Obtener el código en la versión correcta y construir

```bash
git clone https://github.com/USUARIO/REPOSITORIO.git && cd REPOSITORIO
git checkout v1.0-aws                       # el tag que corresponde al despliegue
docker build --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXX -t generador:v1.0-aws .
```

### 4. Variables de entorno (archivo privado, fuera de Git)

```bash
nano ~/.env.prod && chmod 600 ~/.env.prod   # solo lo puede leer tu usuario
```

Contenido (valores reales solo aquí, nunca en el repositorio):

```
AI_API_KEY=...
AI_MODEL=...
CLERK_JWKS_URL=https://TU-INSTANCIA.clerk.accounts.dev/.well-known/jwks.json
CLERK_AUTHORIZED_PARTIES=http://IP_PUBLICA
```

### 5. Ejecutar un único contenedor

```bash
docker run -d --name generador --restart unless-stopped \
  --env-file ~/.env.prod -p 80:8000 generador:v1.0-aws
```

`--restart unless-stopped` lo levanta de nuevo tras un reinicio de la instancia o un fallo.

### 6. Verificar

- Desde fuera de EC2: `http://IP_PUBLICA` → inicia sesión → genera preguntas.
- `curl -i http://IP_PUBLICA/api/health` → `200`.
- Sin token: `curl -i -X POST http://IP_PUBLICA/api/generar -H "Content-Type: application/json" -d '{"texto":"texto de prueba de más de veinte caracteres"}'` → `401`.
- Estado y logs: `docker ps`, `docker logs generador`.
- Reinicio: `docker restart generador` y volver a comprobar la web.

### 7. Actualizar a una nueva versión

```bash
cd ~/REPOSITORIO && git fetch --tags && git checkout v1.1
docker build --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXX -t generador:v1.1 .
docker stop generador && docker rm generador
docker run -d --name generador --restart unless-stopped \
  --env-file ~/.env.prod -p 80:8000 generador:v1.1
```

### Limitaciones y gestión de recursos

- **HTTP sin cifrar:** en EC2 las sesiones y peticiones viajan sin cifrar. Es un entorno docente:
  solo cuentas y datos de prueba.
- **La IP pública cambia** al detener y arrancar la instancia: hay que actualizar
  `CLERK_AUTHORIZED_PARTIES` en `~/.env.prod`, y recrear el contenedor (`docker rm` + `docker run`;
  `docker restart` no relee el archivo de variables).
- **Al terminar la evaluación:** terminar (Terminate) la instancia, borrar el volumen EBS asociado,
  liberar cualquier Elastic IP y eliminar el key pair y el Security Group si ya no se usan.

### Evidencias a guardar (sin secretos)

| Evidencia | Qué demuestra |
| --- | --- |
| Captura de la instancia EC2 (ID, tipo, SO, estado, región) | Instancia Linux en ejecución |
| Captura de las reglas de entrada del Security Group | Solo 22 (mi IP) y 80 abiertos |
| `docker --version` y `docker ps` en EC2 | Docker instalado y un único contenedor `healthy` |
| `docker logs generador` revisado | Servicio arrancado, sin datos sensibles |
| Navegador con `http://IP_PUBLICA` y respuesta de IA | Acceso externo y IA real |
| `curl` sin token → 401 | Autenticación validada en backend también en AWS |
| `docker restart` + web funcionando | Reinicio verificado |

## Problemas y soluciones

_(Rellena solo con incidencias reales: síntoma → diagnóstico → solución → comprobación.)_
