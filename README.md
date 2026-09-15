# Diário de Estudos — v5.0

Plataforma pessoal de planejamento, revisão e análise de estudos. Roda inteiramente no seu navegador: sem conta, sem servidor, sem rede.

O ciclo é sempre o mesmo: **planejar → estudar → registrar → revisar → analisar → reajustar**.

## Filosofia

A plataforma é completa, mas não exige que você entenda tudo antes de usar.

Três regras orientam cada decisão de produto:

1. **A ferramenta trabalha para você, não o contrário.** Entre mais configuração e mais facilidade, vence a facilidade.
2. **Nenhuma decisão aparece antes de ser necessária.** Você não precisa definir estratégia de revisão para criar uma disciplina, nem montar um plano para estudar pela primeira vez.
3. **Ensinar acontece no contexto.** Os conceitos são explicados no momento em que aparecem, com exemplo e ação — não num manual que você precisa ler antes.

Na prática: abrir a plataforma, adicionar o que você estuda e iniciar a primeira sessão leva cerca de **quatro decisões**. O resto do sistema — tópicos, revisões, planejamento, análises — aparece conforme seus dados crescem.

---

## O que ela faz

**Hoje** — a tela do dia a dia. Mostra o progresso da semana, qual sessão faz sentido agora (com os motivos da sugestão), as revisões pendentes e as próximas opções.

**Planejamento** — você diz quantas horas tem por semana; o sistema distribui entre as disciplinas respeitando mínimos, prioridade e prazos próximos. A distribuição é totalmente editável. Cada semana guarda seu próprio registro, então mudar o plano hoje não reescreve as metas de semanas passadas.

**Revisões** — todo tópico estudado entra automaticamente num ciclo de revisão espaçada. A tela separa duas perguntas:

- **QUANDO revisar** é a *estratégia*: Adaptativa (padrão, o intervalo responde ao seu resultado), Ciclo programado (1, 3, 7, 14, 30, 60 dias), Intensiva (para provas e prazos) ou Manutenção (intervalos longos).
- **COMO revisar** é o *método*: recordação ativa, exercícios, explicação, resumo de memória, flashcards, prática intercalada ou revisão livre. No modo Automático o Diário sugere um conforme a natureza da disciplina — e sempre explica por quê.

A fila é ordenada por relevância, não só por data: atraso, importância do tópico, domínio baixo, resultado da última revisão, prazos próximos. Os motivos aparecem em texto ("atrasada há 4 dias", "importância alta"); o cálculo interno nunca aparece.

Quando a fila acumula, **Montar sessão de revisão** pergunta quanto tempo você tem e seleciona o que cabe. O resto continua na fila — nada é marcado como concluído sem você revisar.

**Disciplinas** — a estrutura do conteúdo, em três níveis:

```
Área          Tecnologia
  Disciplina    CCNA
    Tópico        IPv4, Subnetting, VLAN, OSPF…
```

Cada tópico tem um status derivado automaticamente: não iniciado → em estudo → em revisão → dominado (e pode regredir, se você esquecer). Também é aqui que ficam os prazos (provas, entregas), que aumentam a prioridade da disciplina.

**Análises** — período flexível (hoje, 7/30 dias, semana, mês, tudo ou intervalo personalizado), comparação com o período anterior, distribuição do tempo, planejado × realizado, cobertura e domínio de conteúdo, dificuldade percebida, tipos de sessão, revisões, relatório semanal e insights automáticos. Tudo calculado localmente, com regras determinísticas — nenhuma IA envolvida. Há um botão para copiar um resumo em texto, caso você queira levar para outro lugar.

**Histórico** — todas as sessões, com busca e filtros por área, disciplina, tópico, período, tipo e dificuldade.

**Primeiro acesso** — duas telas: uma boas-vindas curta e a pergunta "o que você está estudando?". Só isso. Não pede área, prioridade, horas, créditos nem tópicos — tudo recebe padrões que funcionam e pode ser ajustado depois.

**Começar a estudar** — a rota mais curta: o que vai estudar, o assunto (opcional) e quanto tempo. Se a disciplina não existir, é criada na hora; se o assunto não existir, o Diário pergunta uma vez se quer adicioná-lo.

**Seu começo** — na tela Hoje, um guia derivado dos seus dados reais (não há checkbox salvo em lugar nenhum). Cada passo pendente traz a ação que o resolve, o próximo fica destacado, e a ordem não é obrigatória. Pode ser ocultado e some sozinho ao terminar.

**Frase do dia** — uma frase curta sobre estudo na tela Hoje, escolhida localmente. São 420 entradas, sem repetição no mesmo ano e sem repetir em dias seguidos; cada ano gera uma ordem diferente. Pode ser desligada em Configurações.

**Ajuda** — central de ajuda completa dentro do próprio aplicativo: artigos por categoria, exemplos de organização para diferentes tipos de estudo, dúvidas frequentes, glossário e busca local (funciona offline e sem acento). Conceitos como prioridade, importância, estratégia, método, aderência, cobertura e domínio têm um `?` ao lado que explica no hover e abre o artigo ao clicar. Cada tela tem ainda um botão **Ajuda desta tela**.

A Ajuda tem quatro portas: **Como começar** (os passos, com ações prontas), **Usar o Diário** (como a ferramenta funciona), **Aprender a estudar** — uma base curta sobre recuperação ativa, espaçamento, reconhecer × lembrar, exercícios, prática intercalada, explicação, resumos, flashcards, Pomodoro, consistência e descanso. Cada texto começa por uma explicação **em uma frase** e segue o mesmo formato: o que é, por que é útil, como fazer, um exemplo e como isso aparece no Diário — e **Dúvidas frequentes**.

**Ajuda interativa** — conceitos como disciplina, assunto, área, sessão, revisão, planejamento e importância têm uma explicação curta, um exemplo visual e um botão que executa a ação de verdade. A demonstração de revisão deixa você clicar em "lembrei bem" ou "esqueci" e ver o efeito no intervalo; a de planejamento mostra uma divisão sugerida. **Essas demonstrações rodam inteiramente em memória e nunca tocam nos seus dados.**

**Registrar** — o botão global. Ou você inicia o cronômetro (que sobrevive a recarregar e fechar a aba) ou lança a sessão manualmente. No computador há também um **modo foco**, que esconde o resto da interface durante a sessão. Atalho: tecla `R`.

Você não precisa deste README para usar o aplicativo. Ele se explica sozinho.

---

## No computador

- **Ctrl + K** abre a busca de comandos: telas, disciplinas, tópicos, ações e artigos de ajuda, tudo em um só lugar.
- Outros atalhos: `R` registrar, `H` Hoje, `P` Planejamento, `V` Revisões, `A` Análises, `?` Ajuda, `Esc` fecha o que estiver aberto.
- Gráficos, barras de progresso e o calendário revelam detalhes ao passar o mouse ou ao receber foco pelo teclado.
- Detalhes de disciplina e de tópico abrem em painel lateral, mantendo a lista visível.

Nada essencial depende do mouse: tudo continua acessível por clique, toque e teclado. No celular a interface é simplificada, sem os efeitos de hover, mas com todas as funções.

---

## Configurações

- **Aparência** — tema Escuro, Claro ou Sistema (acompanha o sistema operacional em tempo real); densidade Confortável ou Compacta; reduzir animações.
- **Estudos** — durações padrão de sessão e revisão, primeiro dia da semana, período padrão das Análises e tela inicial.
- **Revisões** — estratégia e método padrão, incluir novos tópicos automaticamente no ciclo, mostrar revisões futuras na tela Hoje. Disciplinas e tópicos podem sobrescrever os padrões; quem estiver em "herdar" segue o nível acima.
- **Interface e ajuda** — ajuda contextual Completa, Discreta ou Desativada; explicações ao passar o mouse; frase do dia; reexibir as dicas de primeira visita.
- **Dados e privacidade** — resumo do armazenamento e atalho para backup.
- **Sobre** — versão, contato e novidades da versão.

---

## Créditos e minutos

Cada disciplina tem sua própria regra de crédito (ex.: 20 min = 1 crédito). Créditos continuam existindo para acompanhamento, mas **o planejamento e as análises trabalham em minutos** — 10 créditos de disciplinas diferentes não representam o mesmo esforço.

---

## Privacidade

Tudo fica no **IndexedDB do seu navegador**. Não há backend, login, sincronização, telemetria nem chamadas externas — a política de segurança da página bloqueia conexões de rede (`connect-src 'none'`), e não há fontes, bibliotecas ou scripts de terceiros.

A Central de Ajuda explica isso em linguagem simples, na seção **Dados e privacidade**.

Consequências práticas:

- os dados **não sincronizam** entre dispositivos ou navegadores;
- limpar os dados do site (ou usar aba anônima) apaga o histórico;
- para migrar de máquina ou se proteger, use o backup.

---

## Backup

Em **Dados**:

- **Exportar backup (.json)** — arquivo completo e autossuficiente (áreas, disciplinas, tópicos, sessões, planos, semanas, prazos e configurações). É o que restaura tudo.
- **Exportar sessões (.csv)** — só o histórico, para planilhas.
- **Importar** — aceita backups da v3 e também da v2 (convertidos automaticamente). O arquivo é validado antes de gravar; nada nele é executado.

A tela mostra quando foi seu último backup e avisa discretamente se já faz muito tempo. Exportar de vez em quando é a única proteção real contra limpar o navegador sem querer.

---

## Vocabulário

A interface usa linguagem natural e mantém o termo técnico como complemento, nunca o contrário:

| Na tela | Termo técnico |
|---|---|
| Plano cumprido | aderência |
| Conteúdo estudado | cobertura |
| Conteúdos consolidados | domínio |
| "É prioridade" / "É importante" / "De vez em quando" | prioridade 5 / 3 / 2 |
| "Tente lembrar sem consultar" | recordação ativa |
| Assunto | tópico |
| Grupo (opcional) | área |

Os termos canônicos continuam existindo e aparecem na Ajuda e nas Análises — quem quiser a precisão encontra; quem não conhece, entende mesmo assim.

---

## Atualizar da v3 ou v4 para a v5

Substitua os arquivos do site (`index.html`, `styles.css`, `content.js` e `app.js`) e continue usando. A migração é automática, idempotente e não destrutiva.

A v5 **não introduz campos persistentes novos**: os sinalizadores de primeiro uso ficam no store `meta` (chave/valor, que já existia). Por isso o formato lógico dos dados continua na **versão 4** e o banco físico na **versão 1** — a versão do aplicativo e a do schema são coisas diferentes, e subir o schema sem necessidade só criaria risco.

Quem já usava não passa pelo primeiro acesso: vê uma única introdução às novidades e segue com tudo no lugar.

O que **não** muda:

- nenhuma sessão, tópico, plano, semana histórica ou prazo é apagado, duplicado ou recriado;
- **as revisões em andamento continuam de onde estavam** — próxima data, intervalo, domínio e número de repetições ficam intactos. A v4 não reinicia ninguém em "D+1";
- suas configurações antigas são preservadas.

Vindo da v3, campos da v4 são acrescentados com padrões seguros: natureza do conteúdo (`Mista`), estratégia e método (`herdar`), importância do tópico (`Normal`).

Backups gerados na v2, v3 e v4 continuam sendo aceitos.

---

## Migração da v2

Automática e segura. Ao abrir a v3 pela primeira vez em um navegador que tem dados da v2 (`localStorage`, chave `diarioEstudos:v1`), eles são convertidos:

| v2 | v3 |
|---|---|
| áreas | áreas |
| matérias (`subjects`) | disciplinas |
| registros (`logs`) | sessões |
| `tema` (texto) | preservado como texto legado na sessão |
| `metaSemanalCreditos` | convertida para minutos, como sugestão inicial do plano |

Pontos importantes:

- créditos históricos são preservados **exatamente** como estavam;
- tipo, dificuldade, comentário e itens arquivados são mantidos;
- **nenhum tópico é criado automaticamente** a partir dos temas antigos (evita duplicação) — você cadastra os tópicos quando quiser;
- a operação é **idempotente**: recarregar a página não duplica nada;
- os dados da v2 **não são apagados**. Continuam no navegador como segurança. Se algum dia quiser removê-los, há um botão explícito em Dados.

Depois da migração, o app pede apenas o que falta para a v3 funcionar: sua disponibilidade semanal e a prioridade de cada disciplina.

---

## Contato

Dúvidas, sugestões, ideias ou problemas: **contatosantanafilipe@gmail.com**

O endereço também aparece na Central de Ajuda e em Configurações → Sobre, com botões para enviar e-mail, copiar o endereço ou relatar um problema. O relato abre seu programa de e-mail já preenchido com informações técnicas básicas (versão, navegador, tela atual) — nenhum dado de estudo é incluído, e nada é enviado automaticamente.

---

## Publicar no GitHub Pages

1. Suba os cinco arquivos na raiz do repositório: `index.html`, `styles.css`, `content.js`, `app.js`, `README.md`.
2. **Settings → Pages → Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Acesse `https://seu-usuario.github.io/nome-do-repo/`.

Por ser um site estático, funciona sem qualquer configuração adicional. Atualizar é só substituir os arquivos.

> O ambiente esperado é HTTP(S). Abrir por `file://` costuma funcionar, mas alguns navegadores restringem o armazenamento local nesse modo.

---

## Estrutura

```
index.html    estrutura e telas
styles.css    tema (escuro por padrão) e layout responsivo
content.js    conteúdo estático: ajuda, guias de estudo, métodos e frases
app.js        dados, motores e interface
```

`content.js` é carregado antes de `app.js` e não contém lógica — só texto. Separá-lo mantém o `app.js` focado em comportamento.

`app.js` é dividido em seções: constantes, utilitários, datas, banco (IndexedDB), migrações, domínio, motor de planejamento, motor de revisão, motor de recomendação, analytics, cronômetro, backup, estado de interface, renderização, eventos e inicialização — além de busca da ajuda, tooltip, painel lateral, busca de comandos, modo foco e interações de computador.

Os textos ficam no código, nunca no banco de dados.

---

Desenvolvido por **Filipe Santana** · v5.0
