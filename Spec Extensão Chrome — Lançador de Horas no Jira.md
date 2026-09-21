# Spec: Extensão Chrome — Lançador de Horas no Jira

2026-09-21 · @Richard

## Visão geral

Extensão para o Google Chrome (Manifest V3) que permite lançar horas trabalhadas em tarefas do Jira sem precisar abrir o Jira no navegador. O usuário abre o popup da extensão, informa suas credenciais do Jira uma vez, digita a chave da tarefa (ex.: DESENV-1234), o tempo gasto e uma data, e a extensão grava o apontamento direto via API REST do Jira.

Instância alvo: `https://desenv.betha.com.br` (Jira Server/Data Center, autenticação por usuário e senha).

Público: colaboradores da Betha que lançam horas com frequência e querem evitar o fluxo completo de telas do Jira.

## Requisitos funcionais

1. Login com usuário e senha do Jira, validado contra a própria API antes de liberar a tela principal.
2. Opção "manter conectado" para persistir a sessão entre reinícios do navegador; sem marcar, a sessão dura só até o Chrome fechar.
3. Campo para digitar a chave da tarefa (ex.: DESENV-1234); ao sair do campo, buscar e mostrar o título da tarefa para confirmação antes do lançamento.
4. Campo de tempo gasto no formato aceito pelo Jira (ex.: "2h", "1h 30m", "45m").
5. Campo de data e hora de início do apontamento, com data/hora atual como padrão.
6. Campo de descrição opcional do trabalho realizado.
7. Botão para lançar horas, com feedback claro de sucesso ou erro.
8. Histórico local dos últimos 5 lançamentos (tarefa, tempo, data) visível na mesma tela, só para conferência — o Jira continua sendo a fonte de verdade.
9. Botão de logout que limpa as credenciais armazenadas.

## Arquitetura e arquivos

Estrutura do projeto (na raiz deste repositório):

```
lanc-hora/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

Os arquivos de ícone (`icons/*.png`) são fornecidos manualmente pelo usuário antes de carregar a extensão no Chrome.

- `manifest.json`: Manifest V3. `action.default_popup` = `popup.html`. `permissions: ["storage"]`. `host_permissions: ["https://desenv.betha.com.br/*"]`.
- Sem background service worker: toda a lógica roda no popup enquanto ele está aberto — suficiente, pois é uma ação pontual do usuário.
- `popup.html` / `popup.css`: duas telas dentro do mesmo popup — `#login-screen` e `#main-screen` — alternadas por classe `.hidden`, sem navegação entre páginas.
- `popup.js`: toda a lógica (autenticação, chamadas à API, storage, renderização).

## Autenticação

- Método: Basic Auth. Header `Authorization: Basic base64(usuario:senha)` em toda chamada à API do Jira.
- Fluxo de login:
  1. Usuário informa usuário, senha e a URL base do Jira (pré-preenchida com `https://desenv.betha.com.br`, editável).
  2. A extensão chama `GET {baseUrl}/rest/api/2/myself` com o header Basic Auth.
  3. Resposta 200 → login válido; extrai `displayName` para a saudação e mostra a tela principal.
  4. Resposta 401 → mensagem "Usuário ou senha inválidos"; qualquer outro erro → mostra a mensagem recebida.
- Armazenamento das credenciais (o token base64 de usuário:senha, nunca a senha isolada):
  - Por padrão, em `chrome.storage.session` (memória, some ao fechar o navegador).
  - Se a caixa "manter conectado" estiver marcada, grava também em `chrome.storage.local` (persiste entre reinícios).
  - Ao abrir o popup: tenta carregar de `chrome.storage.session`; se vazio, tenta `chrome.storage.local`; se achar algo, valida de novo contra `/rest/api/2/myself` antes de mostrar a tela principal.
- Logout: limpa as chaves em `chrome.storage.session` e `chrome.storage.local` e volta para a tela de login.

## Integração com a API do Jira

Base: API REST clássica do Jira Server/Data Center (`/rest/api/2`).

- Validar login: `GET /rest/api/2/myself` → `{ name, displayName, emailAddress }`.
- Buscar tarefa (para confirmar antes de lançar): `GET /rest/api/2/issue/{issueKey}?fields=summary,status` → usar `fields.summary` para exibir "Título: ...". 404 → tarefa não existe.
- Lançar horas: `POST /rest/api/2/issue/{issueKey}/worklog` com corpo:

```json
{
  "started": "2026-09-21T09:00:00.000-0300",
  "timeSpent": "2h",
  "comment": "Descrição opcional"
}
```

- `started` deve seguir o formato `yyyy-MM-ddTHH:mm:ss.SSS±HHMM` (sem dois-pontos no offset), montado a partir dos campos de data/hora do formulário e do fuso local do navegador.
- `comment` só é enviado se o campo não estiver vazio.
- Resposta 201 → sucesso. 400 → formato de tempo inválido (pedir revisão do campo "tempo gasto"). 401 → sessão expirada, forçar novo login. 404 → tarefa não encontrada.

Observação: hoje a instância aceita Basic Auth nas chamadas REST; se essa opção for desativada no futuro (comum quando a organização migra para Personal Access Token), os mesmos endpoints passam a exigir `Authorization: Bearer <token>`. Vale manter a função que monta esse header isolada num único ponto do código para facilitar essa troca depois.

## Telas e fluxos de UI

### Tela de login (`#login-screen`)

- Campos: URL base do Jira, usuário, senha, checkbox "Manter conectado neste navegador".
- Botão "Entrar"; área de erro abaixo do botão.

### Tela principal (`#main-screen`)

- Cabeçalho: "Olá, {displayName}" + link "Sair".
- Formulário de lançamento:
  - Tarefa (chave) — ao perder o foco, mostra abaixo o título da tarefa encontrada ou um aviso de "tarefa não encontrada".
  - Tempo gasto — com texto de ajuda mostrando exemplos ("2h", "1h 30m", "30m").
  - Data e hora de início — preenchidos com a data/hora atual por padrão.
  - Descrição (opcional).
  - Botão "Lançar horas".
- Mensagem de sucesso após lançar, com um link "Abrir tarefa no Jira" (abre `{baseUrl}/browse/{issueKey}` em nova aba).
- Lista "Últimos lançamentos" com os 5 mais recentes feitos nesta extensão (tarefa, tempo, data).

## Modelo de dados e storage local

- `chrome.storage.session.auth` = `{ baseUrl, basicToken, displayName }` — sessão atual, some ao fechar o navegador.
- `chrome.storage.local.auth` = mesma forma, só existe se "manter conectado" estiver marcado.
- `chrome.storage.local.worklogHistory` = array com até 5 itens `{ issueKey, timeSpent, date, comment, loggedAt }`, mais recente primeiro; usado só para exibir o histórico na tela, nunca lido de volta pelo Jira.

Nenhum dado é enviado para fora do navegador do usuário além das chamadas diretas à API do Jira.

## Tratamento de erros

- Falha de rede (offline, DNS, bloqueio pelo servidor): mensagem genérica "Não foi possível conectar ao Jira. Verifique sua conexão.", com o erro técnico disponível num `<details>` para depuração.
- 401 em qualquer chamada após o login: limpar credenciais armazenadas e voltar para a tela de login com a mensagem "Sessão expirada, faça login novamente".
- 404 ao buscar ou lançar horas numa tarefa: "Tarefa {issueKey} não encontrada. Confira a chave."
- 400 ao lançar horas: "Não foi possível interpretar o tempo informado. Use um formato como 2h, 1h 30m ou 45m."
- Campos obrigatórios vazios (tarefa, tempo): bloquear o envio e destacar o campo, sem chamar a API.

## Segurança e limitações conhecidas

- A senha nunca é salva isoladamente; guarda-se apenas o token Basic (base64 de usuário:senha), e mesmo assim base64 não é criptografia — qualquer pessoa com acesso ao perfil do Chrome consegue decodificar. Aceitável para uso pessoal numa máquina de trabalho, mas deve ficar explícito para o usuário em um texto pequeno abaixo do checkbox "manter conectado".
- Toda comunicação é feita direto do navegador do usuário para `https://desenv.betha.com.br`, sem nenhum servidor intermediário da extensão.
- `host_permissions` limitado ao domínio do Jira usado, para o Chrome não liberar acesso amplo a outros sites.
- Se a organização desativar Basic Auth no futuro, a extensão para de autenticar — ver a observação sobre Personal Access Token na seção de integração com a API.

## Critérios de aceite e roteiro de teste manual

1. Instalar via `chrome://extensions` → "Modo do desenvolvedor" → "Carregar sem compactação" → selecionar a pasta do projeto.
2. Login com usuário/senha válidos → tela principal aparece com o nome correto.
3. Login com senha errada → mensagem de erro, sem travar a extensão.
4. Digitar uma chave de tarefa válida → título da tarefa aparece.
5. Digitar uma chave inexistente → aviso de "tarefa não encontrada".
6. Lançar "1h 30m" numa tarefa válida → sucesso, e o apontamento aparece no Jira (conferir na aba do navegador) e no histórico local.
7. Marcar "manter conectado", fechar e reabrir o navegador → segue logado.
8. Não marcar "manter conectado", fechar e reabrir o navegador → pede login de novo.
9. Clicar "Sair" → volta para a tela de login e uma nova abertura do popup não mostra dados antigos.
