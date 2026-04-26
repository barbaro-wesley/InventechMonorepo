# OCR Worker — Adição ao Deploy de Produção

## Problema Atual

O `ocr-worker` foi implementado e testado localmente, porém **não está Included no deploy** para produção:

| Item | Status |
|------|--------|
| `docker-compose.prod.yml` | ❌ Não tem serviço `ocr-worker` |
| CI/CD (deploy-test.yml) | ❌ Só builda `api` e `web` |
| Volume `/srv/scans/incoming` | ❌ Não existe no compose de produção |

---

## Alterações Necessárias

### 1. docker-compose.prod.yml

Adicionar serviço `ocr-worker`:

```yaml
ocr-worker:
  image: ghcr.io/${GITHUB_REPOSITORY_LOWER}/ocr-worker:${IMAGE_TAG:-latest}
  container_name: inventech_ocr_worker
  restart: unless-stopped
  environment:
    POSTGRES_DSN: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    MINIO_ENDPOINT: minio:9000
    MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
    MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
    MINIO_USE_SSL: "false"
    MINIO_BUCKET: scans
    SFTP_SCAN_BASE_DIR: /srv/scans/incoming
    OCR_LANG: por
    OCR_DPI: "300"
  volumes:
    - sftp_scans:/srv/scans/incoming
  depends_on:
    postgres:
      condition: service_healthy
    minio:
      condition: service_healthy
  networks:
    - inventech_network
  healthcheck:
    test: ["CMD", "pgrep", "ocr-worker"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
  logging:
    driver: json-file
    options:
      max-size: "5m"
      max-file: "3"
```

Adicionar volume:

```yaml
volumes:
  sftp_scans:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /srv/scans/incoming
```

### 2. CI/CD — deploy-test.yml

#### 2.1 Adicionar job de build para ocr-worker

```yaml
build-ocr-worker:
  name: Build OCR Worker (develop)
  runs-on: ubuntu-latest
  needs: lint
  
  steps:
    - uses: actions/checkout@v4
    - uses: docker/setup-buildx-action@v3
    - uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - run: |
        REPO_LOWER=$(echo '${{ github.repository }}' | tr '[:upper:]' '[:lower:]')
        echo "REPO_LOWER=$REPO_LOWER" >> $GITHUB_ENV
    
    - uses: docker/build-push-action@v6
      with:
        context: .
        file: services/ocr-worker/Dockerfile
        push: true
        tags: |
          ghcr.io/${{ env.REPO_LOWER }}/ocr-worker:develop
          ghcr.io/${{ env.REPO_LOWER }}/ocr-worker:develop-${{ github.sha }}
        cache-from: type=gha,scope=ocr-worker-develop
        cache-to: type=gha,mode=max,scope=ocr-worker-develop
```

#### 2.2 Atualizar job deploy

No passo de Pull, adicionar `ocr-worker`:

```yaml
IMAGE_TAG=develop GITHUB_REPOSITORY_LOWER=$REPO_LOWER \
  docker compose -f docker-compose.prod.yml --env-file .env pull api web ocr-worker
```

No passo de Up, adicionar o worker:

```yaml
IMAGE_TAG=develop GITHUB_REPOSITORY_LOWER=$REPO_LOWER \
  docker compose -f docker-compose.prod.yml --env-file .env \
  up -d --no-build --remove-orphans
```

### 3. Infraestrutura (pré-requisito do servidor)

Garantir que o diretório exista:

```bash
# No servidor (uma vez)
sudo mkdir -p /srv/scans/incoming
sudo chown 1000:1000 /srv/scans/incoming  # user do container
```

---

## Checklist de Implementação

- [ ] Adicionar `ocr-worker` no `docker-compose.prod.yml`
- [ ] Adicionar volume `sftp_scans` no `docker-compose.prod.yml`
- [ ] Adicionar job `build-ocr-worker` no `deploy-test.yml`
- [ ] Atualizar passo `pull` no job deploy para incluir `ocr-worker`
- [ ] Criar diretório `/srv/scans/incoming` no servidor (manual)
- [ ] Testar deploy na VM de desenvolvimento
- [ ] Verificar healthcheck do worker

---

## Após o Deploy

Para testar funcionalmente:

```bash
# 1. Verificar se está rodando
docker ps | grep ocr-worker
docker logs inventech_ocr_worker

# 2. Cadastrar uma impressora (via API)
curl -X POST http://localhost:3000/api/v1/printers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste Scanner",
    "ipAddress": "192.168.1.100",
    "sftpDirectory": "scanner-teste",
    "companyId": "<COMPANY_ID>"
  }'

# 3. Copiar PDF de teste
cp teste.pdf /srv/scans/incoming/scanner-teste/

# 4. Verificar resultado no banco
docker exec inventech_postgres psql -U inventech -c "SELECT * FROM scans;"
```