# Ciclo

**Seu sistema de estudos.** Organize o que você estuda, registre suas sessões, receba revisões no momento certo e acompanhe seu progresso. Tudo roda no seu navegador: sem conta, sem servidor, sem internet.

O nome vem do próprio método: **planejar → estudar → revisar → analisar → reajustar**, e começar de novo.

> O Ciclo se chamava **Diário de Estudos**. Só o nome mudou: quem já usava continua com todos os dados, revisões e planos exatamente como estavam.

---

## O que é

O Ciclo é uma plataforma pessoal de planejamento, revisão e análise de estudos. Você diz o que está estudando e registra o tempo; o Ciclo organiza o conteúdo, lembra quando revisar cada assunto e mostra, em linguagem simples, como está o seu progresso.

Ele é completo, mas não exige que você entenda tudo antes de começar. Abrir o Ciclo, adicionar o que você estuda e iniciar a primeira sessão leva poucos minutos. O resto (assuntos, revisões, planejamento, análises) aparece conforme você usa.

## Para que serve

Quem estuda por conta própria costuma esbarrar nos mesmos problemas:

- não saber **o que revisar e quando**;
- perder de vista se o tempo está **bem distribuído** entre as matérias;
- não ter clareza sobre **o que já foi aprendido** e o que só foi lido.

O Ciclo cuida dessas três coisas. Ele agenda revisões automaticamente, ajuda a dividir a semana sem transformar isso numa agenda rígida e traduz seu histórico em informações fáceis de entender.

Serve para qualquer pessoa e qualquer assunto: escola, faculdade, concursos, idiomas, certificações, música, programação, estudo por conta própria. Não é preciso ter experiência com ferramentas de estudo.

## Como começar

1. **Adicione algo que você estuda.** Uma matéria, um idioma, uma certificação, qualquer assunto.
2. **Comece uma sessão.** Escolha quanto tempo quer estudar e o Ciclo conta o tempo para você.
3. **Adicione assuntos conforme precisar.** Por exemplo, *Matemática → Derivadas*. Não precisa cadastrar tudo de uma vez.
4. **O Ciclo avisa quando revisar.** Cada assunto estudado volta sozinho no momento certo.
5. **Organize sua semana quando quiser.** Dizer quantas horas você tem por semana é opcional e melhora as sugestões.

Você não precisa definir área, prioridade, metas ou estratégia de revisão para começar. Tudo vem com padrões que funcionam e pode ser ajustado depois.

## Principais recursos

**Hoje**: a tela do dia a dia. Mostra a sessão que faz mais sentido agora, com o motivo da sugestão, as revisões do dia, o progresso da semana e uma frase curta sobre estudo.

**Planejamento**: você diz quantas horas tem por semana e o Ciclo sugere como dividir esse tempo entre as matérias. Todos os valores podem ser editados, e cada semana guarda o próprio registro.

**Revisões**: a fila do que precisa ser revisado, ordenada pelo que corre mais risco de ser esquecido. Dá para montar uma sessão de 10, 20 ou 30 minutos com as revisões mais importantes.

**Disciplinas**: tudo o que você estuda, com os assuntos de cada matéria, o quanto do conteúdo já foi visto e os prazos (provas, entregas).

**Análises**: tempo estudado, dias de estudo, plano cumprido, conteúdo visto e consolidado, dificuldade percebida, revisões e um resumo semanal. Tudo calculado no seu navegador, com regras fixas e explicadas.

**Histórico**: todas as sessões registradas, com busca e filtros.

**Ajuda**: explicações curtas com exemplos, demonstrações que você pode experimentar sem mexer nos seus dados, dúvidas frequentes e glossário. Cada tela tem também um botão **Ajuda desta tela**.

No computador, **Ctrl + K** abre uma busca rápida para ir a qualquer tela, disciplina, assunto ou ação.

## Revisões

Depois que você estuda um assunto, ele entra sozinho no ciclo de revisão. Quando chega a hora, o Ciclo mostra algo simples, como *"Você tem 2 revisões hoje"*.

- **Quando revisar**: o Ciclo decide o intervalo. Se você lembrou bem, o assunto demora mais para voltar; se esqueceu, volta logo.
- **Como revisar**: revisar não é reler. O Ciclo sugere um jeito de revisar (tentar lembrar antes de olhar o material, resolver exercícios, explicar com suas palavras, escrever de memória…) e mostra um roteiro curto. Você pode trocar quando quiser.
- **Sessões de revisão**: com muitas revisões acumuladas, basta dizer quanto tempo você tem. O Ciclo escolhe as mais importantes que cabem nesse tempo, e o restante continua na fila.
- **Resultado**: ao terminar, você responde como foi (*Esqueci*, *Lembrei com dificuldade*, *Lembrei bem* ou *Dominei*) e o Ciclo ajusta a próxima data.

Quem quiser mais controle pode escolher outras estratégias de revisão (ciclo programado, intensiva para provas, manutenção) por disciplina ou por assunto. Ninguém precisa mexer nisso para usar bem o Ciclo.

## Aprender a estudar

Além de organizar seus estudos, o Ciclo traz conteúdo curto sobre **como estudar melhor**: recuperação ativa, espaçamento, a diferença entre reconhecer e lembrar, prática intercalada, explicação, resumos, flashcards, Pomodoro, consistência e descanso.

Cada texto começa com uma explicação em uma frase e segue o mesmo formato: o que é, por que ajuda, como fazer, um exemplo e como isso aparece no Ciclo.

## Privacidade

- **Tudo fica no seu navegador.** Não existe conta nem login.
- **Nenhum servidor.** Seus dados de estudo não são enviados para lugar nenhum.
- **Nenhuma telemetria ou rastreamento.** A página bloqueia conexões de rede e não usa fontes, bibliotecas ou scripts de terceiros.

O Ciclo também não envia e-mails. Em **Ajuda** e em **Configurações → Sobre** você pode copiar o endereço de contato ou montar um relato de problema e decidir como enviá-lo. O relato inclui apenas informações técnicas (versão, tela, navegador, idioma e tamanho da janela), nunca seus dados de estudo.

## Seus dados e backup

Os dados ficam no **IndexedDB**, um espaço de armazenamento que todo navegador moderno oferece. Funciona como um pequeno banco de dados dentro do navegador, no seu próprio computador.

Isso tem duas consequências práticas:

- os dados **não sincronizam** entre navegadores ou dispositivos;
- **limpar os dados do site** (ou usar uma janela anônima) apaga o histórico.

Por isso existe o backup, na tela **Dados**:

- **Backup completo (.json)**: guarda tudo (disciplinas, assuntos, sessões, planos, prazos e configurações). É o arquivo que restaura o Ciclo em outro computador ou depois de limpar o navegador.
- **Sessões (.csv)**: apenas o histórico de sessões, para abrir numa planilha.

Ao importar um backup, o Ciclo verifica o arquivo antes de gravar qualquer coisa e pede confirmação. Backups feitos na época do Diário de Estudos continuam sendo aceitos.

A tela Dados mostra quando foi seu último backup. Exportar de vez em quando e guardar o arquivo fora do computador é a melhor proteção para o seu histórico.

## Filosofia

**A ferramenta trabalha para você, não o contrário.**

- **Facilidade antes de configuração.** Tudo tem um padrão sensato; personalizar é opcional.
- **Cada decisão aparece só quando é necessária.** Você não precisa montar um plano para estudar pela primeira vez, nem escolher uma estratégia de revisão para criar uma disciplina.
- **Explicação no momento certo.** Os conceitos são explicados quando aparecem, com exemplo e ação, e não num manual que precisa ser lido antes.
- **Sugestões que se explicam.** Toda recomendação mostra o motivo em linguagem humana, como *"Faltam 40min de Matemática nesta semana"*.
- **Sério, sem virar jogo.** Sem pontos, rankings ou sequências punitivas. O foco é estudar.

## Como é feito

O Ciclo é uma aplicação local-first feita em HTML, CSS e JavaScript puro, sem frameworks. Os dados ficam no IndexedDB do navegador e nenhuma informação é enviada para um servidor.

## Contato

Dúvidas, sugestões ou problemas: **contatosantanafilipe@gmail.com**

O endereço também está no aplicativo, em **Ajuda** e em **Configurações → Sobre**, com opção de copiar o endereço ou o relato de problema mesmo sem um aplicativo de e-mail configurado.

## Versão atual

**v5.1**

- **Novo nome:** o Diário de Estudos passa a se chamar **Ciclo**.
- **Novo design:** sistema visual reconstruído, com papéis de cor bem definidos (teal para ações e progresso, dourado para destaques), mais contraste, profundidade e hierarquia.
- **Temas refeitos:** o escuro ganhou superfícies mais bem separadas; o claro ganhou identidade própria, com tons quentes e aparência editorial.
- **Movimento com propósito:** transições curtas e consistentes para telas, painéis, janelas e avisos, que respeitam a opção de reduzir animações.
- **Respostas mais claras:** avisos com título e detalhe depois de registrar, revisar, salvar ou fazer backup, e métricas que mostram quando mudaram.
- **Melhor uso de telas grandes:** Hoje, Revisões, Planejamento, Análises, Disciplinas e Configurações aproveitam melhor monitores largos.
- **Contato confiável:** dá para copiar o endereço de e-mail mesmo quando nenhum aplicativo de e-mail abre.
- **Relato de problema melhorado:** um formulário próprio mostra exatamente o que será incluído e permite copiar o relato ou abrir no e-mail.

Seus dados continuam como estavam. Atualizar não apaga, duplica nem reinicia nada.

---

Desenvolvido por **Filipe Santana**
