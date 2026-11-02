# Cadern.in - Musicoteca

## Objetivo
Ser a plataforma open source onde fanfarras contribuem com suas partituras testadas, conectando músicos para democratizar a música de rua.

**Acesse:** https://cadern.in

## O Problema e Solução

Hoje, ter acesso a partituras adequadas para fanfarras não é fácil. A maioria das partituras online são complexas demais - feitas para orquestras ou com inúmeras vozes - e não funcionam bem nas ruas. Fanfarras precisam de partituras simples, diretas e testadas em apresentações reais.

O Cadern.in resolve esse problema conectando músicos para permitir o intercâmbio de partituras, criando um acervo compartilhado crescente com manutenção distribuída pela comunidade.

## Características Principais

- **Geração de caderninhos** personalizados por instrumento
- **Busca e descoberta** de músicas por projeto, instrumento e estilo
- **Reprodução MIDI** para facilitar compreensão do arranjo
- **Download de partituras** em formato MuseScore (.mscz) ou PDF
- **Sistema de contribuição** via GitHub Issues e Pull Requests

## Público-Alvo

### Primário: Band Leaders
**Por quê:** Eles definem repertório, adicionam novas músicas, garantem qualidade e precisam exportar caderninhos rápido.

### Secundários:

**Fanfarrões novatos**
- Precisam onboarding rápido: encontrar a parte certa e praticar (PDF/MIDI).

**Fanfarrões experientes**
- Precisam achar e tocar suas partes com facilidade.

**Arranjadores**
- Enviam, atualizam e testam as partituras e mantêm o acervo vivo.

**Organizadores de Blocos**
- Curam o acervo do grupo e solicitam novas músicas que façam sentido para rua.

## Tecnologias

- **Frontend:** React + TypeScript + Vite
- **UI:** Bootstrap + React Bootstrap
- **Busca:** Fuse.js
- **PDF:** PDFKit
- **MIDI:** midi-player-js + soundfont-player
- **Arquivos:** MuseScore (.mscz), PDF, MIDI, SVG

## Como Contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para instruções detalhadas sobre como contribuir com o projeto.

### Contribuindo com Músicas

1. Abra uma [Issue de Solicitação de Música](.github/ISSUE_TEMPLATE/song_request.md)
2. Preencha todas as informações solicitadas
3. Aguarde a revisão e aprovação da issue
4. Crie (você ou outro contribuidor) uma Pull Request com os arquivos necessários 
5. Aguarde a validação e aprovação da PR por outro contribuidor
6. Após merge, a música estará disponível na plataforma

## Estrutura do Projeto

```
musicoteca/
├── public/collection/     # Acervo de músicas organizadas por projeto
├── src/                  # Código fonte da aplicação
├── scripts/              # Scripts de manutenção e migração
└── dist/                 # Build de produção
```

Veja [scripts/README.md](scripts/README.md) para os scripts organizados por finalidade.

## Quick Start

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Build para produção
npm run build
```

## Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.
