# Roteiro de demo — painel web (PBI-0072)

Caminho **login → fila de revisão → revisão → decisão** no painel web, com os dados de teste do seed da API
(PBI-0066). A parte de execução em campo (técnico) é feita no app mobile e no roteiro da API.

> Dados e senhas abaixo são **somente de demonstração local** (profile `dev` da API). Nunca use em produção.

## 1. Preparação

1. Suba a API no profile `dev` (Java 25) — ver o [README da api-java](https://github.com/Project-FieldCore/api-java#executar-dev):

   ```bash
   export JWT_SECRET='local-dev-only-jwt-secret-key-32chars!!'
   ./mvnw spring-boot:run
   ```

   Confira `http://localhost:8080/actuator/health` → `UP`. O seed (`DevDemoSeed`) roda sozinho na subida.
2. Suba o painel:

   ```bash
   cd web-react
   cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
   npm ci
   npm run dev                        # http://localhost:3000
   ```

## 2. Dados de teste

Senha de todos os usuários: `DemoPass123!`

| E-mail | Perfil | Uso na demo |
|--------|--------|-------------|
| `ana.silva@example.com` | SUPERVISOR | revisar e decidir |
| `admin@fieldcore.com` | ADMIN | cadastros e auditoria |
| `joao.tecnico@example.com` | TECHNICIAN | **não** acessa o painel (use o app mobile) |

Inspeções do seed usadas aqui:

| Título | Status | Para quê |
|--------|--------|----------|
| `[Demo] Enviada — fila revisão` | SUBMITTED | aparece na **Fila de revisão** |
| `[Demo] Em revisão` | UNDER_REVIEW | já permite aprovar/reprovar/devolver |

Detalhes e reset: [DEMO_SEED.md](https://github.com/Project-FieldCore/api-java/blob/develop/docs/DEMO_SEED.md).

## 3. Roteiro

### 3.1 Login
1. Abra `http://localhost:3000` e entre com `ana.silva@example.com` / `DemoPass123!`.
2. **Esperado:** o painel abre com o menu lateral (Dashboard, Inspeções, **Fila de revisão**…).

### 3.2 Fila de revisão
1. Menu **Fila de revisão**.
2. **Esperado:** a inspeção `[Demo] Enviada — fila revisão` aparece na lista (antes disso, um estado de *carregando*).

### 3.3 Revisão
1. Abra a inspeção. Confira as **Respostas do checklist** (somente leitura) e as evidências.
2. Em cada item, **Histórico (n)** mostra autor, data e antes → depois da resposta.
3. Clique em **Iniciar revisão formal**.
4. **Esperado:** o status passa a *Em revisão* e aparecem as ações **Aprovar**, **Reprovar** e **Devolver para correção**.

### 3.4 Decisão
- **Aprovar:** clique em **Aprovar** (comentário opcional). **Esperado:** volta para a *Fila de revisão* (ou *Inspeções*, se você abriu por lá) e o status fica *Aprovada* (selo verde).
- **Reprovar:** clique em **Reprovar**, preencha o **Motivo da reprovação** (obrigatório) e confirme. Sem motivo, o formulário mostra erro.
- **Devolver para correção:** informe o comentário; a inspeção volta ao técnico.

Para repetir a demo com outra decisão, use `[Demo] Em revisão` ou reinicie a API (recria o seed).

## 4. Estados de interface

| Estado | Como provocar |
|--------|---------------|
| **Carregando** | abrir *Fila de revisão* ou o detalhe da inspeção (indicador de carregamento) |
| **Vazio** | depois de decidir todas as inspeções: "Nenhuma inspeção aguardando revisão" |
| **Erro** | parar a API e recarregar a fila: mensagem de falha com **Tentar novamente**; entrar com `joao.tecnico@example.com` mostra "Este perfil não tem acesso à interface administrativa web."; senha errada mostra "E-mail ou senha inválidos." |
| **Sucesso** | aprovar uma inspeção (retorna à lista com o novo status) |

Erros da API chegam no formato padronizado (`code`, `message`, `fieldErrors`) — ver o
[README da API](https://github.com/Project-FieldCore/api-java#formato-padronizado-de-erro).

## 5. Evidência para o card

Anexar no PR / issue:

- Vídeo curto do fluxo 3.1 → 3.4.
- Print de cada estado da seção 4.
- Request/response de `POST /inspections/{id}/review/approve` e de um erro real (aba Network do navegador).
- Saída de `npm run lint`, `npm run typecheck` e `npm test`.
