/**
 * A piece of an article's body, in reading order. Text may use **bold** and
 * [links](https://…); nothing else is parsed.
 */
export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  /** A line pulled from the text and shown large beside it. */
  | { type: "quote"; text: string; cite?: string }
  | {
      type: "figure";
      src: string;
      alt: string;
      caption?: string;
      /** "wide" breaks out of the text column, like the lead image;
          "narrow" keeps portrait photos from filling the screen. */
      size?: "narrow" | "text" | "wide";
    };

export type Article = {
  slug: string;
  /** A small label above the title, e.g. the section or the kind of text. */
  kicker?: string;
  title: string;
  deck?: string;
  author: string;
  /** ISO date, e.g. "2026-02-22". */
  date: string;
  /** Where the text first appeared, when it was published elsewhere. */
  source?: { name: string; url: string };
  lead?: { src: string; alt: string; caption?: string };
  body: ArticleBlock[];
};

// The photos, copied from the Wanda post.
const IMAGES = "/assets/articles/cadernin-wanda";

export const articles: Article[] = [
  {
    slug: "do-xerox-ao-codigo-aberto",
    kicker: "Na imprensa",
    title: "Do xerox ao código aberto: o cadernin do sopro no Carnaval de BH",
    deck: "Produzido coletivamente desde 2013, o cadernin conecta diferentes gerações dos blocos da cidade",
    author: "Bruna Batista",
    date: "2026-02-22",
    source: {
      name: "Revista Wanda #32",
      url: "https://revistawanda.substack.com/p/wanda-32-cadernin-e-siriara",
    },
    body: [
      {
        type: "figure",
        src: `${IMAGES}/partitura-se-ta-solteira.jpg`,
        alt: "Caderninho aberto na partitura de “Se tá Solteira”.",
        caption:
          "Partitura da canção “Se tá Solteira”, sucesso do rapper belorizontino FBC. Foto: Carlos Hauck (@carloshauck).",
        size: "narrow",
      },
      {
        type: "paragraph",
        text: "No Carnaval, existem dois conceitos de bloco: os abertos e os fechados. Nos blocos fechados, a banda é restrita para quem participou dos ensaios antes do cortejo oficial. Isso significa que você não pode só chegar com seu instrumento. Quem permite essa participação são os blocos abertos, em que qualquer pessoa pode chegar com seu instrumento ou perna de pau e participar do cortejo como parte da banda. Em alguns, pode ser que só a bateria seja aberta, ou somente a ala de sopro, ou a ala das pernas de pau.",
      },
      {
        type: "paragraph",
        text: "Se você frequentou algum bloco aberto em BH, com certeza ouviu alguém gritando um número para o resto da banda e viu que praticamente toda a ala do sopro pegou um caderninho e mudou a página para a partitura daquele número.",
      },
      {
        type: "paragraph",
        text: "Esse é o cadernin, uma produção coletiva que circula há anos na cidade. Ele nasce da insistência de um grupo de músicos, a maioria amadores, que, ano após ano, se recusavam a aceitar que a alegria das ruas dependesse apenas de improviso e memorização. A história remonta a 2013, quando Henrique Stanio (@henrique.stanio) e Ygor Rajão (@ygorrajao) adaptaram um suporte de partitura usando arame de cabide para tocar em um casamento. O “gancho” na espiral do caderno virou padrão.",
      },
      {
        type: "paragraph",
        text: "“O caderninho do carnaval de rua surgiu em 2013”, conta Emanuel Vianna (@emanuelvianna), um dos responsáveis pela produção desde 2020. Antes, tudo era feito de forma artesanal. As partituras eram garimpadas, adaptadas e copiadas como dava. “No começo era isso mesmo: o pessoal conseguia as partituras e ia tirando xerox.”",
      },
      {
        type: "figure",
        src: `${IMAGES}/ensaio-2013.jpg`,
        alt: "Músicos de sopro tocando com o caderninho em um dos primeiros ensaios, em 2013.",
        caption:
          "Um dos primeiros ensaios com o cadernin! Lá em 2013. Foto cedida pela equipe do Cadernin, mas com autoria desconhecida.",
        size: "narrow",
      },
      {
        type: "paragraph",
        text: "O Guto Borges (@gutoborges), Vitor Silva (@jonasaxvitor), Bruna Martins (@brunamartins), João Paulo Prazeres (@prazeresemusica) e Bruno Leão (@brunoschuchleao) ajudavam nesse garimpo e tiravam dinheiro do próprio bolso para imprimir as poucas cópias que chegavam em caixas direto para o bloco do Mamá na Vaca.",
      },
      {
        type: "paragraph",
        text: "Com o tempo, o processo foi se sofisticando, mas nunca deixou de ser trabalhoso. “Todo ano, por mais de dez anos, era uma correria pra fazer esse caderninho. E todo ano a gente pensava: tem um jeito melhor de fazer isso.”",
      },
      { type: "heading", text: "Como o Carnaval, da coletividade" },
      {
        type: "paragraph",
        text: "O projeto sempre teve uma base coletiva. Um grupo que muda, se renova, mas continua segurando a estrutura. “Entra gente, sai gente, e o projeto segue”, resume. As músicas passaram a ser escritas no computador, revisadas com cuidado e adaptadas para diferentes instrumentos.",
      },
      {
        type: "quote",
        text: "Entra gente, sai gente, e o projeto segue.",
        cite: "Emanuel Vianna",
      },
      {
        type: "paragraph",
        text: "Depois veio o chamado “pirata”, uma notação pensada especialmente para os instrumentos de sopro. “É parecido com uma tablatura de violão, só que para trompete e trombone”, explica. Essa inovação ganhou força em 2018, inspirada pela necessidade de músicos como Daniel Mota, que anotavam as posições do instrumento “na munheca” para conseguir tocar o repertório mais rápido. Ainda, foi o Pedro Fonseca (@pedro.h.fs) que descobriu uma ferramenta que auxiliou no processo, um plugin do Musescore, software livre de edição de partituras, que automatizou a escrita do pirata.",
      },
      {
        type: "paragraph",
        text: "A virada acontece a partir de 2020, quando essa inquietação antiga começa a se transformar em ferramenta. “Foi um encontro de malucos que tinham o mesmo sonho”, brinca, ao falar da criação do cadern.in. A ideia do site começou com o Emanuel Vianna, o Gustavo Brunoro, o Gabriel Fonseca e o Daniel Bastos. Depois, foram chegando mais pessoas e hoje são cerca de 10, cada um ajudando onde pode.",
      },
      {
        type: "paragraph",
        text: "A ideia era clara: automatizar o que sempre consumiu tempo e energia demais de menos gente. O site nasce como desdobramento direto do caderninho físico, mas com a ambição de aumentar o alcance e o compartilhamento. Como explicou Guto Borges (@gutoborges), o objetivo era formar uma geração de músicos de rua em vez de apenas contratar quem já sabia tocar.",
      },
      {
        type: "paragraph",
        text: "“O cadern.in ajudou demais na nossa vida”, conta Emanuel. A plataforma passou a cuidar da automação dos piratas, da formatação das partituras, da diagramação dos PDFs, da capa e da distribuição. Hoje, com mais de mil músicas processadas, qualquer pessoa pode montar seu próprio caderno, escolhendo repertório e ordem. Tudo isso de forma aberta: o sistema é software livre e pode ser acessado e aprimorado por quem quiser, [no GitHub](https://github.com/soprodecarnaval/musicoteca).",
      },
      {
        type: "paragraph",
        text: "Mesmo com a tecnologia facilitando os bastidores, o caderninho físico continua sendo central. Distribuído gratuitamente para os músicos, em 2026, a campanha do Sopro de Carnaval (@soprodecarnaval), liderada por Alexandre Planta (@alexandreplanta), mobilizou novamente trabalho voluntário e apoio coletivo para garantir que ele chegasse aos cortejos.",
      },
      {
        type: "paragraph",
        text: "A capa de 2025 foi feita pela Bel Pozes (@bel.studio), em 2026 foi feita pela Maria Thereza (@mariatmorais). A impressão contou com o suporte da Prefeitura de Belo Horizonte, enquanto a encadernação e a logística foram viabilizadas por doações individuais. “O Carnaval de BH é feito de resistência, e a produção do nosso caderninho não é diferente.”",
      },
      {
        type: "figure",
        src: `${IMAGES}/tiragem-2026.jpg`,
        alt: "Pilha de caderninhos impressos com a capa ilustrada de 2026.",
        caption:
          "Parte da tiragem desse ano do cadernin, com capa ilustrada e tudo. Foto: Carlos Hauck (@carloshauck).",
        size: "text",
      },
      {
        type: "paragraph",
        text: "**O cadernin, assim como todo o carnaval de BH, é marcado pela insistência de quem acredita na festa de rua acima de qualquer dificuldade ou impedimento.** “Hoje qualquer pessoa pode ir lá e montar o seu caderninho”, diz Emanuel.",
      },
      {
        type: "paragraph",
        text: "Se precisar, pede pix, faz vaquinha, encontra parcerias. Tudo isso pensando também em manter a ideia viva e facilitar a participação de quem chega agora, mantendo vivo um repertório coletivo e fazendo com que a música circule tão livremente quanto o Carnaval em que está inserida.",
      },
      {
        type: "heading",
        text: "E o que acontece com a versão impressa do cadernin quando chove?",
      },
      {
        type: "figure",
        src: `${IMAGES}/cadernin-na-chuva.jpg`,
        alt: "Caderninho molhado de chuva.",
        caption:
          "Vocês entenderam, né? Foto feita pela musa do trombone, Ale Godinho (@alegodim).",
        size: "narrow",
      },
      {
        type: "paragraph",
        text: "No pré-carnaval de 2026, mesmo enfrentando temporais, o grupo conseguiu rodar uma segunda tiragem e ultrapassar a marca de 600 exemplares distribuídos.",
      },
    ],
  },
];

/** How an article shows in a list: on the home page and under an article. */
export type ArticleCard = {
  title: string;
  summary: string;
  href: string;
  imageUrl?: string;
  /** Width descriptors for `imageUrl`, when variants exist. */
  imageSrcSet?: string;
};

export function articlePath(article: Article): string {
  return `/artigos/${article.slug}`;
}

// Placeholders until the articles are written: their pages don't exist yet.
// Without an `imageUrl` the image area shows as a grey box. The first two
// are shown; the section hides itself if this list is empty.
const placeholderCards: ArticleCard[] = [
  {
    title: "Como montar o caderninho do seu bloco",
    summary:
      "Um passo a passo da busca de partituras até o PDF pronto para imprimir e levar para a rua.",
    href: "/artigos/como-montar-o-caderninho",
    imageUrl: "/assets/articles/cadernos-impressos-1234.webp",
    imageSrcSet:
      "/assets/articles/cadernos-impressos-360.webp 360w, /assets/articles/cadernos-impressos-670.webp 670w, /assets/articles/cadernos-impressos-1234.webp 1234w",
  },
  {
    title: "Formatando partituras com a extensão para Musescore",
    summary:
      "Como deixar suas partituras no padrão do cadern.in antes de enviá-las para o acervo.",
    href: "/artigos/extensao-musescore",
    // The source photo is 933px wide; the variants stop there on purpose.
    imageUrl: "/assets/articles/trombone-na-rua-933.webp",
    imageSrcSet:
      "/assets/articles/trombone-na-rua-360.webp 360w, /assets/articles/trombone-na-rua-670.webp 670w, /assets/articles/trombone-na-rua-933.webp 933w",
  },
];

/** Written articles first, then the placeholders. */
export const articleCards: ArticleCard[] = [
  ...articles.map((article) => ({
    title: article.title,
    summary: article.deck ?? "",
    href: articlePath(article),
    imageUrl: article.lead?.src ?? firstImage(article),
  })),
  ...placeholderCards,
];

function firstImage(article: Article): string | undefined {
  for (const block of article.body) {
    if (block.type === "figure") {
      return block.src;
    }
  }
  return undefined;
}

export function findArticle(slug: string | undefined): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
