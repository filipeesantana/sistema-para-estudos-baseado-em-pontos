# Diário de Estudos — v3.0

Plataforma pessoal de planejamento, revisão e análise de estudos. Roda inteiramente no seu navegador: sem conta, sem servidor, sem rede.

O ciclo é sempre o mesmo: **planejar → estudar → registrar → revisar → analisar → reajustar**.

---

## O que ela faz

**Hoje** — a tela do dia a dia. Mostra o progresso da semana, qual sessão faz sentido agora (com os motivos da sugestão), as revisões pendentes e as próximas opções.

**Planejamento** — você diz quantas horas tem por semana; o sistema distribui entre as disciplinas respeitando mínimos, prioridade e prazos próximos. A distribuição é totalmente editável. Cada semana guarda seu próprio registro, então mudar o plano hoje não reescreve as metas de semanas passadas.

**Revisões** — todo tópico estudado entra automaticamente num ciclo de revisão espaçada. Ao terminar uma revisão você responde como se saiu (esqueci / difícil / lembrei / dominei) e o intervalo até a próxima se ajusta sozinho.

**Disciplinas** — a estrutura do conteúdo, em três níveis:

```
Área          Tecnologia
  Disciplina    CCNA
    Tópico        IPv4, Subnetting, VLAN, OSPF…
```

Cada tópico tem um status derivado automaticamente: não iniciado → em estudo → em revisão → dominado (e pode regredir, se você esquecer). Também é aqui que ficam os prazos (provas, entregas), que aumentam a prioridade da disciplina.

**Análises** — período flexível (hoje, 7/30 dias, semana, mês, tudo ou intervalo personalizado), comparação com o período anterior, distribuição do tempo, planejado × realizado, cobertura e domínio de conteúdo, dificuldade percebida, tipos de sessão, revisões, relatório semanal e insights automáticos. Tudo calculado localmente, com regras determinísticas — nenhuma IA envolvida. Há um botão para copiar um resumo em texto, caso você queira levar para outro lugar.

**Histórico** — todas as sessões, com busca e filtros por área, disciplina, tópico, período, tipo e dificuldade.

**Registrar** — o botão global. Ou você inicia o cronômetro (que sobrevive a recarregar e fechar a aba) ou lança a sessão manualmente. Atalho: tecla `R`.

Você não precisa deste README para usar o aplicativo. Ele se explica sozinho.

---

## Créditos e minutos

Cada disciplina tem sua própria regra de crédito (ex.: 20 min = 1 crédito). Créditos continuam existindo para acompanhamento, mas **o planejamento e as análises trabalham em minutos** — 10 créditos de disciplinas diferentes não representam o mesmo esforço.

---

## Privacidade

Tudo fica no **IndexedDB do seu navegador**. Não há backend, login, sincronização, telemetria nem chamadas externas — a política de segurança da página bloqueia conexões de rede (`connect-src 'none'`), e não há fontes, bibliotecas ou scripts de terceiros.

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

## Publicar no GitHub Pages

1. Suba os quatro arquivos na raiz do repositório: `index.html`, `styles.css`, `app.js`, `README.md`.
2. **Settings → Pages → Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Acesse `https://seu-usuario.github.io/nome-do-repo/`.

Por ser um site estático, funciona sem qualquer configuração adicional. Atualizar é só substituir os arquivos.

> O ambiente esperado é HTTP(S). Abrir por `file://` costuma funcionar, mas alguns navegadores restringem o armazenamento local nesse modo.

---

## Estrutura

```
index.html    estrutura e telas
styles.css    tema (escuro por padrão) e layout responsivo
app.js        dados, motores e interface
```

`app.js` é dividido em seções: constantes, utilitários, datas, banco (IndexedDB), migração, domínio, motor de planejamento, motor de revisão, motor de recomendação, analytics, cronômetro, backup, estado de interface, renderização, eventos e inicialização.

---

Desenvolvido por **Filipe Santana** · v3.0
