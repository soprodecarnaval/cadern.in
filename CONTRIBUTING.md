# Contribuindo

## Política de Idioma
- **Código**: Variáveis, funções, comentários e estrutura do código devem estar em inglês
- **Documentação**: README, CONTRIBUTING, issues, PRs e discussões técnicas em português brasileiro
- **Solicitações de música**: Podem ser em português ou outros idiomas para facilitar que mais pessoas ajudem com issues relacionadas a músicas

## Código de Conduta
- Seja respeitoso e construtivo em todas as interações
- Foque no que é melhor para a comunidade
- Mantenha discussões técnicas e relevantes ao projeto

## Como contribuir com partituras

### 1. Formatando a partitura
- Baixe a última versão do plugin [aqui](cadern.in/plugin).
- Habilite o plugin e abra a partitura.
- Se a partitura não tiver partes criadas (aparecem abas com o nome dos instrumentos), clique em `Arquivos -> Partes -> Todas as Partes -> Ok`
- Com o plugin aberto, habilite `Apply to all parts`
- Pressione os botões de 1 a 3 do plugin (`Clean fingering`, `Clean text boxes` e `Set style`)
- **Desmarque a opção `Apply to all parts`**, as próximas funções podem travar o computador se forem aplicadas a todas as partes de uma vez.
- Abra as partes (abas) uma a uma e execute as funções 4 e 5 (`Adjust scale` e `Leading space`)

### 2. Ajustando o dedilhado
- Nas partes de trompete e trombone, execute a função 6 `Add fingering`, muito provavelmente aparecerá uma segunda página.
- Clique em `Leading space` para tentar voltar a uma página apenas (necessário para o caderninho).
- Esse ponto necessita de cuidado individual, alterne entre os botões `Leading space`, `Adust scale` e mude o valor de `Fingering size` para ajustar a partitura. A partitura deve ficar em apenas 1 página, com o dedilhado disposto de forma coerente acima das claves (caso os números estejam encavalando diminua o valor em `Fingering size`, 11 ou 12 costumam ser valores adequados).
- Se necessário faça ajustes manual na parte para caber todos os elementos e facilitar a leitura.

### 3. Adicionando os metadados
- Clique na primeira aba (com a partitura completa)
- Vá em `Arquivo -> Propriedades da Partitura`
- Preencha os seguintes campos (extraímos apenas esses da partitura para usar no caderninho):
  - Composer: compositor ou banda da música
  - Lyricist: estilo da música (ex. pagode, samba, axé, ...)
  - Source: trecho da letra (Deve ser curto e todo em maiúscula)
  - workTitle: título da música todo em maiúsculas
 
### 4. Conferindo a partitura
- Após finalizada a formatação salve o arquivo, feche-o e abra novamente
  - Confira se todas as partes continuam com apenas 1 página
  - Confira se os dedilhados estão aparecendo da forma esperada
  - Confira se todas as partes estão sem títulos e textos

### 5. Enviando a partitura
- Nomeie o arquivo em letras maiúsculas sem espaços (substitua os espaços por `_`) e coloque em uma pasta de mesmo nome, dentro de umas das coleções no caminho `public/collection`
- Suba em um branch a modificação e faça um PR para o branch main
- Uma action será executada automaticamente com a criação do PR
- Aguarde a action rodar pois ela adicionará diversos arquivos ao seu PR (com as partituras e metadados)
- Faça o merge e execute a action de deploy para publicar a partitura.

### 6. Corrigindo possíveis problemas
- **A partitura em MusicXML abriu sem as partes**
  - Cria as partes clicando em `Arquivos -> Partes -> Todas as Partes -> Ok`
- **Após formatar, salvar, fechar e abrir o arquivo alguma parte apareceu com 2 páginas**
  - Use os botões `Adjust scale` e `Leading spaces` para fazer a partitura voltar a 1 página.
  - Salve, feche e reabra o arquivo até ter certeza que todas as partes estão em apenas 1 página.
- **Algum instrumento não está pegando dedilhado**
  - Adicione o instrumento correto com sua respectiva parte.
  - Copie a partitura da parte com problema e cole no novo intrumento.
  - Tente adicionar o dedilhado novamente nessa nova parte.

## Como Contribuir com código

### 1. Setup Inicial
- Fork o repositório: [musicoteca](https://github.com/SEU-USUARIO/musicoteca)
- Clone seu fork: `git clone https://github.com/SEU-USUARIO/musicoteca.git`
- Instale dependências: `npm install`
- Execute o projeto: `npm run dev`

### 2. Criando Issues
**SEMPRE** crie uma issue antes de codificar. Use os templates apropriados:

- **🐛 Bugs**: [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)
- **✨ Features**: [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)
- **📚 Documentação**: [Documentation Request](.github/ISSUE_TEMPLATE/docs_request.md)
- **🎵 Músicas**: [Song Request](.github/ISSUE_TEMPLATE/song_request.md)

### 3. Desenvolvimento
- **Branches**: `feature/<número-da-issue>-título-curto`, `fix/<número-da-issue>-título-curto`, `song/<número-da-issue>-título-curto` ou `docs/<número-da-issue>-título-curto`
- **Commits**: Use mensagens claras e descritivas
- **PRs**: Mantenha pequenos e focados em uma única issue

### 4. Pull Requests
- Vincule a issue: "Fixes #<número-da-issue>"
- Adicione notas de teste e screenshots se necessário
- Uma aprovação é suficiente

**Convenções de título de PR:**
- `feat:` Resumo curto da feature
- `fix:` Resumo curto da correção  
- `song:` {Adicionar/Atualizar/Remover} "TÍTULO" - nota opcional
- `docs:` Resumo curto das mudanças na documentação

## Projeto GitHub
- Quadro único usando Status: `Sem status` (triagem) → `Backlog` → `Em Progresso` → `Concluído`.
- Novas issues são adicionadas automaticamente ao quadro e ficam em `Sem status` (tratamos isso como "Precisa de triagem").
- Durante a triagem, verifique que:
  - A issue está bem explicada e facilmente compreensível
  - Há recursos suficientes para ser executável por outra pessoa sem ajuda externa do autor
  - Se atende aos requisitos para qualquer versão planejada, aplique o rótulo de versão respectivo; se não, apenas mova para Backlog para uma possível versão futura
- Quando começar o trabalho, mova a issue para `Em Progresso` (ou abra um PR vinculado; automação pode movê-la).
- Quando o PR vinculado for mesclado OU a issue for fechada, a automação define o Status como `Concluído`.
- Sempre referencie a issue no PR (use "Fixes #<número-da-issue>") para que ela feche automaticamente na mesclagem.

## Releases e Rótulos de Versão
- As versões principais por enquanto são baseadas no carnaval (ex: `carnaval-2025`, `carnaval-2024`).
- Aplique o rótulo de versão apropriado se a issue se qualificar para essa release.
- Issues sem rótulos de versão permanecem no Backlog para consideração futura.

## Desenvolvimento Local
- Execute o app e faça uma verificação rápida de sanidade.
- Se possível, execute `npm run lint` e `npm run build` antes de abrir o PR.
