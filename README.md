# Diário de Estudos — Painel de Créditos (v2.0)

Site de página única (`index.html`) para registrar progresso de estudos usando um sistema de créditos por matéria, com metas semanais, análise determinística do seu período de estudo, histórico e exportação de dados.

## Como funciona

- **Áreas** agrupam **matérias** (ex.: área "Redes" → matéria "CCNA").
- Cada matéria tem uma regra de crédito: **X minutos = 1 crédito** (ex.: 20 min de CCNA = 1 crédito).
- Cada matéria tem uma **meta semanal em créditos**.
- Ao registrar uma sessão de estudo (minutos), o site calcula o crédito automaticamente. Cada registro também pode ter tema, tipo de sessão (teoria/exercícios/laboratório/revisão/projeto/outro) e um nível de dificuldade percebida (1–5) — nenhum desses dois últimos altera os créditos, são só para análise.
- **Painel**: período flexível (chips, calendário interativo tipo GitHub, ou datas manuais), resumo com tempo estudado/créditos/sessões/dias ativos/meta atingida, comparação automática com o período anterior, gráfico de tempo estudado, insights automáticos e metas da semana atual.
- **Análises**: visão profunda do mesmo período — distribuição do tempo por matéria ou área, resumo por área (expansível), dificuldade média, distribuição por tipo de sessão, e todos os insights.
- Matérias podem ser **arquivadas** (em vez de excluídas) — saem do registro e das metas ativas, mas todo o histórico permanece intacto.
- O **Histórico** tem busca textual, e filtros por área, matéria, período, dificuldade e tipo.
- Em **Dados**, dá pra exportar tudo em `.json` (bruto, para colar em outra IA e pedir análise complementar) ou `.csv` (para planilhas), importar um backup (inclusive de versões antigas — a migração é automática), ou apagar tudo.
- **Configurações** (link no rodapé da barra lateral): primeiro dia da semana, período padrão do painel, duração padrão de sessão, reduzir animações.

## Migração de dados antigos

Se você já usava uma versão anterior deste app (sem tema/tipo/dificuldade/arquivamento), pode importar o `.json` exportado dela em **Dados → Importar**, ou simplesmente abrir esta nova versão no mesmo navegador onde os dados antigos já estavam salvos — a migração acontece automaticamente e nenhum registro é perdido. Campos que não existiam antes (tema, tipo, dificuldade) ficam em branco nos registros antigos, e continuam editáveis normalmente.

## Privacidade

Não há backend nem servidor: tudo fica salvo em `localStorage`, **apenas no navegador que você está usando**. Nada é enviado para nenhum servidor — inclusive depois de publicado no GitHub Pages, o site continua sendo só HTML/CSS/JS estático rodando no seu navegador.

**Isso também significa:**
- Os dados **não sincronizam entre dispositivos ou navegadores** automaticamente.
- Se você limpar os dados do navegador (ou usar aba anônima), o progresso salvo se perde.
- Para mover os dados para outro dispositivo, ou simplesmente ter um backup de segurança, use **Dados → Exportar dados (.json)** e depois **Importar** no outro lugar.
- Recomendo exportar o `.json` periodicamente (ex.: toda semana) como backup.

## Como publicar no GitHub Pages

1. Crie um repositório novo no GitHub (pode ser privado — ele não precisa ser público para o Pages funcionar em contas pagas; em contas gratuitas o Pages exige repositório público, mas lembre-se: nenhum dado seu passa a ficar no repositório, só o código do site).
2. Suba o arquivo `index.html` para a raiz do repositório (pode subir este `README.md` também, é só documentação).
3. No repositório, vá em **Settings → Pages**.
4. Em "Build and deployment", selecione **Deploy from a branch**, branch `main` (ou `master`), pasta `/ (root)`.
5. Salve. Em alguns minutos o GitHub mostra o link do tipo `https://seu-usuario.github.io/nome-do-repo/`.
6. Acesse esse link — pronto, o site está no ar.

Qualquer atualização futura no `index.html` (ex.: se eu te mandar uma versão nova) é só substituir o arquivo no repositório.

## Estrutura de dados do export (.json)

```json
{
  "exportadoEm": "2026-09-08T12:00:00.000Z",
  "areas": [{ "id": "area_xxx", "nome": "Redes" }],
  "subjects": [
    {
      "id": "subj_xxx",
      "nome": "CCNA",
      "areaId": "area_xxx",
      "minutosPorCredito": 20,
      "metaSemanalCreditos": 5
    }
  ],
  "logs": [
    {
      "id": "log_xxx",
      "subjectId": "subj_xxx",
      "date": "2026-09-08",
      "minutos": 20,
      "credits": 1,
      "comentario": "Revisão de VLANs",
      "criadoEm": "2026-09-08T12:00:00.000Z"
    }
  ]
}
```

Esse é o arquivo bruto que você pode colar em outra IA junto de um pedido do tipo "analise minha distribuição de créditos por área nas últimas semanas".
