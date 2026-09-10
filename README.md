# Diário de Estudos — Painel de Créditos

Site de página única (`index.html`) para registrar progresso de estudos usando um sistema de créditos por matéria, com metas semanais, histórico e exportação de dados.

## Como funciona

- **Áreas** agrupam **matérias** (ex.: área "Inglês" → matéria "Verbs").
- Cada matéria tem uma regra de crédito: **X minutos = 1 crédito** (ex.: 20 min de Verbs = 1 crédito).
- Cada matéria tem uma **meta semanal em créditos**.
- Ao registrar uma sessão de estudo (minutos), o site calcula o crédito automaticamente.
- O **Painel** mostra o progresso da semana por matéria, com navegação entre semanas.
- O **Histórico** lista todos os registros, com filtros por área, matéria e período.
- Em **Dados**, dá pra exportar tudo em `.json` (bruto, para colar em outra IA e pedir análise) ou `.csv` (para planilhas), importar um backup, ou apagar tudo.

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
  "areas": [{ "id": "area_xxx", "nome": "Inglês" }],
  "subjects": [
    {
      "id": "subj_xxx",
      "nome": "Verbs",
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
      "comentario": "Revisão de Verbs",
      "criadoEm": "2026-09-08T12:00:00.000Z"
    }
  ]
}
```

Esse é o arquivo bruto que você pode colar em outra IA junto de um pedido do tipo "analise minha distribuição de créditos por área nas últimas semanas".
