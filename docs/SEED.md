# Seed a partir de uma pasta local

Script para popular o banco de dados e o storage do cadern.in a partir de uma pasta local contendo arquivos `.mscz` organizados por projeto e música.

## Pré-requisitos

- **MuseScore 3** instalado e acessível via `mscore` no PATH, ou em `/Applications/MuseScore 3.app` (macOS)
- **Firebase CLI** autenticado com credenciais de aplicação padrão:
  ```bash
  gcloud auth application-default login
  ```
  Alternativamente, defina `GOOGLE_APPLICATION_CREDENTIALS` apontando para um arquivo de chave de conta de serviço.
- Arquivo `.env.local` na raiz do projeto com as seguintes variáveis:
  ```
  CADERN_IN_UID=<uid do usuário no Firebase>
  STORAGE_BUCKET=<nome do bucket no Cloud Storage>
  ```

## Estrutura de pastas esperada

```
<pasta-de-entrada>/
  <projeto>/
    <música>/
      <música>.mscz
```

Exemplo:

```
colecao/
  carnaval-bh-2024/
    abertura/
      abertura.mscz
    marchinha-do-adeus/
      marchinha-do-adeus.mscz
  ensaios-2025/
    nova-musica/
      nova-musica.mscz
```

## Uso

```bash
npm run seed -- --input <pasta-de-entrada> [opções]
```

### Opções

| Opção | Descrição |
|---|---|
| `--input <pasta>` | Pasta raiz da coleção com arquivos `.mscz` **(obrigatório)** |
| `--output <pasta>` | Pasta de saída para os assets indexados (padrão: diretório temporário) |
| `--force` | Re-exportar todos os assets, mesmo que já existam |
| `--clean` | Remover docs e arquivos órfãos do Firebase ao final do processo |

### Exemplos

Seed completo a partir da pasta `colecao/`:

```bash
npm run seed -- --input ./colecao
```

Forçar re-exportação de todos os assets:

```bash
npm run seed -- --input ./colecao --force
```

Usar pasta de saída específica e limpar órfãos do Firebase:

```bash
npm run seed -- --input ./colecao --output ./public/collection --clean
```

## Pipeline

O script executa três etapas em sequência:

### Etapa 1 — Exportar assets

Para cada arquivo `.mscz` encontrado na coleção, o MuseScore gera:

- `*.svg` — páginas da partitura (uma por página, com sufixo `_1`, `_2`, etc.)
- `*.midi` — áudio MIDI da partitura completa e de cada parte
- `*.metajson` — metadados exportados pelo MuseScore (compositor, fonte, tags)

Assets já existentes são ignorados por padrão; use `--force` para re-exportar.

### Etapa 2 — Indexar coleção

Lê os assets gerados, valida a estrutura de cada música e copia tudo para a pasta de saída, gerando o arquivo `collection.json` com o índice completo da coleção.

Músicas com erros de validação são omitidas da coleção. Os avisos são gravados em `warnings.json` na pasta de saída.

### Etapa 3 — Upload para o Firebase

Para cada música na coleção:

- Faz upload dos arquivos para o **Cloud Storage** em `songs/<id>/<revisão>/`
- Cria ou atualiza os documentos no **Firestore** (`projects/`, `songs/`, `songs/*/revisions/`)

Músicas cujos assets já estão no storage são ignoradas. Use `--force` junto com `--clean` para reenviar tudo do zero.

## Exportar um único arquivo .mscz

Para exportar os assets de um único arquivo `.mscz` sem subir para o Firebase:

```bash
npm run export:mscz -- <arquivo.mscz> [--force]
```

Os arquivos são gerados na mesma pasta do `.mscz`.
