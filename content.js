/* =========================================================================
   DIÁRIO DE ESTUDOS — CONTEÚDO ESTÁTICO (v4)
   Textos, guias e frases. Nada aqui vai para o IndexedDB e nada vem da rede.

   Blocos: DAILY_QUOTES · STUDY_GUIDES · REVIEW_METHOD_GUIDES ·
           HELP_* (categorias, artigos, FAQ, glossário, exemplos, contexto)
   ========================================================================= */
'use strict';

/* =========================================================================
   FRASE DO DIA
   attributionStatus: verified | attributed | proverb | original
   "verified"  → autor histórico, obra em domínio público
   "attributed"→ circula amplamente, mas a autoria não é segura
   "proverb"   → provérbio / sabedoria popular
   "original"  → reflexão escrita para o Diário de Estudos
   ========================================================================= */
const DAILY_QUOTES = [
  /* ---------- clássicos em domínio público ---------- */
  { id:1, text:'Só sei que nada sei.', author:'Sócrates', attributionStatus:'attributed', category:'curiosidade' },
  { id:2, text:'A educação é o melhor provimento para a velhice.', author:'Aristóteles', attributionStatus:'attributed', category:'longo prazo' },
  { id:3, text:'Somos aquilo que repetidamente fazemos. A excelência, portanto, não é um ato, mas um hábito.', author:'Will Durant, comentando Aristóteles', attributionStatus:'attributed', category:'consistência' },
  { id:4, text:'Conhece-te a ti mesmo.', author:'inscrição do templo de Delfos', attributionStatus:'verified', category:'aprendizagem' },
  { id:5, text:'A vida é curta, a arte é longa, a ocasião fugidia, a experiência enganosa, o julgamento difícil.', author:'Hipócrates', attributionStatus:'verified', category:'paciência' },
  { id:6, text:'Não é que tenhamos pouco tempo, é que perdemos muito dele.', author:'Sêneca', attributionStatus:'verified', category:'tempo' },
  { id:7, text:'Enquanto ensinamos, aprendemos.', author:'Sêneca', attributionStatus:'verified', category:'aprendizagem' },
  { id:8, text:'Nenhum vento é favorável para quem não sabe a que porto se dirige.', author:'Sêneca', attributionStatus:'attributed', category:'planejamento' },
  { id:9, text:'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.', author:'Sêneca', attributionStatus:'verified', category:'esforço' },
  { id:10, text:'Comece: metade da obra está feita.', author:'Horácio', attributionStatus:'verified', category:'preparação' },
  { id:11, text:'A gota fura a pedra não pela força, mas por cair sempre.', author:'Ovídio', attributionStatus:'verified', category:'consistência' },
  { id:12, text:'O tempo escapa irreparavelmente.', author:'Virgílio', attributionStatus:'verified', category:'tempo' },
  { id:13, text:'Conheço um só bem: o saber; e um só mal: a ignorância.', author:'Diógenes Laércio', attributionStatus:'attributed', category:'aprendizagem' },
  { id:14, text:'Não são as coisas que perturbam os homens, mas as opiniões que eles têm sobre as coisas.', author:'Epicteto', attributionStatus:'verified', category:'foco' },
  { id:15, text:'É impossível alguém aprender aquilo que pensa já saber.', author:'Epicteto', attributionStatus:'verified', category:'curiosidade' },
  { id:16, text:'A felicidade da sua vida depende da qualidade dos seus pensamentos.', author:'Marco Aurélio', attributionStatus:'verified', category:'foco' },
  { id:17, text:'Não perca mais tempo discutindo o que um bom homem deve ser. Seja um.', author:'Marco Aurélio', attributionStatus:'verified', category:'disciplina' },
  { id:18, text:'Onde quer que haja um ser humano, há uma oportunidade para a gentileza.', author:'Sêneca', attributionStatus:'verified', category:'paciência' },
  { id:19, text:'O saber não ocupa lugar.', author:'provérbio', attributionStatus:'proverb', category:'aprendizagem' },
  { id:20, text:'Devagar se vai ao longe.', author:'provérbio', attributionStatus:'proverb', category:'consistência' },
  { id:21, text:'Água mole em pedra dura tanto bate até que fura.', author:'provérbio', attributionStatus:'proverb', category:'persistência' },
  { id:22, text:'Quem semeia, colhe.', author:'provérbio', attributionStatus:'proverb', category:'longo prazo' },
  { id:23, text:'Não deixes para amanhã o que podes fazer hoje.', author:'provérbio', attributionStatus:'proverb', category:'disciplina' },
  { id:24, text:'De grão em grão a galinha enche o papo.', author:'provérbio', attributionStatus:'proverb', category:'consistência' },
  { id:25, text:'A pressa é inimiga da perfeição.', author:'provérbio', attributionStatus:'proverb', category:'paciência' },
  { id:26, text:'Quem muito abarca, pouco aperta.', author:'provérbio', attributionStatus:'proverb', category:'foco' },
  { id:27, text:'Uma andorinha só não faz verão.', author:'provérbio', attributionStatus:'proverb', category:'consistência' },
  { id:28, text:'Antes tarde do que nunca.', author:'provérbio', attributionStatus:'proverb', category:'persistência' },
  { id:29, text:'Casa de ferreiro, espeto de pau.', author:'provérbio', attributionStatus:'proverb', category:'prática' },
  { id:30, text:'Errando é que se aprende.', author:'provérbio', attributionStatus:'proverb', category:'erro' },
  { id:31, text:'Cada macaco no seu galho.', author:'provérbio', attributionStatus:'proverb', category:'foco' },
  { id:32, text:'Para quem sabe ler, um pingo é letra.', author:'provérbio', attributionStatus:'proverb', category:'aprendizagem' },
  { id:33, text:'Quem não arrisca, não petisca.', author:'provérbio', attributionStatus:'proverb', category:'prática' },
  { id:34, text:'Mais vale um pássaro na mão do que dois voando.', author:'provérbio', attributionStatus:'proverb', category:'planejamento' },
  { id:35, text:'O apressado come cru.', author:'provérbio', attributionStatus:'proverb', category:'paciência' },
  { id:36, text:'Um dia de cada vez.', author:'provérbio', attributionStatus:'proverb', category:'consistência' },
  { id:37, text:'Quem espera sempre alcança.', author:'provérbio', attributionStatus:'proverb', category:'paciência' },
  { id:38, text:'Grão a grão se enche a medida.', author:'provérbio', attributionStatus:'proverb', category:'longo prazo' },
  { id:39, text:'Não se colhe fruto no dia em que se planta.', author:'provérbio', attributionStatus:'proverb', category:'longo prazo' },
  { id:40, text:'Quem caminha devagar, mas sempre, chega primeiro.', author:'provérbio', attributionStatus:'proverb', category:'consistência' },
  { id:41, text:'Aprender é como remar contra a corrente: quem para, retrocede.', author:'provérbio chinês', attributionStatus:'proverb', category:'consistência' },
  { id:42, text:'O melhor momento para plantar uma árvore foi há vinte anos. O segundo melhor é agora.', author:'provérbio', attributionStatus:'proverb', category:'preparação' },
  { id:43, text:'Diz-me e eu esqueço; ensina-me e eu lembro; envolve-me e eu aprendo.', author:'atribuída a Benjamin Franklin', attributionStatus:'attributed', category:'prática' },
  { id:44, text:'Um investimento em conhecimento paga os melhores juros.', author:'atribuída a Benjamin Franklin', attributionStatus:'attributed', category:'longo prazo' },
  { id:45, text:'Ao não se preparar, você está se preparando para falhar.', author:'atribuída a Benjamin Franklin', attributionStatus:'attributed', category:'preparação' },
  { id:46, text:'A leitura faz o homem completo; a conversa, ágil; e a escrita, exato.', author:'Francis Bacon', attributionStatus:'verified', category:'aprendizagem' },
  { id:47, text:'Se eu vi mais longe, foi por estar sobre ombros de gigantes.', author:'Isaac Newton', attributionStatus:'verified', category:'aprendizagem' },
  { id:48, text:'Nada na vida deve ser temido, somente compreendido. Agora é hora de compreender mais, para temer menos.', author:'Marie Curie', attributionStatus:'verified', category:'curiosidade' },
  { id:49, text:'Na vida, nada deve ser temido: tudo deve ser entendido.', author:'Marie Curie', attributionStatus:'attributed', category:'curiosidade' },
  { id:50, text:'A imaginação é mais importante que o conhecimento.', author:'Albert Einstein', attributionStatus:'attributed', category:'curiosidade' },
  { id:51, text:'Não tenho talento especial. Sou apenas apaixonadamente curioso.', author:'Albert Einstein', attributionStatus:'attributed', category:'curiosidade' },
  { id:52, text:'O importante é não parar de questionar.', author:'Albert Einstein', attributionStatus:'attributed', category:'curiosidade' },
  { id:53, text:'O gênio é um por cento de inspiração e noventa e nove por cento de transpiração.', author:'Thomas Edison', attributionStatus:'attributed', category:'esforço' },
  { id:54, text:'Não falhei. Apenas encontrei dez mil maneiras que não funcionam.', author:'atribuída a Thomas Edison', attributionStatus:'attributed', category:'erro' },
  { id:55, text:'A sorte favorece a mente preparada.', author:'Louis Pasteur', attributionStatus:'verified', category:'preparação' },
  { id:56, text:'Nossa maior fraqueza está em desistir. O caminho mais certo para vencer é tentar mais uma vez.', author:'atribuída a Thomas Edison', attributionStatus:'attributed', category:'persistência' },
  { id:57, text:'Aquele que move montanhas começa carregando pequenas pedras.', author:'provérbio chinês', attributionStatus:'proverb', category:'consistência' },
  { id:58, text:'Uma jornada de mil milhas começa com um único passo.', author:'Lao Tsé', attributionStatus:'attributed', category:'preparação' },
  { id:59, text:'Saber que se sabe o que se sabe, e que não se sabe o que não se sabe: eis o verdadeiro saber.', author:'Confúcio', attributionStatus:'attributed', category:'aprendizagem' },
  { id:60, text:'Aprender sem pensar é tempo perdido.', author:'Confúcio', attributionStatus:'attributed', category:'aprendizagem' },
  { id:61, text:'Não importa o quão devagar você vá, desde que não pare.', author:'atribuída a Confúcio', attributionStatus:'attributed', category:'persistência' },
  { id:62, text:'O homem que move uma montanha começa carregando as pedras menores.', author:'atribuída a Confúcio', attributionStatus:'attributed', category:'consistência' },
  { id:63, text:'A disciplina é a ponte entre metas e realizações.', author:'atribuída a Jim Rohn', attributionStatus:'attributed', category:'disciplina' },
  { id:64, text:'Educação é a arma mais poderosa que você pode usar para mudar o mundo.', author:'atribuída a Nelson Mandela', attributionStatus:'attributed', category:'aprendizagem' },
  { id:65, text:'Ninguém pode fazer você se sentir inferior sem o seu consentimento.', author:'atribuída a Eleanor Roosevelt', attributionStatus:'attributed', category:'persistência' },
  { id:66, text:'Quem tem um porquê enfrenta quase qualquer como.', author:'atribuída a Friedrich Nietzsche', attributionStatus:'attributed', category:'persistência' },
  { id:67, text:'A dúvida é o princípio da sabedoria.', author:'atribuída a Aristóteles', attributionStatus:'attributed', category:'curiosidade' },
  { id:68, text:'O que se aprende fazendo, aprende-se melhor.', author:'atribuída a Aristóteles', attributionStatus:'attributed', category:'prática' },
  { id:69, text:'A raiz da educação é amarga, mas o fruto é doce.', author:'atribuída a Aristóteles', attributionStatus:'attributed', category:'esforço' },
  { id:70, text:'Educar a mente sem educar o coração não é educar de forma alguma.', author:'atribuída a Aristóteles', attributionStatus:'attributed', category:'aprendizagem' },

  /* ---------- reflexões originais do Diário de Estudos ---------- */
  { id:71, text:'Uma hora bem estudada vale mais que três horas distraídas.', author:null, attributionStatus:'original', category:'foco' },
  { id:72, text:'O objetivo da revisão não é confirmar que você viu o conteúdo, mas descobrir o que ainda consegue recuperar.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:73, text:'Constância pequena ainda é constância.', author:null, attributionStatus:'original', category:'consistência' },
  { id:74, text:'A preparação reduz o trabalho que a pressa cria.', author:null, attributionStatus:'original', category:'preparação' },
  { id:75, text:'Reler é confortável. Tentar lembrar é útil.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:76, text:'Estudar sem revisar é encher um balde furado com paciência.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:77, text:'Quem estuda todo dia um pouco não precisa de heroísmo na véspera.', author:null, attributionStatus:'original', category:'consistência' },
  { id:78, text:'O plano existe para você não gastar energia decidindo o óbvio.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:79, text:'Não confunda reconhecer a resposta com saber produzi-la.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:80, text:'Errar durante o estudo é barato. Errar na hora que importa, não.', author:null, attributionStatus:'original', category:'erro' },
  { id:81, text:'Vinte minutos hoje valem mais que duas horas que nunca acontecem.', author:null, attributionStatus:'original', category:'consistência' },
  { id:82, text:'A dificuldade de hoje costuma ser o conteúdo que você vai dominar primeiro.', author:null, attributionStatus:'original', category:'esforço' },
  { id:83, text:'Um conteúdo que você adia por semanas custa mais caro quando volta.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:84, text:'Anotar não é aprender. Anotar é preparar o terreno.', author:null, attributionStatus:'original', category:'prática' },
  { id:85, text:'Estudar cansado tem retorno menor do que descansar e voltar.', author:null, attributionStatus:'original', category:'foco' },
  { id:86, text:'Se você não consegue explicar em voz alta, provavelmente ainda não entendeu.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:87, text:'Quem estuda tudo ao mesmo tempo costuma não terminar nada.', author:null, attributionStatus:'original', category:'foco' },
  { id:88, text:'A meta semanal existe para orientar, não para punir.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:89, text:'Perder um dia não apaga o mês inteiro.', author:null, attributionStatus:'original', category:'persistência' },
  { id:90, text:'Comece pelo que está atrasado, não pelo que é mais confortável.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:91, text:'Esquecer faz parte. Reagendar a revisão também.', author:null, attributionStatus:'original', category:'paciência' },
  { id:92, text:'Cada revisão bem feita compra semanas de memória.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:93, text:'O material perfeito não existe. O estudo feito existe.', author:null, attributionStatus:'original', category:'prática' },
  { id:94, text:'Antes de começar, decida quando vai parar.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:95, text:'Um tópico difícil merece mais encontros curtos, não um encontro longo.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:96, text:'Você não precisa de motivação diária. Precisa de um próximo passo claro.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:97, text:'A pergunta certa na hora do estudo economiza horas depois.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:98, text:'Quem revisa no dia certo estuda menos e lembra mais.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:99, text:'Grifar o livro inteiro é decidir não escolher nada.', author:null, attributionStatus:'original', category:'foco' },
  { id:100, text:'Aprender é notar a diferença entre o que você achava que sabia e o que sabe.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:101, text:'A sessão curta que você faz vence a sessão ideal que você imagina.', author:null, attributionStatus:'original', category:'prática' },
  { id:102, text:'Estudar é um ofício: melhora com repetição orientada.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:103, text:'Se toda matéria é urgente, nenhuma é prioritária.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:104, text:'Registre a sessão: a memória do esforço é pior que a memória do conteúdo.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:105, text:'O melhor plano é aquele que você consegue cumprir numa semana ruim.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:106, text:'Descobrir uma lacuna é progresso, não fracasso.', author:null, attributionStatus:'original', category:'erro' },
  { id:107, text:'Estudar com o celular ao lado é estudar pela metade.', author:null, attributionStatus:'original', category:'foco' },
  { id:108, text:'Consistência é o que transforma esforço em resultado.', author:null, attributionStatus:'original', category:'consistência' },
  { id:109, text:'Adiar o conteúdo difícil aumenta o tamanho dele.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:110, text:'Quem sabe onde parou perde menos tempo para recomeçar.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:111, text:'A prova mede o que você recupera, não o que você reconheceu no livro.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:112, text:'Estude como se fosse explicar amanhã.', author:null, attributionStatus:'original', category:'prática' },
  { id:113, text:'Repetir o que já é fácil é descanso disfarçado de estudo.', author:null, attributionStatus:'original', category:'esforço' },
  { id:114, text:'Ritmo sustentável vence intensidade irregular.', author:null, attributionStatus:'original', category:'consistência' },
  { id:115, text:'O tempo que você não planeja é o tempo que você perde.', author:null, attributionStatus:'original', category:'tempo' },
  { id:116, text:'Uma boa revisão incomoda um pouco. Esse incômodo é o aprendizado acontecendo.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:117, text:'Não existe estudo perdido, existe estudo não revisado.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:118, text:'Divida o conteúdo até o primeiro pedaço parecer fácil de começar.', author:null, attributionStatus:'original', category:'preparação' },
  { id:119, text:'Cansaço não é sinal de aprendizado. Recuperação é.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:120, text:'Você não precisa dominar hoje. Precisa voltar amanhã.', author:null, attributionStatus:'original', category:'paciência' },
  { id:121, text:'Estudar pouco e sempre supera estudar muito e raramente.', author:null, attributionStatus:'original', category:'consistência' },
  { id:122, text:'A melhor técnica é aquela que você realmente usa.', author:null, attributionStatus:'original', category:'prática' },
  { id:123, text:'Avaliar honestamente como foi a revisão vale mais que fingir que foi bem.', author:null, attributionStatus:'original', category:'erro' },
  { id:124, text:'Ninguém aprende tudo de uma vez, e ninguém precisa.', author:null, attributionStatus:'original', category:'paciência' },
  { id:125, text:'Um cronograma rígido demais quebra na primeira semana atípica.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:126, text:'Feche as abas que não têm nada a ver com o que você decidiu estudar.', author:null, attributionStatus:'original', category:'foco' },
  { id:127, text:'Escrever o que lembra antes de abrir o material revela o que realmente ficou.', author:null, attributionStatus:'original', category:'prática' },
  { id:128, text:'Todo conteúdo parece fácil enquanto está aberto na sua frente.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:129, text:'Comparar seu ritmo com o dos outros raramente ensina alguma coisa.', author:null, attributionStatus:'original', category:'paciência' },
  { id:130, text:'Estudar bem é decidir bem onde colocar a próxima hora.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:131, text:'O silêncio de trinta minutos rende mais que duas horas interrompidas.', author:null, attributionStatus:'original', category:'foco' },
  { id:132, text:'Se o conteúdo não volta nunca, ele não foi aprendido: foi visitado.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:133, text:'Registrar dificuldade não é reclamar: é deixar um recado para o seu eu futuro.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:134, text:'Quem só estuda o que gosta chega torto na prova.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:135, text:'Todo plano precisa de uma folga, senão ele só funciona em semanas perfeitas.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:136, text:'Você aprende mais corrigindo um erro do que acertando dez vezes o fácil.', author:null, attributionStatus:'original', category:'erro' },
  { id:137, text:'A primeira revisão é a mais barata e a mais esquecida.', author:null, attributionStatus:'original', category:'preparação' },
  { id:138, text:'Estudar em pé, andando ou anotando: o formato importa menos que a recuperação.', author:null, attributionStatus:'original', category:'prática' },
  { id:139, text:'Persistir não é insistir no mesmo erro; é ajustar e continuar.', author:null, attributionStatus:'original', category:'persistência' },
  { id:140, text:'Uma meta que você nunca alcança deixa de ser meta e vira ruído.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:141, text:'Parar no meio de um assunto difícil facilita retomar depois.', author:null, attributionStatus:'original', category:'prática' },
  { id:142, text:'Não existe memória sem esquecimento. Existe revisão no momento certo.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:143, text:'O conteúdo que você mais adia é geralmente o que mais cai.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:144, text:'Estudar com propósito reduz o tempo necessário pela metade.', author:null, attributionStatus:'original', category:'foco' },
  { id:145, text:'Quem mede o próprio estudo descobre coisas que a sensação escondia.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:146, text:'Aprender é um processo lento que parece rápido quando olhamos para trás.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:147, text:'Não confie na sensação de fluência: ela some quando o livro fecha.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:148, text:'Comece pelo mais difícil enquanto a cabeça está descansada.', author:null, attributionStatus:'original', category:'preparação' },
  { id:149, text:'A disciplina é o que sustenta você nos dias sem vontade.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:150, text:'Estudar menos com atenção total é melhor que estudar muito pela metade.', author:null, attributionStatus:'original', category:'foco' },
  { id:151, text:'O progresso invisível de hoje é o resultado visível de daqui a três meses.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:152, text:'Se você acertou sem pensar, talvez ainda esteja só reconhecendo.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:153, text:'Um resumo escrito de memória vale mais que dez resumos copiados.', author:null, attributionStatus:'original', category:'prática' },
  { id:154, text:'Descanso também é parte do método.', author:null, attributionStatus:'original', category:'paciência' },
  { id:155, text:'A pior sessão é aquela que você não começou.', author:null, attributionStatus:'original', category:'prática' },
  { id:156, text:'Planejar demais é uma forma elegante de adiar.', author:null, attributionStatus:'original', category:'preparação' },
  { id:157, text:'Revisar é conversar com o que você foi ontem.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:158, text:'Ter o material organizado não é ter o conteúdo aprendido.', author:null, attributionStatus:'original', category:'prática' },
  { id:159, text:'Estudar é um investimento cujo juro composto é a memória.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:160, text:'Quando não souber por onde começar, comece pelo que vence antes.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:161, text:'Cada tópico que você domina reduz o peso do que ainda falta.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:162, text:'O caderno bonito não estuda por você.', author:null, attributionStatus:'original', category:'prática' },
  { id:163, text:'Duas semanas de constância mudam a sensação do conteúdo inteiro.', author:null, attributionStatus:'original', category:'consistência' },
  { id:164, text:'A dúvida anotada hoje é a pergunta respondida amanhã.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:165, text:'Estudar bem é escolher o que não estudar agora.', author:null, attributionStatus:'original', category:'foco' },
  { id:166, text:'Todo grande conteúdo cabe em pedaços pequenos e repetidos.', author:null, attributionStatus:'original', category:'consistência' },
  { id:167, text:'A pressa engole detalhes; os detalhes é que derrubam na prova.', author:null, attributionStatus:'original', category:'paciência' },
  { id:168, text:'Você não precisa se sentir pronto para começar. Precisa começar para se sentir pronto.', author:null, attributionStatus:'original', category:'preparação' },
  { id:169, text:'Aprender rápido demais costuma significar esquecer rápido também.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:170, text:'O histórico de estudo é o espelho mais honesto que existe.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:171, text:'Se a revisão parece fácil demais, talvez o intervalo devesse ser maior.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:172, text:'Trabalhar com o que falta é melhor do que lamentar o que passou.', author:null, attributionStatus:'original', category:'persistência' },
  { id:173, text:'Um bom estudante não é o que nunca esquece, é o que volta a tempo.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:174, text:'Interromper para conferir o celular custa mais que os segundos gastos.', author:null, attributionStatus:'original', category:'foco' },
  { id:175, text:'Comece com o que você consegue manter por um mês.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:176, text:'Fazer exercícios revela buracos que a leitura esconde.', author:null, attributionStatus:'original', category:'prática' },
  { id:177, text:'Quem confunde volume com progresso acaba cansado e no mesmo lugar.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:178, text:'Um conteúdo revisado três vezes bem vale dez leituras apressadas.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:179, text:'Estudar é treinar a recuperação, não a exposição.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:180, text:'A constância protege você do humor do dia.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:181, text:'Dias ruins também contam, desde que você apareça.', author:null, attributionStatus:'original', category:'persistência' },
  { id:182, text:'Não peça perfeição de si mesmo antes de pedir presença.', author:null, attributionStatus:'original', category:'paciência' },
  { id:183, text:'Guarde tempo para revisar, não só para avançar.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:184, text:'Avançar sem revisar é construir andares sobre fundação incompleta.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:185, text:'A curiosidade é o combustível mais barato que existe.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:186, text:'Perguntar por que funciona ensina mais que decorar que funciona.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:187, text:'O erro corrigido vira conhecimento; o erro ignorado vira hábito.', author:null, attributionStatus:'original', category:'erro' },
  { id:188, text:'Nenhuma técnica compensa a falta de retorno ao conteúdo.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:189, text:'Um plano semanal claro evita decisões difíceis às onze da noite.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:190, text:'Se você só estuda quando está inspirado, estuda pouco.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:191, text:'Meia hora com atenção plena muda o dia inteiro de estudo.', author:null, attributionStatus:'original', category:'foco' },
  { id:192, text:'A memória gosta de encontros curtos e frequentes.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:193, text:'Marcar o conteúdo como difícil hoje ajuda o sistema a te ajudar amanhã.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:194, text:'Estudar com objetivo é diferente de estudar com ansiedade.', author:null, attributionStatus:'original', category:'foco' },
  { id:195, text:'Aprender leva tempo, e tempo não se negocia — se organiza.', author:null, attributionStatus:'original', category:'tempo' },
  { id:196, text:'O conteúdo que você explica sem gaguejar é o conteúdo que você sabe.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:197, text:'Quem anota o que não entendeu volta com um mapa; quem não anota, volta perdido.', author:null, attributionStatus:'original', category:'prática' },
  { id:198, text:'Nenhuma sessão é desperdiçada quando você sabe o que fez nela.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:199, text:'Trocar de matéria a cada cinco minutos é conversar sem ouvir.', author:null, attributionStatus:'original', category:'foco' },
  { id:200, text:'Comece devagar. Continue simples. Não pare.', author:null, attributionStatus:'original', category:'consistência' },
  { id:201, text:'Planejar a semana leva dez minutos e devolve horas.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:202, text:'A memória é reconstruída, não fotografada — por isso ela precisa de treino.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:203, text:'Fechar o material e tentar lembrar é o momento em que o estudo começa de verdade.', author:null, attributionStatus:'original', category:'prática' },
  { id:204, text:'Quem estuda com pressa relê; quem estuda com método recupera.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:205, text:'Não meça o estudo pelo tamanho do resumo, mas pelo que sobra sem ele.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:206, text:'Uma semana ruim não invalida um semestre bem construído.', author:null, attributionStatus:'original', category:'persistência' },
  { id:207, text:'Organize o material uma vez para não reorganizar toda semana.', author:null, attributionStatus:'original', category:'preparação' },
  { id:208, text:'A revisão atrasada é mais cara, mas continua valendo a pena.', author:null, attributionStatus:'original', category:'paciência' },
  { id:209, text:'O que você entende hoje precisa de encontros futuros para virar memória.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:210, text:'Interesse genuíno faz o conteúdo grudar sem esforço extra.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:211, text:'Evite estudar de forma que só funcione quando tudo está perfeito.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:212, text:'Estudar é escolher, repetidamente, o que merece sua atenção agora.', author:null, attributionStatus:'original', category:'foco' },
  { id:213, text:'A sensação de que você sabe é a última coisa em que confiar.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:214, text:'Repetir em voz alta expõe o que a leitura silenciosa escondia.', author:null, attributionStatus:'original', category:'prática' },
  { id:215, text:'Um pouco de dificuldade durante o estudo é sinal de que está funcionando.', author:null, attributionStatus:'original', category:'esforço' },
  { id:216, text:'Prefira terminar um tópico a começar quatro.', author:null, attributionStatus:'original', category:'foco' },
  { id:217, text:'Quem planeja folgas cumpre mais planos.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:218, text:'A disciplina não é sofrimento: é ter decidido antes de precisar decidir.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:219, text:'Anote a data em que entendeu algo difícil; você vai gostar de reler isso.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:220, text:'Não existe atalho, mas existe caminho mais organizado.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:221, text:'Estudar cinco dias por semana é melhor que estudar sete e desistir no mês seguinte.', author:null, attributionStatus:'original', category:'consistência' },
  { id:222, text:'Você só percebe o quanto avançou quando revisa o começo.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:223, text:'Conteúdo entendido e não praticado evapora.', author:null, attributionStatus:'original', category:'prática' },
  { id:224, text:'A melhor hora para estudar é a hora que você consegue sustentar toda semana.', author:null, attributionStatus:'original', category:'consistência' },
  { id:225, text:'Comparar-se com ontem é mais útil do que se comparar com qualquer outra pessoa.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:226, text:'Ter clareza do próximo passo é metade da motivação.', author:null, attributionStatus:'original', category:'preparação' },
  { id:227, text:'Um conteúdo revisado no limite do esquecimento fixa melhor.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:228, text:'Não estude para terminar a página; estude para conseguir explicar a página.', author:null, attributionStatus:'original', category:'prática' },
  { id:229, text:'Metas grandes demais viram desculpas pequenas.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:230, text:'Quem estuda para a semana inteira em um dia esquece na semana seguinte.', author:null, attributionStatus:'original', category:'consistência' },
  { id:231, text:'A repetição sem esforço ensina pouco; a recuperação com esforço ensina muito.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:232, text:'Dormir bem é parte do estudo, não pausa dele.', author:null, attributionStatus:'original', category:'paciência' },
  { id:233, text:'Se você trava ao explicar, encontrou exatamente onde estudar.', author:null, attributionStatus:'original', category:'erro' },
  { id:234, text:'Um cronômetro simples resolve metade dos problemas de dispersão.', author:null, attributionStatus:'original', category:'foco' },
  { id:235, text:'Fazer o básico todos os dias supera fazer o avançado uma vez por mês.', author:null, attributionStatus:'original', category:'consistência' },
  { id:236, text:'Os tópicos que você evita são os que mais precisam de você.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:237, text:'Estudo sem registro vira sensação; com registro, vira informação.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:238, text:'Aprender é aceitar ser iniciante muitas vezes seguidas.', author:null, attributionStatus:'original', category:'paciência' },
  { id:239, text:'A revisão de cinco minutos que você faz vale mais que a de trinta que você planeja.', author:null, attributionStatus:'original', category:'prática' },
  { id:240, text:'Escolher bem a próxima hora é mais importante que estender a hora atual.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:241, text:'Conteúdos parecidos confundem menos quando são praticados juntos.', author:null, attributionStatus:'original', category:'prática' },
  { id:242, text:'Todo assunto fica mais simples depois do terceiro encontro.', author:null, attributionStatus:'original', category:'persistência' },
  { id:243, text:'Você não está atrasado: está no ponto em que o seu esforço te trouxe.', author:null, attributionStatus:'original', category:'paciência' },
  { id:244, text:'Se a matéria é longa, o segredo é começar cedo, não correr no fim.', author:null, attributionStatus:'original', category:'preparação' },
  { id:245, text:'Estudar bem cansa menos do que estudar mal por mais tempo.', author:null, attributionStatus:'original', category:'foco' },
  { id:246, text:'Nem toda leitura é estudo; nem todo estudo é leitura.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:247, text:'Marcar o que ainda não domina é mais honesto que marcar o que já sabe.', author:null, attributionStatus:'original', category:'erro' },
  { id:248, text:'Um bom dia de estudo geralmente começou na noite anterior.', author:null, attributionStatus:'original', category:'preparação' },
  { id:249, text:'Quem estuda por objetivos claros desiste menos.', author:null, attributionStatus:'original', category:'persistência' },
  { id:250, text:'Manter o hábito é mais difícil e mais valioso que começar.', author:null, attributionStatus:'original', category:'consistência' },
  { id:251, text:'Cada revisão é uma pequena prova sem consequências.', author:null, attributionStatus:'original', category:'prática' },
  { id:252, text:'Sem descanso, o estudo continua acontecendo, mas para de render.', author:null, attributionStatus:'original', category:'paciência' },
  { id:253, text:'Dominar não é nunca errar: é errar menos e recuperar mais rápido.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:254, text:'A quantidade de horas impressiona; a distribuição delas é que ensina.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:255, text:'Um plano que ignora sua rotina real já nasce quebrado.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:256, text:'Estude o suficiente para conseguir dormir tranquilo, não para provar sofrimento.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:257, text:'Tentar lembrar e falhar ensina mais que ler e concordar.', author:null, attributionStatus:'original', category:'erro' },
  { id:258, text:'A memória responde melhor ao ritmo do que à intensidade.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:259, text:'Se você não sabe o que revisar, é sinal de que precisa registrar mais.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:260, text:'Fazer pouco hoje mantém a porta aberta para fazer mais amanhã.', author:null, attributionStatus:'original', category:'consistência' },
  { id:261, text:'O conhecimento antigo pede menos tempo, mas ainda pede atenção.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:262, text:'Estudar é transformar informação disponível em conhecimento recuperável.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:263, text:'Não tente estudar perfeito; tente estudar de novo.', author:null, attributionStatus:'original', category:'persistência' },
  { id:264, text:'Uma boa pergunta economiza três leituras.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:265, text:'A dificuldade percebida é um dado, não um veredito.', author:null, attributionStatus:'original', category:'erro' },
  { id:266, text:'Quem estuda cedo tem o resto do dia para esquecer com calma e revisar depois.', author:null, attributionStatus:'original', category:'tempo' },
  { id:267, text:'O objetivo não é estudar mais, é precisar estudar melhor.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:268, text:'Uma trilha clara vence a vontade momentânea.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:269, text:'O conteúdo não some porque você é ruim: some porque a memória funciona assim.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:270, text:'Marque o que ficou pela metade: recomeçar do zero custa caro.', author:null, attributionStatus:'original', category:'preparação' },
  { id:271, text:'A curiosidade sobrevive melhor quando você não se cobra perfeição.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:272, text:'Fazer exercícios antes de se sentir pronto acelera o aprendizado.', author:null, attributionStatus:'original', category:'prática' },
  { id:273, text:'Cada hora registrada é um argumento contra a sensação de que você não fez nada.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:274, text:'Estudo constante transforma prova em conferência, não em descoberta.', author:null, attributionStatus:'original', category:'preparação' },
  { id:275, text:'Não confunda ocupado com produtivo.', author:null, attributionStatus:'original', category:'foco' },
  { id:276, text:'Esforço bem direcionado cansa menos que esforço espalhado.', author:null, attributionStatus:'original', category:'esforço' },
  { id:277, text:'Voltar a um assunto antigo costuma ser mais rápido do que você imagina.', author:null, attributionStatus:'original', category:'paciência' },
  { id:278, text:'Decorar sem entender dura pouco; entender sem revisar dura pouco também.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:279, text:'Estude como quem constrói, não como quem empilha.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:280, text:'A rotina tira do estudo o peso da decisão diária.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:281, text:'Anotar em suas próprias palavras já é metade de aprender.', author:null, attributionStatus:'original', category:'prática' },
  { id:282, text:'Quando bater o desânimo, reduza o tamanho da sessão, não abandone o dia.', author:null, attributionStatus:'original', category:'persistência' },
  { id:283, text:'A clareza do objetivo determina a qualidade do esforço.', author:null, attributionStatus:'original', category:'foco' },
  { id:284, text:'Pequenos ajustes semanais superam grandes reformas anuais.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:285, text:'O conteúdo difícil merece o seu melhor horário, não as suas sobras.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:286, text:'Aprender exige tolerar um período em que nada parece fazer sentido.', author:null, attributionStatus:'original', category:'paciência' },
  { id:287, text:'Quem revisa cedo demais perde tempo; quem revisa tarde demais recomeça.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:288, text:'Confie no processo, mas confira os resultados.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:289, text:'Ler duas vezes é conforto. Escrever de memória é treino.', author:null, attributionStatus:'original', category:'prática' },
  { id:290, text:'Estudar bem é reduzir o número de coisas que competem pela sua atenção.', author:null, attributionStatus:'original', category:'foco' },
  { id:291, text:'Nenhum conteúdo é chato depois que você entende para que ele serve.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:292, text:'A constância é discreta: só aparece nos resultados.', author:null, attributionStatus:'original', category:'consistência' },
  { id:293, text:'Guardar cinco minutos para anotar o que aprendeu multiplica o valor da sessão.', author:null, attributionStatus:'original', category:'prática' },
  { id:294, text:'Terminar o dia sabendo o que fazer amanhã é meio caminho andado.', author:null, attributionStatus:'original', category:'preparação' },
  { id:295, text:'O estudo de longo prazo é feito de decisões pequenas e repetidas.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:296, text:'Não se cobre por dias perdidos; cobre-se por semanas abandonadas.', author:null, attributionStatus:'original', category:'persistência' },
  { id:297, text:'A prática espaçada parece mais lenta e é mais duradoura.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:298, text:'Cada erro registrado é um atalho oferecido ao seu eu futuro.', author:null, attributionStatus:'original', category:'erro' },
  { id:299, text:'O tempo passa de qualquer forma; a diferença é o que fica depois.', author:null, attributionStatus:'original', category:'tempo' },
  { id:300, text:'Estudar é um contrato silencioso com a pessoa que você quer ser.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:301, text:'Ninguém revisa tudo. Revise o que mais custa esquecer.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:302, text:'Sessões curtas e frequentes constroem o que maratonas raramente sustentam.', author:null, attributionStatus:'original', category:'consistência' },
  { id:303, text:'A vontade vem depois do início, quase nunca antes.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:304, text:'Um tópico dominado hoje ainda pede visitas ocasionais.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:305, text:'Escrever o que ficou confuso é mais produtivo que reler tudo.', author:null, attributionStatus:'original', category:'prática' },
  { id:306, text:'A melhor métrica é a que muda o seu comportamento na semana seguinte.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:307, text:'Quem sabe o que falta estuda com menos ansiedade.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:308, text:'Aprender é confortável no fim e desconfortável no meio.', author:null, attributionStatus:'original', category:'esforço' },
  { id:309, text:'Prefira dez minutos honestos a uma hora fingida.', author:null, attributionStatus:'original', category:'foco' },
  { id:310, text:'Cada conteúdo tem um ritmo próprio; respeite-o sem abandoná-lo.', author:null, attributionStatus:'original', category:'paciência' },
  { id:311, text:'Estudar em ordem aleatória confunde; em ordem rígida, engessa.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:312, text:'Uma pergunta que você não sabe responder é um mapa do que estudar.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:313, text:'O maior inimigo do estudo raramente é a dificuldade: é a interrupção.', author:null, attributionStatus:'original', category:'foco' },
  { id:314, text:'Pequeno e diário derrota grande e ocasional.', author:null, attributionStatus:'original', category:'consistência' },
  { id:315, text:'Você aprende quando o cérebro trabalha, não quando os olhos passam.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:316, text:'Não espere sentir-se produtivo para produzir.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:317, text:'Ter menos matérias abertas ao mesmo tempo reduz o cansaço mental.', author:null, attributionStatus:'original', category:'foco' },
  { id:318, text:'A revisão é o momento em que o estudo antigo paga dividendos.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:319, text:'Desistir de um método não é desistir do objetivo.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:320, text:'Transformar dúvida em pergunta escrita já organiza metade do raciocínio.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:321, text:'O plano serve ao estudo, não o contrário.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:322, text:'Não julgue a sessão pelo humor; julgue pelo que ficou registrado.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:323, text:'É melhor entender três exemplos do que decorar dez definições.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:324, text:'Constância não exige entusiasmo, apenas presença.', author:null, attributionStatus:'original', category:'consistência' },
  { id:325, text:'A memória esquece o que nunca foi cobrada a lembrar.', author:null, attributionStatus:'original', category:'prática' },
  { id:326, text:'Ajuste o plano quando a vida mudar; abandoná-lo é outra coisa.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:327, text:'Aprender bem hoje é economizar tempo em todos os dias seguintes.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:328, text:'Se o assunto parece impossível, o pedaço escolhido ainda está grande demais.', author:null, attributionStatus:'original', category:'preparação' },
  { id:329, text:'Quem estuda com método troca ansiedade por previsibilidade.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:330, text:'Respeitar o próprio limite é o que permite continuar amanhã.', author:null, attributionStatus:'original', category:'paciência' },
  { id:331, text:'Nada substitui o ato de tentar responder antes de conferir.', author:null, attributionStatus:'original', category:'prática' },
  { id:332, text:'Um bom estudante coleciona dúvidas resolvidas, não páginas lidas.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:333, text:'O progresso costuma ser silencioso até virar evidente.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:334, text:'Estudar sem meta é caminhar sem destino: cansa igual, chega menos.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:335, text:'Feche a sessão anotando onde recomeçar.', author:null, attributionStatus:'original', category:'preparação' },
  { id:336, text:'Todo esforço bem distribuído parece menor do que foi.', author:null, attributionStatus:'original', category:'esforço' },
  { id:337, text:'O que você pratica é o que você se torna capaz de fazer.', author:null, attributionStatus:'original', category:'prática' },
  { id:338, text:'Se estudar virou sofrimento constante, o problema costuma ser o método.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:339, text:'Aprender exige coragem de ficar confuso por um tempo.', author:null, attributionStatus:'original', category:'paciência' },
  { id:340, text:'Escolher três prioridades da semana já organiza o resto.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:341, text:'A memória de longo prazo é construída por visitas, não por mudanças.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:342, text:'Estudar é menos sobre inteligência e mais sobre retorno ao conteúdo.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:343, text:'Uma boa sessão termina com você sabendo o que ainda não sabe.', author:null, attributionStatus:'original', category:'erro' },
  { id:344, text:'Comece pelo que você entende e avance até onde trava.', author:null, attributionStatus:'original', category:'preparação' },
  { id:345, text:'A rotina é um empréstimo de disciplina para os dias difíceis.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:346, text:'Ler rápido é habilidade; lembrar depois é o objetivo.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:347, text:'Os melhores resultados vêm de sistemas simples repetidos por muito tempo.', author:null, attributionStatus:'original', category:'consistência' },
  { id:348, text:'Se você adiou de novo, reduza a tarefa até ela caber no seu dia.', author:null, attributionStatus:'original', category:'persistência' },
  { id:349, text:'A pausa planejada protege as horas seguintes.', author:null, attributionStatus:'original', category:'foco' },
  { id:350, text:'Marcar um conteúdo como difícil é pedir ajuda ao seu próprio sistema.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:351, text:'Você não precisa gostar do assunto para estudá-lo bem.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:352, text:'Quem revisa antes de esquecer completamente gasta menos energia.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:353, text:'Muitos resumos e pouca prática produzem confiança sem competência.', author:null, attributionStatus:'original', category:'prática' },
  { id:354, text:'Estudar com intenção de ensinar muda tudo o que você percebe.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:355, text:'Um plano flexível sobrevive; um plano perfeito quebra.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:356, text:'Melhor terminar sem brilho do que abandonar com estilo.', author:null, attributionStatus:'original', category:'persistência' },
  { id:357, text:'A atenção é o recurso mais escasso de qualquer estudante.', author:null, attributionStatus:'original', category:'foco' },
  { id:358, text:'Progresso é conseguir hoje o que travava você há um mês.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:359, text:'Não adianta apressar a memória: ela cobra o intervalo dela.', author:null, attributionStatus:'original', category:'paciência' },
  { id:360, text:'Todo tempo dedicado à organização deve devolver tempo ao estudo.', author:null, attributionStatus:'original', category:'preparação' },
  { id:361, text:'Recuperar é mais difícil que reconhecer — e é exatamente por isso que ensina.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:362, text:'Fazer a parte chata primeiro deixa o resto mais leve.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:363, text:'Aprender algo difícil é uma sequência de pequenas rendições ao esforço.', author:null, attributionStatus:'original', category:'esforço' },
  { id:364, text:'O dia que você quase não estudou ainda conta mais que o dia que não estudou.', author:null, attributionStatus:'original', category:'consistência' },
  { id:365, text:'Revisar é lembrar de propósito antes de precisar lembrar por obrigação.', author:null, attributionStatus:'original', category:'preparação' },
  { id:366, text:'Estude hoje o que você não quer improvisar depois.', author:null, attributionStatus:'original', category:'preparação' },
  { id:367, text:'Um erro entendido vale por vários acertos automáticos.', author:null, attributionStatus:'original', category:'erro' },
  { id:368, text:'A memória prefere encontros espaçados a maratonas apertadas.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:369, text:'Quem registra o próprio estudo para de discutir com a própria sensação.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:370, text:'Escolher menos matérias por dia é escolher lembrar mais.', author:null, attributionStatus:'original', category:'foco' },
  { id:371, text:'Todo conteúdo tem um primeiro passo pequeno; encontre-o.', author:null, attributionStatus:'original', category:'preparação' },
  { id:372, text:'Estudar por prazer e estudar por meta podem conviver.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:373, text:'O acúmulo de revisões diminui quando você revisa um pouco todo dia.', author:null, attributionStatus:'original', category:'consistência' },
  { id:374, text:'Confiança sem checagem costuma ser só familiaridade.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:375, text:'Quem ajusta o plano toda semana raramente precisa refazê-lo do zero.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:376, text:'Não confunda começar de novo com nunca ter avançado.', author:null, attributionStatus:'original', category:'persistência' },
  { id:377, text:'Estudar em silêncio por meia hora é um luxo acessível.', author:null, attributionStatus:'original', category:'foco' },
  { id:378, text:'Cada tópico revisado no prazo é um problema a menos na véspera.', author:null, attributionStatus:'original', category:'preparação' },
  { id:379, text:'Se o conteúdo sai fácil da cabeça, ele ainda não entrou direito.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:380, text:'Estudar é um hábito que se protege, não um humor que se espera.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:381, text:'A paciência não é lentidão: é aceitar o tempo que o aprendizado exige.', author:null, attributionStatus:'original', category:'paciência' },
  { id:382, text:'Pequenas melhorias no método rendem mais que grandes aumentos de horas.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:383, text:'Praticar recuperar é praticar exatamente o que a prova pede.', author:null, attributionStatus:'original', category:'prática' },
  { id:384, text:'Um bom sistema devolve o tempo que você gastou montando ele.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:385, text:'A vontade oscila; o horário marcado não.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:386, text:'Reservar tempo para revisar é reservar tempo para não reaprender.', author:null, attributionStatus:'original', category:'tempo' },
  { id:387, text:'A curiosidade transforma obrigação em investigação.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:388, text:'Errar cedo é mais barato do que errar tarde.', author:null, attributionStatus:'original', category:'erro' },
  { id:389, text:'O conhecimento que você usa é o que permanece.', author:null, attributionStatus:'original', category:'prática' },
  { id:390, text:'Adiar decisões pequenas consome a energia das decisões importantes.', author:null, attributionStatus:'original', category:'foco' },
  { id:391, text:'Estudar bem em uma hora exige decidir antes o que fazer nela.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:392, text:'A régua certa é o seu progresso, não o calendário dos outros.', author:null, attributionStatus:'original', category:'paciência' },
  { id:393, text:'Persistência é voltar depois da interrupção, não nunca ser interrompido.', author:null, attributionStatus:'original', category:'persistência' },
  { id:394, text:'Quem revisa com honestidade acelera; quem revisa por formalidade, não.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:395, text:'O caderno serve para pensar, não só para guardar.', author:null, attributionStatus:'original', category:'prática' },
  { id:396, text:'Conhecimento acumulado sem organização vira peso.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:397, text:'Cada retomada fica mais rápida que a anterior.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:398, text:'Aprender é reduzir, aos poucos, a distância entre ler e conseguir explicar.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:399, text:'Nenhum recomeço é do zero quando existe histórico.', author:null, attributionStatus:'original', category:'persistência' },
  { id:400, text:'Estude hoje uma hora que amanhã agradeça.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:401, text:'A revisão bem colocada é o que separa estudar de ter estudado.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:402, text:'Quem organiza o conteúdo antes de estudar perde menos tempo dentro dele.', author:null, attributionStatus:'original', category:'preparação' },
  { id:403, text:'Não existe método único; existe método ajustado ao conteúdo.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:404, text:'Escutar uma explicação é fácil; reproduzi-la é a prova real.', author:null, attributionStatus:'original', category:'prática' },
  { id:405, text:'A disciplina de hoje é a liberdade de amanhã.', author:null, attributionStatus:'original', category:'disciplina' },
  { id:406, text:'Todo estudante avançado já foi alguém que não entendia o básico.', author:null, attributionStatus:'original', category:'paciência' },
  { id:407, text:'Registrar o tempo transforma intenção em evidência.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:408, text:'Estudar é escolher dificuldade agora para evitar dificuldade maior depois.', author:null, attributionStatus:'original', category:'esforço' },
  { id:409, text:'Quem entende o porquê esquece menos o como.', author:null, attributionStatus:'original', category:'curiosidade' },
  { id:410, text:'Um plano cumprido pela metade ainda é melhor que nenhum plano.', author:null, attributionStatus:'original', category:'planejamento' },
  { id:411, text:'A memória agradece intervalos; a ansiedade, não. Siga a memória.', author:null, attributionStatus:'original', category:'longo prazo' },
  { id:412, text:'Antes de buscar um método novo, tente aplicar bem o antigo.', author:null, attributionStatus:'original', category:'melhoria contínua' },
  { id:413, text:'A diferença entre saber e achar que sabe aparece quando o material fecha.', author:null, attributionStatus:'original', category:'aprendizagem' },
  { id:414, text:'Estudar é uma sequência de retornos, não uma linha reta.', author:null, attributionStatus:'original', category:'persistência' },
  { id:415, text:'Escolha o próximo tópico com a cabeça de hoje, não com a culpa de ontem.', author:null, attributionStatus:'original', category:'foco' },
  { id:416, text:'O tempo bem investido no básico sustenta todo o avançado.', author:null, attributionStatus:'original', category:'preparação' },
  { id:417, text:'Nem todo dia rende igual, e tudo bem: o que conta é a soma.', author:null, attributionStatus:'original', category:'consistência' },
  { id:418, text:'Aprender é permitir que a versão anterior de você esteja errada.', author:null, attributionStatus:'original', category:'erro' },
  { id:419, text:'Termine a sessão antes do cansaço decidir por você.', author:null, attributionStatus:'original', category:'paciência' },
  { id:420, text:'O melhor sistema de estudos é aquele que você ainda estará usando em seis meses.', author:null, attributionStatus:'original', category:'longo prazo' }
];

/* =========================================================================
   GUIAS DOS MÉTODOS DE REVISÃO
   Cada método tem: rótulo, frase de uma linha, passos e quando usar.
   ========================================================================= */
const REVIEW_METHOD_GUIDES = {
  active_recall: {
    label:'Recordação ativa',
    short:'Tente lembrar antes de olhar o material.',
    intro:'Você fecha o material e tenta recuperar o conteúdo de memória. Só depois confere.',
    steps:[
      'Não abra o material no começo.',
      'Tente recuperar o que lembra — em voz alta, escrevendo ou mentalmente.',
      'Perceba onde você travou: essas são as lacunas.',
      'Abra o material e confira.',
      'Corrija e reforce exatamente o que faltou.'
    ],
    good:'Serve para quase todo conteúdo. É o método padrão quando não há um melhor.'
  },
  exercises: {
    label:'Exercícios',
    short:'Resolva questões antes de olhar a resposta.',
    intro:'Você pratica resolvendo problemas, sem consultar a solução de imediato.',
    steps:[
      'Escolha algumas questões do assunto.',
      'Resolva sem consultar a resposta.',
      'Confira e observe onde errou.',
      'Revise apenas os pontos que geraram erro.'
    ],
    good:'Ideal para matérias de cálculo, lógica, questões de prova e conteúdo aplicado.'
  },
  explanation: {
    label:'Explicação',
    short:'Explique com palavras simples, como se ensinasse alguém.',
    intro:'Você tenta explicar o assunto do zero, sem jargão, como se a outra pessoa não soubesse nada.',
    steps:[
      'Escolha o conceito e explique em voz alta ou por escrito.',
      'Use palavras simples, evite decorar a frase do livro.',
      'Onde você travar ou ficar vago, existe uma lacuna.',
      'Volte ao material só nesses pontos e explique de novo.'
    ],
    good:'Excelente para conteúdo conceitual, teorias, processos e definições.'
  },
  memory_summary: {
    label:'Resumo de memória',
    short:'Escreva o que lembra antes de consultar.',
    intro:'Você escreve um resumo do assunto sem abrir nada. O material serve apenas para conferir depois.',
    steps:[
      'Pegue uma folha em branco.',
      'Escreva tudo que lembra sobre o tópico.',
      'Só então abra o material.',
      'Compare, complete o que faltou e destaque o que esqueceu.'
    ],
    good:'Bom para conteúdo extenso e para descobrir rapidamente o que ficou de fora.'
  },
  flashcards: {
    label:'Flashcards',
    short:'Pergunta de um lado, resposta do outro.',
    intro:'Você usa cartões com pergunta e resposta para treinar recuperação rápida de fatos.',
    steps:[
      'Use cartões de papel ou um aplicativo de flashcards da sua preferência.',
      'Leia a pergunta e responda antes de virar o cartão.',
      'Separe os que errou para repetir mais vezes.',
      'Registre aqui como foi a revisão quando terminar.'
    ],
    good:'Bom para vocabulário, fórmulas, datas, termos e definições curtas.',
    note:'O Diário não tem um sistema próprio de flashcards — ele agenda a revisão e você usa a ferramenta que preferir.'
  },
  interleaving: {
    label:'Prática intercalada',
    short:'Misture tipos de problema em vez de repetir só um.',
    intro:'Em vez de fazer vinte exercícios iguais, você mistura tipos parecidos e precisa decidir qual abordagem usar.',
    steps:[
      'Junte exercícios de dois ou três tipos relacionados.',
      'Embaralhe a ordem.',
      'Ao ler cada questão, decida primeiro qual método aplicar.',
      'Resolva e confira.'
    ],
    good:'Muito útil quando você acerta treinando, mas confunde os tipos na prova.'
  },
  free: {
    label:'Revisão livre',
    short:'Você escolhe como revisar.',
    intro:'Sem roteiro: use a abordagem que fizer mais sentido para este conteúdo hoje.',
    steps:[
      'Decida o que quer verificar neste tópico.',
      'Use a forma que preferir.',
      'Ao final, registre honestamente como foi.'
    ],
    good:'Para quando você já sabe o que precisa fazer e não quer um roteiro.'
  }
};

/* =========================================================================
   APRENDER A ESTUDAR — base educacional curta e integrada.
   Formato fixo: o que é · por que é útil · como fazer · exemplo · no Diário
   ========================================================================= */
const STUDY_GUIDES = [
  {
    id:'o-que-e-estudar', oneLine:'Estudar é trabalhar um conteúdo até conseguir usá-lo sem ter a fonte na frente.', title:'O que significa estudar?',
    summary:'Estudar é transformar informação disponível em conhecimento que você consegue recuperar depois.',
    keywords:'estudar significado aprender definicao',
    what:'Estudar não é passar os olhos por um conteúdo. É trabalhar o material até conseguir recuperá-lo e usá-lo sem ter a fonte na frente.',
    why:'Quem confunde "já vi isso" com "eu sei isso" costuma se surpreender na hora da prova ou da aplicação prática.',
    how:['Escolha um pedaço pequeno do conteúdo.','Entenda a lógica dele, não só as palavras.','Feche o material e tente reproduzir.','Confira, corrija e marque o que faltou.','Volte a esse conteúdo depois de alguns dias.'],
    example:'Ler três páginas sobre um tema e fechar o livro conseguindo explicar a ideia central com suas palavras é estudar. Reler as três páginas quatro vezes, não necessariamente.',
    inApp:'Cada vez que você registra uma sessão, o Diário guarda quanto tempo e em que conteúdo. Se houver tópico, ele também agenda a revisão.'
  },
  {
    id:'o-que-e-sessao', oneLine:'Sessão é um bloco de estudo que você registrou.', title:'O que é uma sessão?',
    summary:'É um bloco de estudo registrado: uma disciplina, um tempo e, de preferência, um tópico.',
    keywords:'sessao bloco estudo registro tempo',
    what:'Sessão é qualquer período em que você estudou algo e registrou. Pode ter 10 minutos ou duas horas.',
    why:'Registrar transforma sensação em informação. Sem registro, é impossível saber se você realmente estudou o que planejou.',
    how:['Use o botão Registrar.','Escolha a disciplina e, se possível, o tópico.','Use o cronômetro, ou lance os minutos depois.','Opcionalmente classifique o tipo e a dificuldade.'],
    example:'"Cálculo · Derivadas · 40 min · exercícios · difícil" é uma sessão bem registrada.',
    inApp:'As sessões alimentam o planejamento, as análises e as revisões. É o dado mais importante do sistema.'
  },
  {
    id:'o-que-e-revisao', oneLine:'Voltar a um conteúdo para verificar e reforçar o que você ainda consegue lembrar.', title:'O que é uma revisão?',
    summary:'É voltar a um conteúdo já estudado para testar o que você ainda consegue recuperar.',
    keywords:'revisao revisar voltar conteudo memoria',
    what:'Revisar é reencontrar o conteúdo depois de um intervalo, tentando lembrar antes de consultar.',
    why:'A memória enfraquece quando não é usada. Cada recuperação bem-sucedida fortalece o acesso àquele conteúdo.',
    how:['Espere um intervalo depois do primeiro estudo.','Tente recuperar sem olhar.','Confira.','Diga honestamente como foi.'],
    example:'Você estudou Derivadas na segunda. Na terça, antes de abrir o caderno, tenta lembrar a regra da cadeia. O que não vier, você confere.',
    inApp:'O Diário agenda a revisão sozinho e ajusta o próximo intervalo conforme a sua resposta.'
  },
  {
    id:'como-esquecemos', oneLine:'Esquecer é normal: sem retorno ao conteúdo, o acesso enfraquece com o tempo.', title:'Como a memória esquece',
    summary:'Perder acesso a uma informação com o tempo é normal — e previsível o bastante para ser planejado.',
    keywords:'esquecimento curva memoria esquecer retencao',
    what:'Depois de aprender algo, o acesso àquela informação tende a enfraquecer com o tempo, especialmente se você nunca mais a usa.',
    why:'Entender isso muda a forma de estudar: em vez de tentar "aprender de uma vez", você planeja reencontros.',
    how:['Aceite que esquecer não é falha pessoal.','Planeje voltar ao conteúdo em vez de tentar fixá-lo numa única sessão.','Quanto mais recente e frágil, mais cedo o retorno.'],
    example:'Um conteúdo visto uma única vez há dois meses costuma exigir quase um reestudo. O mesmo conteúdo revisado três vezes no período costuma voltar em poucos minutos.',
    inApp:'Os intervalos entre revisões existem justamente para pegar o conteúdo antes que ele fique difícil demais de recuperar.',
    caution:'Não existe um número universal de quanto se esquece em 24h — isso depende do conteúdo, do estudo e da pessoa. O que é consistente é a tendência: sem retorno, o acesso enfraquece.'
  },
  {
    id:'recuperacao-ativa', oneLine:'Tente lembrar antes de consultar — é o que mais fortalece a memória.', title:'O que é recuperação ativa',
    summary:'Tentar lembrar antes de consultar. É um dos hábitos com melhor retorno por minuto investido.',
    keywords:'recuperacao ativa active recall lembrar testar',
    what:'Recuperação ativa é tentar produzir a informação de memória, em vez de reler e reconhecer.',
    why:'O esforço de buscar na memória é o que fortalece a memória. Reler é confortável, mas o cérebro trabalha pouco.',
    how:['Feche o material.','Faça uma pergunta a si mesmo.','Responda antes de conferir.','Confira e corrija.'],
    example:'Estudou OSPF? Antes de abrir as anotações, pergunte: "como se formam as adjacências?". Responda e só então confira.',
    inApp:'Ao iniciar uma revisão, escolha o método Recordação ativa. O Diário mostra o roteiro curto.'
  },
  {
    id:'espacamento', oneLine:'Estudar o mesmo conteúdo em dias diferentes rende mais do que tudo de uma vez.', title:'O que é espaçamento',
    summary:'Distribuir o estudo ao longo do tempo em vez de concentrar tudo num dia só.',
    keywords:'espacamento spaced intervalo distribuir maratona',
    what:'Espaçamento é estudar o mesmo conteúdo em encontros separados por dias, em vez de repetir tudo numa sessão longa.',
    why:'O mesmo tempo total distribuído costuma render memória mais duradoura do que concentrado.',
    how:['Divida o conteúdo em partes.','Volte a cada parte em dias diferentes.','Aumente o intervalo conforme o conteúdo fica mais firme.'],
    example:'Quatro sessões de 30 minutos em quatro dias rendem mais que duas horas seguidas na véspera.',
    inApp:'É exatamente o que as estratégias de revisão fazem: escolhem quando o conteúdo deve voltar.'
  },
  {
    id:'reconhecer-x-lembrar', oneLine:'Reconhecer a resposta no papel não é o mesmo que conseguir produzi-la.', title:'Reconhecer não é lembrar',
    summary:'Ler a resposta e pensar "eu sabia" é diferente de conseguir produzi-la sem vê-la.',
    keywords:'reconhecer lembrar recuperar ilusao fluencia relendo',
    what:'Reconhecimento é identificar a informação quando ela está na sua frente. Recuperação é produzi-la do zero.',
    why:'A releitura cria uma sensação de domínio que some quando o material fecha. É a principal armadilha de quem estuda relendo.',
    how:['Sempre que sentir "isso eu já sei", feche o material e tente explicar.','Se não sair, você estava reconhecendo, não lembrando.'],
    example:'Você lê a definição de derivada e concorda com tudo. Depois, com a folha em branco, não consegue escrever a definição. Era reconhecimento.',
    inApp:'Por isso o resultado da revisão pergunta como foi lembrar, e não se você leu o conteúdo.'
  },
  {
    id:'revisao-nao-e-reler', oneLine:'Revisar é testar a memória, não passar os olhos de novo.', title:'Revisar não é reler',
    summary:'Revisão pode ser exercício, explicação, resumo de memória, flashcards ou prática — não só leitura.',
    keywords:'reler releitura metodo revisao formas',
    what:'Muita gente entende revisão como "passar os olhos de novo". Isso é a forma mais confortável e geralmente a menos eficiente.',
    why:'O que fortalece a memória é o esforço de recuperar, não a exposição repetida ao texto.',
    how:['Escolha um método ativo: lembrar, explicar, resolver ou escrever de memória.','Use a leitura apenas para conferir depois.'],
    example:'Revisar Direito Constitucional pode ser responder "quais são os direitos fundamentais?" de memória, e só então conferir a lista.',
    inApp:'Cada revisão tem um método sugerido, com um roteiro curto. Você pode trocar o método quando quiser.'
  },
  {
    id:'exercicios-guia', oneLine:'Resolver questões mostra rápido o que você ainda não sabe.', title:'Exercícios',
    summary:'Praticar resolvendo é a forma mais direta de descobrir o que você não sabe.',
    keywords:'exercicios questoes pratica resolver problemas',
    what:'Resolver questões sem consultar a resposta de imediato, e usar os erros como mapa de estudo.',
    why:'Exercícios expõem lacunas que a leitura esconde, e treinam exatamente o que a prova cobra.',
    how:['Resolva antes de olhar a solução.','Marque o que errou.','Revise só os pontos dos erros.','Refaça depois de alguns dias.'],
    example:'Em vez de reler a teoria de integrais, resolva cinco integrais. Os erros mostram o que estudar.',
    inApp:'Classifique a sessão como "Exercícios" para acompanhar sua proporção entre teoria e prática nas Análises.'
  },
  {
    id:'intercalada-guia', oneLine:'Misturar tipos de problema treina escolher a abordagem, não só executá-la.', title:'Prática intercalada',
    summary:'Misturar tipos de problema em vez de treinar um tipo por vez.',
    keywords:'intercalada interleaving misturar blocos tipos',
    what:'Fazer exercícios de tipos diferentes misturados, forçando você a escolher a abordagem antes de resolver.',
    why:'Treinar um tipo por vez cria a ilusão de domínio: você já sabe o método antes de ler a questão. Na prova, isso não acontece.',
    how:['Junte dois ou três tipos relacionados.','Embaralhe.','Antes de resolver, identifique de que tipo é a questão.'],
    example:'Misture derivadas, integrais e limites numa mesma lista, em vez de fazer vinte de cada.',
    inApp:'Disciplinas marcadas como "Resolução de problemas" tendem a receber este método nas sugestões automáticas.'
  },
  {
    id:'explicacao-guia', oneLine:'Se você não consegue explicar com palavras simples, ainda não entendeu.', title:'Explicação (técnica de Feynman)',
    summary:'Explicar com palavras simples revela rapidamente onde está a lacuna.',
    keywords:'explicacao feynman ensinar simples explicar',
    what:'Explicar o conteúdo como se fosse para alguém que nunca ouviu falar dele, sem jargão e sem decorar frases.',
    why:'É muito difícil explicar algo que você não entendeu. Os pontos em que você trava ou fica vago são exatamente as lacunas.',
    how:['Escolha o conceito.','Explique em voz alta ou por escrito, com palavras simples.','Marque onde travou.','Volte ao material só nesses pontos.','Explique de novo.'],
    example:'Tente explicar o que é uma VLAN para alguém que não é da área. Se você só consegue repetir a definição do livro, ainda não entendeu.',
    inApp:'Escolha o método "Explicação" ao revisar. O roteiro aparece na tela.'
  },
  {
    id:'resumos-guia', oneLine:'Resumo escrito de memória ensina; resumo copiado, quase nada.', title:'Resumos',
    summary:'Resumo escrito de memória ensina; resumo copiado, quase nada.',
    keywords:'resumo resumir anotacoes copiar memoria',
    what:'Escrever de forma condensada o que você entendeu — de preferência sem olhar o material.',
    why:'Copiar trechos é uma tarefa quase mecânica. Escrever de memória obriga a recuperar e organizar.',
    how:['Primeiro escreva o que lembra.','Depois abra o material.','Complete o que faltou com outra cor ou marcação.','Guarde o resumo para revisões futuras.'],
    example:'Um resumo de meia página feito de memória vale mais que cinco páginas copiadas do livro.',
    inApp:'Use o método "Resumo de memória" nas revisões. Registre no comentário da sessão o que ficou de fora.'
  },
  {
    id:'flashcards-guia', oneLine:'Cartões de pergunta e resposta, bons para fatos e definições curtas.', title:'Flashcards',
    summary:'Cartões com pergunta e resposta, bons para fatos e definições curtas.',
    keywords:'flashcards cartoes anki memorizar vocabulario',
    what:'Um cartão tem a pergunta de um lado e a resposta do outro. Você responde antes de virar.',
    why:'É recuperação ativa em formato rápido, e funciona bem para conteúdo que precisa ser lembrado literalmente.',
    how:['Faça cartões curtos, com uma ideia por cartão.','Responda antes de virar.','Repita mais os que errou.'],
    example:'Frente: "O que faz o protocolo ARP?" Verso: a resposta em uma frase.',
    inApp:'O Diário não tem um sistema próprio de flashcards. Ele agenda a revisão e você usa papel ou o aplicativo que preferir — depois registra como foi.'
  },
  {
    id:'pomodoro-guia', oneLine:'Pomodoro organiza sua atenção; não substitui revisar.', title:'Pomodoro',
    summary:'É uma técnica de gestão de atenção e tempo, não um método de memorização.',
    keywords:'pomodoro tempo atencao foco intervalos 25 minutos',
    what:'Trabalhar por um bloco fixo (tradicionalmente 25 minutos) e fazer uma pausa curta, repetindo o ciclo.',
    why:'Ajuda quem tem dificuldade de começar ou de sustentar atenção. Reduz a tentação de interromper a cada minuto.',
    how:['Escolha o que vai estudar antes de começar.','Estude o bloco inteiro sem interrupção.','Faça a pausa de verdade.','Repita.'],
    example:'Três blocos de 25 minutos com pausas curtas podem render mais que duas horas com celular ao lado.',
    inApp:'Você pode usar o cronômetro com blocos de 25 minutos se isso ajudar sua concentração. O Diário não obriga nenhum formato.',
    caution:'Pomodoro organiza a atenção. Ele não substitui recuperação ativa nem espaçamento — o que você faz dentro do bloco continua sendo o que determina o aprendizado.'
  },
  {
    id:'dificuldade-dominio-guia', oneLine:'Dificuldade é como a sessão pareceu; domínio é o quanto você retém.', title:'Dificuldade e domínio',
    summary:'Dificuldade é como a sessão pareceu; domínio é o quanto você está retendo ao longo do tempo.',
    keywords:'dificuldade dominio diferenca percepcao retencao',
    what:'Dificuldade é uma percepção informada por você em cada sessão. Domínio é calculado pelos resultados das suas revisões.',
    why:'São coisas diferentes: um conteúdo pode ser difícil e estar bem dominado, ou parecer fácil e escapar depois de duas semanas.',
    how:['Registre a dificuldade com honestidade.','Não tente "melhorar" o número: ele é só um dado.','Acompanhe o domínio nas revisões, não nas sessões.'],
    example:'Você acha Integrais difícil mas acerta todas as revisões: dificuldade alta, domínio alto.',
    inApp:'A dificuldade aparece nas Análises. O domínio aparece no tópico e define quando ele é considerado dominado.'
  },
  {
    id:'consistencia-guia', oneLine:'Aparecer com frequência vale mais do que aparecer com intensidade.', title:'Consistência',
    summary:'Frequência vence intensidade quando o objetivo é lembrar daqui a meses.',
    keywords:'consistencia constancia rotina frequencia habito',
    what:'Estudar com regularidade, mesmo em blocos pequenos, em vez de concentrar tudo em poucos dias.',
    why:'Espaçamento só é possível se você aparece com frequência. Além disso, um plano sustentável sobrevive a semanas ruins.',
    how:['Escolha uma carga semanal que você cumpre numa semana comum, não na melhor.','Prefira cinco dias de 40 minutos a um dia de quatro horas.','Aceite dias fracos sem abandonar a semana.'],
    example:'Trinta minutos por dia somam mais de 180 horas em um ano.',
    inApp:'O calendário nas Análises mostra seus dias ativos, e o plano semanal trabalha por semana justamente para não punir um dia perdido.'
  },
  {
    id:'descanso-guia', oneLine:'Sono e pausas fazem parte do estudo, não são interrupções dele.', title:'Descanso e atenção',
    summary:'Sono e pausas não são interrupções do estudo — fazem parte dele.',
    keywords:'descanso sono pausa atencao cansaco fadiga',
    what:'A capacidade de concentração é limitada e se recupera com pausas e sono adequado.',
    why:'Estudar exausto reduz a qualidade da recuperação e aumenta o tempo necessário para o mesmo resultado.',
    how:['Faça pausas curtas entre blocos.','Evite trocar a pausa por rolagem infinita de tela — isso cansa em vez de descansar.','Trate o sono como parte da rotina de estudo.'],
    example:'Duas horas descansado costumam render mais que quatro horas arrastadas de madrugada.',
    inApp:'Se as suas sessões estão ficando longas e a dificuldade percebida subindo, isso costuma aparecer nas Análises.'
  }
];

/* =========================================================================
   HELP CONTENT — conteúdo estático (nunca vai para o IndexedDB).
   Os textos descrevem o comportamento real da aplicação.
   ========================================================================= */
const HELP_CATEGORIES = [
  { id:'comecando',   label:'Começando' },
  { id:'estudando',   label:'Estudando' },
  { id:'planejamento',label:'Planejamento' },
  { id:'recomendacoes',label:'Recomendações' },
  { id:'revisoes',    label:'Revisões' },
  { id:'analises',    label:'Análises' },
  { id:'dados',       label:'Dados e privacidade' },
  { id:'atalhos',     label:'Atalhos e navegação' }
];

/**
 * content: blocos { p: texto } | { ul: [itens] } | { h: subtítulo }
 */
const HELP_ARTICLES = [
  /* ---------------- COMEÇANDO ---------------- */
  { id:'primeiros-passos', cat:'comecando', title:'Primeiros passos',
    summary:'O caminho mais curto entre abrir a plataforma e começar a estudar.',
    keywords:'inicio comecar primeiro uso tutorial introducao',
    content:[
      { p:'A plataforma organiza seus estudos em três níveis: área, disciplina e tópico. Em cima disso você define um plano semanal, registra as sessões e a plataforma cuida das revisões e das análises.' },
      { h:'O que fazer na primeira vez' },
      { ul:[
        'Cadastre pelo menos uma disciplina em Disciplinas (a área é opcional, serve só para agrupar).',
        'Adicione os tópicos dessa disciplina — são eles que entram no ciclo de revisão.',
        'Em Planejamento, informe quantas horas por semana você consegue estudar.',
        'Volte em Hoje e clique em Iniciar sessão na sugestão que aparecer.'
      ]},
      { p:'Não é preciso cadastrar tudo de uma vez. Você pode começar com uma disciplina e ir crescendo conforme usa.' }
    ] },

  { id:'organizar-estudos', cat:'comecando', title:'Como organizar meus estudos',
    summary:'A diferença entre área, disciplina e tópico, com exemplos.',
    keywords:'area disciplina topico hierarquia organizar estrutura',
    content:[
      { p:'A estrutura tem três níveis, do mais amplo para o mais específico:' },
      { ul:[
        'Área — o agrupamento maior. Ex.: Faculdade, Concurso, Idiomas, Música.',
        'Disciplina — o que você efetivamente estuda. Ex.: Cálculo, Direito Constitucional, Gramática, Violão.',
        'Tópico — o conteúdo dentro da disciplina. Ex.: Derivadas, Direitos fundamentais, Present Perfect, Escalas.'
      ]},
      { p:'A área é opcional. O tópico também — dá para registrar sessões sem escolher um. Mas os tópicos são o que permite acompanhar cobertura de conteúdo, domínio e revisão espaçada, então vale cadastrá-los.' }
    ] },

  { id:'criar-estrutura', cat:'comecando', title:'Como criar áreas, disciplinas e tópicos',
    summary:'Onde ficam os botões e o que cada campo significa.',
    keywords:'criar cadastrar adicionar area disciplina topico editar arquivar',
    content:[
      { h:'Áreas e disciplinas' },
      { p:'Na tela Disciplinas, use os botões + Área e + Disciplina no topo. A disciplina pede apenas nome, área e prioridade — o resto tem valores padrão que você ajusta depois em Opções avançadas.' },
      { h:'Tópicos' },
      { p:'Abra uma disciplina e use "+ adicionar tópico". Você pode colar vários de uma vez, um por linha, e todos são criados na ordem.' },
      { h:'Arquivar em vez de excluir' },
      { p:'Arquivar tira a disciplina ou o tópico do uso ativo (planejamento, recomendações e revisões) mas preserva todo o histórico. Excluir definitivamente apaga as sessões junto e fica disponível como ação secundária.' }
    ] },

  { id:'primeiro-plano', cat:'comecando', title:'Como montar meu primeiro planejamento',
    summary:'Poucas decisões: horas por semana, prioridade e mínimos.',
    keywords:'plano planejamento primeiro montar criar semanal horas',
    content:[
      { p:'Em Planejamento você informa quantas horas por semana pretende estudar. A plataforma distribui esse tempo entre as disciplinas ativas e você pode editar qualquer valor.' },
      { h:'Como montar um bom planejamento' },
      { ul:[
        'Comece com uma quantidade de horas que você realmente consegue cumprir. É melhor bater uma meta modesta do que falhar uma ambiciosa.',
        'Use prioridade máxima apenas para o que realmente merece. Se tudo é prioridade 5, nada é prioritário.',
        'Mínimos semanais servem para conteúdos que você não quer negligenciar, mesmo quando têm prioridade menor.',
        'O planejamento é uma referência semanal, não uma obrigação diária. Não estudar na terça não quebra nada.',
        'Ajuste o plano conforme sua realidade muda — provas, semanas cheias, férias.'
      ]}
    ] },

  /* ---------------- ESTUDANDO ---------------- */
  { id:'registrar-sessao', cat:'estudando', title:'Como registrar uma sessão',
    summary:'Duas formas: cronômetro ou lançamento manual.',
    keywords:'registrar sessao estudo lancar salvar tempo minutos',
    content:[
      { p:'O botão Registrar fica sempre visível (canto inferior direito) e também responde à tecla R. Ele abre duas opções:' },
      { ul:[
        'Cronômetro — você escolhe a disciplina e o tópico e começa a contar. Use quando for estudar agora.',
        'Registrar manualmente — você informa data e minutos. Use quando esqueceu de iniciar o cronômetro ou está lançando algo de outro dia.'
      ]},
      { p:'Em ambos os casos você pode informar o tipo de sessão, a dificuldade percebida e um comentário. Só a disciplina e o tempo são obrigatórios.' }
    ] },

  { id:'cronometro', cat:'estudando', title:'Como usar o cronômetro',
    summary:'Ele continua correndo mesmo se você recarregar ou fechar a aba.',
    keywords:'cronometro timer tempo pausar retomar finalizar foco',
    content:[
      { p:'Quando um cronômetro está ativo, aparece uma barra no topo com a disciplina, o tópico e o tempo. Dali você pode pausar, retomar, entrar no modo foco ou finalizar.' },
      { h:'Ele sobrevive a fechar a aba' },
      { p:'O tempo é calculado por marcação de horário, não por um contador que roda na tela. Se você recarregar a página, fechar e reabrir o navegador, o cronômetro volta com o tempo correto.' },
      { h:'Sessão esquecida' },
      { p:'Se você voltar e houver uma sessão aberta há muitas horas, a plataforma pergunta o que fazer em vez de registrar tudo automaticamente. Ao finalizar, a duração pode ser corrigida antes de salvar.' },
      { h:'Modo foco' },
      { p:'No computador, o modo foco esconde o resto da interface e deixa só disciplina, tópico e cronômetro. Esc sai do foco sem finalizar a sessão.' }
    ] },

  { id:'registro-manual', cat:'estudando', title:'Registro manual',
    summary:'Para lançar sessões passadas ou que você esqueceu de cronometrar.',
    keywords:'manual retroativo passado esqueci lancar data',
    content:[
      { p:'No botão Registrar, escolha a aba "Registrar manualmente". Você informa disciplina, tópico, data e minutos.' },
      { p:'A data pode ser anterior a hoje, o que é útil para recuperar estudos que não foram lançados na hora. Os créditos são calculados a partir dos minutos, usando a regra da disciplina.' }
    ] },

  { id:'tipos-sessao', cat:'estudando', title:'Tipos de sessão',
    summary:'Teoria, exercícios, laboratório, revisão, projeto ou outro.',
    keywords:'tipo sessao teoria exercicios laboratorio revisao projeto pratica',
    content:[
      { p:'Classificar a sessão é opcional, mas alimenta uma análise útil: a proporção entre teoria e prática.' },
      { ul:[
        'Teoria — leitura, videoaula, explicação.',
        'Exercícios — questões, listas, simulados.',
        'Laboratório — prática aplicada, experimentos, montagem.',
        'Revisão — retomar conteúdo já estudado.',
        'Projeto — trabalho maior e contínuo.',
        'Outro — o que não se encaixa acima.'
      ]},
      { p:'Se você marcar o tipo como Revisão e a sessão tiver um tópico, a plataforma pergunta como você se saiu e ajusta o intervalo da próxima revisão.' }
    ] },

  { id:'dificuldade', cat:'estudando', title:'Dificuldade percebida',
    summary:'De 1 a 5, e ela não altera os créditos.',
    keywords:'dificuldade percebida esforco nivel 1 5 facil dificil',
    content:[
      { p:'A dificuldade vai de "Muito fácil" (1) a "Muito difícil" (5) e registra como aquela sessão pareceu para você. É opcional.' },
      { p:'Ela é puramente analítica: não altera créditos, não altera o planejamento e não altera o intervalo das revisões. Serve para você enxergar depois quais conteúdos estão custando mais esforço.' },
      { p:'Dificuldade não é a mesma coisa que domínio. Dificuldade é a sua percepção no momento do estudo; domínio vem do resultado das revisões ao longo do tempo.' }
    ] },

  /* ---------------- PLANEJAMENTO ---------------- */
  { id:'disponibilidade', cat:'planejamento', title:'Disponibilidade semanal',
    summary:'Quantas horas por semana você pretende estudar.',
    keywords:'disponibilidade horas semana tempo capacidade',
    content:[
      { p:'É o número que sustenta todo o planejamento. A plataforma distribui essas horas entre as disciplinas ativas.' },
      { p:'Prefira um número que você consegue cumprir em uma semana comum, não no seu melhor cenário. Ele pode ser alterado quando quiser, e mudanças futuras não reescrevem as semanas já registradas.' }
    ] },

  { id:'prioridades', cat:'planejamento', title:'Prioridades',
    summary:'De 1 a 5. Define quem recebe mais tempo na distribuição.',
    keywords:'prioridade peso importancia 1 5 distribuicao',
    content:[
      { p:'Cada disciplina tem uma prioridade de 1 (muito baixa) a 5 (muito alta). Ela é usada em dois lugares:' },
      { ul:[
        'Na distribuição automática, para dividir o tempo que sobra depois dos mínimos.',
        'Na recomendação da tela Hoje, como um dos fatores de decisão.'
      ]},
      { p:'Prioridades altas pesam bastante mais que baixas. Se todas as disciplinas estiverem com prioridade máxima, a prioridade deixa de diferenciá-las e o tempo acaba sendo dividido quase por igual.' }
    ] },

  { id:'minimos', cat:'planejamento', title:'Mínimos semanais',
    summary:'O piso de tempo que uma disciplina recebe, independente da prioridade.',
    keywords:'minimo semanal piso garantido negligenciar',
    content:[
      { p:'O mínimo semanal é reservado antes de qualquer outra conta. Ele existe para conteúdos que você não quer deixar de lado, mesmo que não sejam a maior prioridade.' },
      { p:'Se a soma dos mínimos ultrapassar sua disponibilidade, a plataforma avisa e mostra o excesso, em vez de reduzir tudo silenciosamente. Você decide se ajusta os mínimos ou aumenta a disponibilidade.' }
    ] },

  { id:'distribuicao', cat:'planejamento', title:'Distribuição automática',
    summary:'Como a plataforma divide as horas entre as disciplinas.',
    keywords:'distribuicao automatica calculo dividir tempo algoritmo',
    content:[
      { p:'O botão "Distribuir automaticamente" segue sempre a mesma sequência:' },
      { ul:[
        'Reserva os mínimos semanais de cada disciplina.',
        'Divide o tempo restante segundo a prioridade — prioridades altas recebem um peso bem maior.',
        'Aumenta o peso de disciplinas com prazo próximo.',
        'Arredonda os valores em blocos de 5 minutos e corrige a sobra para fechar exatamente na sua disponibilidade.'
      ]},
      { p:'O resultado é apenas uma sugestão: todos os valores continuam editáveis à mão, e o total é recalculado enquanto você digita.' }
    ] },

  { id:'plano-flexivel', cat:'planejamento', title:'Por que o plano não é uma agenda rígida',
    summary:'A meta é semanal. Não existe falha por não estudar em um dia específico.',
    keywords:'flexivel agenda horario rigido dia semana atraso culpa',
    content:[
      { p:'A plataforma controla quanto falta na semana, não em que dia você estuda. Se o plano prevê 2h de uma disciplina e você não tocou nela na segunda, nada é marcado como falha — a recomendação apenas passa a puxar essa disciplina com mais força enquanto o tempo não for cumprido.' },
      { p:'O contrário também vale: se você já passou do planejado em uma disciplina, ela perde peso na recomendação para dar espaço às que estão atrás.' }
    ] },

  { id:'plano-base-semana', cat:'planejamento', title:'Plano base e semana atual',
    summary:'Cada semana guarda o plano que existia nela.',
    keywords:'plano base semana snapshot historico weeklyplan alterar',
    content:[
      { p:'O plano base é o modelo. Toda semana recebe uma cópia própria dele no momento em que começa.' },
      { p:'Por isso, alterar o plano hoje não reescreve as metas de semanas anteriores — as análises históricas continuam comparando cada semana com o plano que realmente valia naquela época.' },
      { p:'Ao salvar, você escolhe entre valer a partir da próxima semana ou aplicar também na semana atual.' }
    ] },

  /* ---------------- RECOMENDAÇÕES ---------------- */
  { id:'como-hoje-decide', cat:'recomendacoes', title:'Como a tela Hoje decide o que sugerir',
    summary:'Uma pontuação local e determinística, sem nenhuma IA envolvida.',
    keywords:'recomendacao sugestao hoje algoritmo decidir proxima acao score',
    content:[
      { p:'A sugestão sai de um cálculo feito no seu navegador, com regras fixas. Não há IA, servidor nem aleatoriedade — com os mesmos dados, o resultado é sempre o mesmo.' },
      { h:'O que entra na conta' },
      { ul:[
        'Quanto falta da disciplina no plano da semana (é o fator de maior peso).',
        'A prioridade da disciplina.',
        'Há quantos dias você não a estuda.',
        'Se existe prazo próximo.',
        'Quantas revisões pendentes ela tem e há quanto tempo estão atrasadas.',
        'O domínio médio dos tópicos.',
        'Se você já passou bastante do tempo planejado (isso reduz a pontuação).'
      ]},
      { h:'Qual tópico é escolhido' },
      { p:'Dentro da disciplina, a ordem é: tópico com revisão vencida, depois tópico com domínio baixo, depois tópico em estudo sem contato há dias, depois o próximo ainda não iniciado na sua ordem.' }
    ] },

  { id:'por-que-sugestao', cat:'recomendacoes', title:'Por que esta disciplina apareceu?',
    summary:'Toda sugestão mostra os motivos em texto claro.',
    keywords:'porque motivo explicacao sugestao justificativa',
    content:[
      { p:'No card da próxima sessão, os motivos principais já aparecem embaixo do nome. O botão "Por que esta sugestão?" abre a lista completa.' },
      { p:'Os motivos são frases concretas, como "faltam 40min do plano semanal" ou "1 revisão pendente (atraso de 3 dias)". A plataforma não mostra a pontuação bruta porque o número em si não ajuda a decidir nada.' }
    ] },

  { id:'obedecer-recomendacao', cat:'recomendacoes', title:'Preciso obedecer à recomendação?',
    summary:'Não. Ela é um atalho para quem não quer decidir.',
    keywords:'obrigatorio obedecer ignorar seguir recomendacao livre',
    content:[
      { p:'Não. A recomendação existe para poupar você de decidir o que estudar quando bate a indecisão. Estudar qualquer outra coisa é perfeitamente válido e não gera nenhuma penalidade.' },
      { p:'A tela Hoje também mostra a 2ª e a 3ª opção, e pelo botão Registrar você escolhe livremente qualquer disciplina e tópico.' }
    ] },

  { id:'revisoes-prazos-recomendacao', cat:'recomendacoes', title:'Como revisões e prazos alteram as sugestões',
    summary:'Revisões atrasadas e provas próximas empurram a disciplina para cima.',
    keywords:'prazo prova revisao vencida influencia peso urgencia',
    content:[
      { p:'Revisões pendentes aumentam a pontuação da disciplina, e o atraso pesa ainda mais. Quando o tópico escolhido tem revisão vencida, a sugestão já vem marcada como revisão e com a duração padrão de revisão.' },
      { p:'Prazos cadastrados na tela Disciplinas também elevam a pontuação conforme a data se aproxima: até 2 dias pesa o máximo, até 7 pesa bastante, e o efeito diminui até deixar de existir depois de 30 dias.' }
    ] },

  /* ---------------- REVISÕES ---------------- */
  { id:'revisao-espacada', cat:'revisoes', title:'Como funciona a revisão espaçada',
    summary:'Cada tópico estudado volta para revisão em intervalos que se adaptam.',
    keywords:'revisao espacada intervalo repeticao spaced agenda automatica',
    content:[
      { p:'Quando você estuda um tópico pela primeira vez, ele entra no ciclo automaticamente: a primeira revisão fica marcada para o dia seguinte, com domínio inicial 2 de 5.' },
      { p:'A partir daí, cada revisão concluída ajusta o intervalo até a próxima conforme o resultado que você informar. Acertos afastam a próxima revisão; esquecer traz de volta para o dia seguinte.' },
      { p:'Sessões normais em um tópico já cadastrado não reprogramam nada — só o resultado de uma revisão altera o ciclo. O intervalo máximo é de 180 dias.' }
    ] },

  { id:'resultados-revisao', cat:'revisoes', title:'Esqueci, Lembrei com dificuldade, Lembrei bem, Dominei',
    summary:'O que cada resposta faz com o intervalo e com o domínio.',
    keywords:'esqueci dificuldade lembrei dominei resultado revisao intervalo',
    content:[
      { p:'Ao finalizar uma revisão, você responde como se saiu. Cada resposta tem um efeito definido:' },
      { ul:[
        'Esqueci — a próxima revisão volta para amanhã e o domínio cai 2 pontos.',
        'Lembrei com dificuldade — o intervalo cresce pouco (metade a mais, no mínimo 2 dias) e o domínio cai 1 ponto.',
        'Lembrei bem — o intervalo mais que dobra (no mínimo 4 dias) e o domínio sobe 1 ponto.',
        'Dominei — o intervalo cresce bastante (no mínimo 7 dias) e o domínio vai direto para 5.'
      ]},
      { p:'Esqueci e Lembrei com dificuldade também zeram a sequência de acertos seguidos.' }
    ] },

  { id:'topico-dominado', cat:'revisoes', title:'Quando um tópico é considerado dominado',
    summary:'Domínio 4 ou 5 e pelo menos duas revisões bem-sucedidas seguidas.',
    keywords:'dominado dominio status topico nao iniciado em estudo em revisao',
    content:[
      { p:'O status do tópico é sempre calculado a partir do histórico, nunca definido à mão:' },
      { ul:[
        'Não iniciado — nenhuma sessão registrada.',
        'Em estudo — já estudado, mas ainda sem nenhuma revisão concluída.',
        'Em revisão — já tem histórico de revisão, mas ainda não atingiu o critério de domínio.',
        'Dominado — domínio 4 ou 5 e pelo menos duas revisões seguidas bem-sucedidas.'
      ]},
      { p:'Um tópico dominado pode voltar para "em revisão" se você esquecer o conteúdo depois. Isso é esperado e desejado — o status reflete a situação atual, não uma conquista permanente.' }
    ] },

  { id:'dificuldade-vs-dominio', cat:'revisoes', title:'Diferença entre dificuldade e domínio',
    summary:'Uma é sua percepção no momento; a outra é o resultado das revisões.',
    keywords:'dificuldade dominio diferenca confusao percepcao retencao',
    content:[
      { p:'Dificuldade é o quanto aquela sessão pareceu difícil para você. É informada por sessão, é opcional e não afeta nada além das análises.' },
      { p:'Domínio é o quanto você está retendo o tópico ao longo do tempo. Vai de 1 a 5, começa em 2 e sobe ou desce conforme o resultado de cada revisão.' },
      { p:'Um conteúdo pode ser difícil e mesmo assim estar bem dominado — e o contrário também acontece.' }
    ] },

  { id:'estrategias-revisao', cat:'revisoes', title:'Estratégias de revisão: quando o conteúdo volta',
    summary:'Quatro formas de decidir o intervalo até a próxima revisão.',
    keywords:'estrategia adaptativa ciclo programado intensiva manutencao intervalo quando',
    content:[
      { p:'A estratégia responde a uma única pergunta: QUANDO este conteúdo deve voltar. Ela não diz como revisar — isso é o método.' },
      { h:'Adaptativa (padrão)' },
      { p:'O intervalo responde ao seu resultado. Lembrou bem, o intervalo cresce; esqueceu, ele volta para o dia seguinte. É a escolha certa para quase todo mundo, e é o padrão de quem não mexe em nada.' },
      { h:'Ciclo programado' },
      { p:'Intervalos previsíveis: 1, 3, 7, 14, 30 e 60 dias. O resultado da revisão move você dentro do ciclo — esquecer volta ao começo, "dominei" avança dois passos. Serve para quem prefere saber de antemão quando o conteúdo retorna.' },
      { h:'Intensiva' },
      { p:'Intervalos curtos (1, 2, 3, 5, 7, 10, 14 dias) para períodos de prova ou prazo apertado. Quando o prazo da disciplina passa, o Diário avisa e sugere voltar ao ritmo normal — nada muda em silêncio.' },
      { h:'Manutenção' },
      { p:'Intervalos longos (14, 30, 60, 90, 120 e 180 dias) para conteúdo já consolidado que você só quer manter acessível.' },
      { p:'A estratégia pode ser definida em Configurações (vale para tudo), na disciplina, ou em um tópico específico. O nível mais específico vence.' }
    ] },

  { id:'metodos-revisao', cat:'revisoes', title:'Métodos de revisão: como revisar',
    summary:'Revisar não é reler. Sete formas de trabalhar o conteúdo.',
    keywords:'metodo recordacao ativa exercicios explicacao resumo flashcards intercalada livre automatico como',
    content:[
      { p:'O método responde a outra pergunta: COMO revisar. O Diário sugere um, mostra um roteiro curto e deixa você trocar quando quiser.' },
      { ul:[
        'Recordação ativa — feche o material e tente lembrar antes de conferir.',
        'Exercícios — resolva questões antes de olhar a resposta.',
        'Explicação — explique com palavras simples, como se ensinasse alguém.',
        'Resumo de memória — escreva o que lembra e só depois compare com o material.',
        'Flashcards — pergunta de um lado, resposta do outro (você usa a ferramenta que preferir).',
        'Prática intercalada — misture tipos de problema em vez de repetir só um.',
        'Revisão livre — você decide a abordagem.'
      ]},
      { h:'Método automático' },
      { p:'No modo Automático, o Diário escolhe a partir da natureza do conteúdo da disciplina: conteúdo conceitual tende a recordação ativa e explicação; memorização, a recordação ativa e flashcards; resolução de problemas, a exercícios e prática intercalada. Se a última revisão foi "esqueci", ele prefere recordação ativa.' },
      { p:'A sugestão é sempre explicada na tela e nunca impede você de escolher outra coisa.' }
    ] },

  { id:'importancia-topico', cat:'revisoes', title:'Importância do tópico',
    summary:'O peso de um conteúdo dentro da disciplina. Não é a prioridade da disciplina.',
    keywords:'importancia topico alta baixa normal peso prioridade diferenca',
    content:[
      { p:'São duas coisas diferentes, e vale não confundir:' },
      { ul:[
        'Prioridade da disciplina — define quanto tempo ela recebe no planejamento semanal.',
        'Importância do tópico — define o peso daquele conteúdo dentro da disciplina, principalmente na fila de revisões.'
      ]},
      { p:'Um tópico com importância alta sobe na fila de revisão e recebe uma estimativa de tempo um pouco maior. O padrão é Normal, e a maioria dos tópicos pode ficar assim.' }
    ] },

  { id:'fila-revisao', cat:'revisoes', title:'Como a fila de revisão é ordenada',
    summary:'Por relevância, não apenas por data.',
    keywords:'fila ordem prioridade atrasada backlog acumulo sessao montar',
    content:[
      { p:'A fila considera vários sinais ao mesmo tempo: há quantos dias a revisão está atrasada, a importância do tópico, o domínio atual, o resultado da última revisão, quantas vezes você já esqueceu aquele conteúdo, prazos próximos da disciplina e há quanto tempo você não revisa.' },
      { p:'Cada item mostra os motivos em texto — "atrasada há 4 dias", "importância alta", "você esqueceu na última revisão". O cálculo interno nunca aparece, porque o número não ajudaria você a decidir nada.' },
      { h:'Quando a fila acumula' },
      { p:'Ter 30 revisões pendentes não significa que você precisa fazer 30 hoje. Use "Montar sessão de revisão", informe quanto tempo você tem, e o Diário seleciona os itens mais relevantes que cabem nesse tempo. O restante continua na fila, sem nada ser marcado como concluído.' }
    ] },

  { id:'desativar-revisao', cat:'revisoes', title:'Posso desativar a revisão de um tópico?',
    summary:'Sim, por tópico ou para todos os novos.',
    keywords:'desativar desligar revisao topico automatica pausar',
    content:[
      { p:'Ao editar um tópico, existe a opção "Incluir no ciclo de revisão". Desmarcando, ele deixa de gerar revisões, mas continua acumulando sessões e tempo normalmente.' },
      { p:'Em Configurações → Revisões você também pode desligar a inclusão automática de novos tópicos no ciclo.' },
      { p:'Arquivar um tópico também pausa as revisões dele, preservando todo o histórico.' }
    ] },

  /* ---------------- ANÁLISES ---------------- */
  { id:'tempo-estudado', cat:'analises', title:'Tempo estudado e período',
    summary:'Todas as métricas da tela obedecem ao período selecionado.',
    keywords:'tempo estudado periodo filtro metricas horas minutos',
    content:[
      { p:'No topo de Análises você escolhe o período: hoje, 7 dias, 30 dias, esta semana, este mês, tudo, ou um intervalo personalizado por datas ou pelo calendário.' },
      { p:'Tudo na página responde a essa escolha — tempo, créditos, sessões, dias ativos, distribuição, dificuldade, aderência e insights.' },
      { p:'Minutos são a unidade principal. Créditos existem para acompanhamento, mas como cada disciplina tem sua própria regra de conversão, eles não representam o mesmo esforço entre disciplinas diferentes.' }
    ] },

  { id:'planejado-realizado', cat:'analises', title:'Planejado × realizado e aderência',
    summary:'Comparação com o plano que valia em cada semana do período.',
    keywords:'planejado realizado aderencia porcentagem meta cumprimento',
    content:[
      { p:'Aderência é quanto do tempo planejado foi de fato estudado. 100% significa que você cumpriu exatamente o previsto; acima disso significa que estudou mais.' },
      { p:'A comparação usa o plano histórico de cada semana tocada pelo período. Se o período cobre apenas parte de uma semana, o planejado daquela semana entra proporcionalmente aos dias considerados.' },
      { p:'Passar de 100% não é automaticamente melhor — pode significar que outra disciplina ficou para trás. Por isso a análise mostra também o desempenho por disciplina.' }
    ] },

  { id:'cobertura-dominio', cat:'analises', title:'Cobertura e domínio de conteúdo',
    summary:'Quanto do conteúdo você já viu e quanto realmente domina.',
    keywords:'cobertura dominio conteudo topicos percentual progresso',
    content:[
      { p:'Cobertura é a proporção de tópicos que já receberam pelo menos uma sessão. Domínio é a proporção de tópicos que atingiram o status "dominado".' },
      { p:'São coisas diferentes de propósito: dá para ter 80% de cobertura e 20% de domínio, o que normalmente indica que faltou revisar, não estudar.' },
      { p:'Só entram na conta os tópicos cadastrados em disciplinas ativas. Disciplinas arquivadas ficam de fora do cálculo atual, mas o histórico delas permanece.' }
    ] },

  { id:'creditos', cat:'analises', title:'O que são créditos',
    summary:'Uma unidade de acompanhamento definida por disciplina.',
    keywords:'credito creditos minutos por credito conversao unidade',
    content:[
      { p:'Cada disciplina define quantos minutos valem 1 crédito (o padrão é 20). Ao registrar 40 minutos numa disciplina de 20 min/crédito, a sessão vale 2 créditos.' },
      { p:'Você altera essa regra em Disciplinas → editar → Opções avançadas. Créditos já registrados não mudam retroativamente: o valor histórico de cada sessão é preservado.' },
      { p:'Como a regra varia entre disciplinas, o planejamento e as comparações gerais trabalham em minutos.' }
    ] },

  { id:'comparacao-periodos', cat:'analises', title:'Comparação com o período anterior',
    summary:'O período imediatamente anterior, de mesma duração.',
    keywords:'comparacao anterior variacao percentual evolucao tendencia',
    content:[
      { p:'As métricas mostram a variação em relação ao período de mesma duração que termina um dia antes do período atual. Um intervalo de 7 dias é comparado com os 7 dias anteriores.' },
      { p:'Quando não há registros no período anterior, a comparação simplesmente não aparece — em vez de mostrar variações irreais.' }
    ] },

  { id:'calendario-heatmap', cat:'analises', title:'Calendário de consistência',
    summary:'A intensidade de cada dia e como selecionar um intervalo.',
    keywords:'calendario heatmap mapa consistencia dias intervalo selecionar',
    content:[
      { p:'Cada quadradinho é um dia do mês, e a barra colorida indica quanto tempo você estudou nele, em relação ao dia mais intenso daquele mês. Dias sem registro ficam neutros.' },
      { p:'Clicando em um dia e depois em outro, você define um período personalizado, e toda a página passa a usar esse intervalo.' },
      { p:'O dia de hoje fica destacado com um contorno, e passar o mouse mostra o detalhe do dia.' }
    ] },

  { id:'relatorio-semanal', cat:'analises', title:'Relatório semanal',
    summary:'Uma semana por vez, com navegação para semanas anteriores.',
    keywords:'relatorio semanal semana resumo navegar',
    content:[
      { p:'O relatório mostra uma semana específica: realizado, planejado, aderência, sessões, dias ativos, revisões e o desempenho por disciplina.' },
      { p:'As setas navegam para semanas anteriores. Ele é sempre calculado na hora a partir do histórico e do plano daquela semana, então não existe relatório "desatualizado".' }
    ] },

  { id:'copiar-resumo', cat:'analises', title:'Copiar resumo do período',
    summary:'Um texto pronto com os números e os insights do período.',
    keywords:'copiar resumo texto exportar compartilhar insights',
    content:[
      { p:'O botão "copiar resumo do período" gera um texto com tempo, sessões, dias ativos, créditos, distribuição por área e disciplina, dificuldades, domínios e a lista de insights.' },
      { p:'Ele vai para a área de transferência e você usa como quiser — anotações, mensagem para alguém, ou uma análise externa. Nada é enviado automaticamente.' }
    ] },

  /* ---------------- DADOS ---------------- */
  { id:'onde-dados', cat:'dados', title:'Onde meus dados ficam',
    summary:'Somente neste navegador, sem conta e sem servidor.',
    keywords:'dados privacidade local navegador servidor conta nuvem online',
    content:[
      { p:'Tudo fica gravado no próprio navegador, no seu computador. Não existe conta, login, servidor de dados, sincronização, rastreamento nem telemetria.' },
      { p:'A página é configurada para bloquear conexões de rede, e não há bibliotecas, fontes ou scripts externos. Na prática, seus dados de estudo não têm por onde sair.' },
      { p:'A contrapartida é que o backup é responsabilidade sua: exportar o arquivo de vez em quando é o que protege seu histórico.' }
    ] },

  { id:'indexeddb', cat:'dados', title:'O que é IndexedDB, em linguagem simples',
    summary:'O banco de dados que já vem no seu navegador.',
    keywords:'indexeddb banco dados armazenamento tecnico navegador',
    content:[
      { p:'IndexedDB é um espaço de armazenamento que todo navegador moderno oferece para os sites guardarem informação no próprio computador — como um arquivo local, só que gerenciado pelo navegador.' },
      { p:'É mais robusto que os métodos simples de armazenamento e aguenta bem milhares de registros, que é o volume que anos de estudo geram.' },
      { p:'Esse espaço é separado por navegador e por perfil. Por isso os dados do Chrome não aparecem no Firefox, nem numa janela anônima.' }
    ] },

  { id:'como-backup', cat:'dados', title:'Como fazer backup',
    summary:'Tela Dados, botão Exportar backup. Guarde o arquivo.',
    keywords:'backup exportar salvar copia seguranca json arquivo',
    content:[
      { p:'Vá em Dados e clique em "Exportar backup (.json)". O arquivo baixado contém tudo: áreas, disciplinas, tópicos, sessões, planos, semanas, prazos e configurações.' },
      { p:'A tela mostra quando foi seu último backup e avisa discretamente quando faz muito tempo. Guarde o arquivo em algum lugar que não seja só este computador.' },
      { p:'Para restaurar, use "Importar" na mesma tela e escolha o arquivo. A plataforma valida o conteúdo antes de gravar e pede confirmação, porque a restauração substitui os dados atuais.' }
    ] },

  { id:'json-csv', cat:'dados', title:'Diferença entre backup JSON e CSV',
    summary:'JSON restaura tudo; CSV serve para planilha.',
    keywords:'json csv diferenca planilha excel exportar restaurar',
    content:[
      { ul:[
        'JSON — backup completo e restaurável. É o arquivo que traz seus dados de volta. Use este para segurança e para mudar de computador.',
        'CSV — apenas a lista de sessões, em formato de planilha. Serve para abrir no Excel, Google Sheets ou qualquer ferramenta de análise. Não restaura a plataforma.'
      ]}
    ] },

  { id:'mudar-computador', cat:'dados', title:'Como levar meus dados para outro computador',
    summary:'Exporte o JSON num, importe no outro.',
    keywords:'mudar computador transferir migrar outro dispositivo celular levar',
    content:[
      { ul:[
        'No computador atual: Dados → Exportar backup (.json).',
        'Leve o arquivo (pendrive, e-mail para você mesmo, nuvem — como preferir).',
        'No computador novo: abra a plataforma, vá em Dados → Importar e escolha o arquivo.'
      ]},
      { p:'O mesmo procedimento funciona para usar no celular. Lembre que não há sincronização: as duas cópias seguem independentes depois disso.' }
    ] },

  { id:'sem-sincronizacao', cat:'dados', title:'Por que os dados não sincronizam',
    summary:'Sincronizar exigiria servidor e conta — e é justamente o que não existe aqui.',
    keywords:'sincronizacao sync nuvem conta servidor multiplos dispositivos',
    content:[
      { p:'Sincronizar entre dispositivos exige guardar seus dados em um servidor e identificar você com uma conta. A plataforma foi construída sem isso de propósito.' },
      { p:'O preço dessa escolha é que cada navegador tem sua própria cópia. O backup manual é o caminho para mover os dados entre dispositivos.' }
    ] },

  { id:'limpar-navegador', cat:'dados', title:'O que acontece se eu limpar os dados do navegador',
    summary:'O histórico se perde, a menos que você tenha um backup.',
    keywords:'limpar navegador apagar perder cache historico anonima',
    content:[
      { p:'Limpar dados de site, usar "limpar tudo" do navegador ou desinstalá-lo apaga o armazenamento da plataforma junto. Não há cópia em outro lugar para recuperar.' },
      { p:'Janelas anônimas também não servem: o que for registrado nelas costuma desaparecer ao fechar a janela.' },
      { p:'Por isso vale exportar o backup periodicamente. É um arquivo pequeno e leva alguns segundos.' }
    ] },

  /* ---------------- ATALHOS ---------------- */
  { id:'atalhos', cat:'atalhos', title:'Atalhos de teclado',
    summary:'Todos os atalhos disponíveis no computador.',
    keywords:'atalho teclado tecla ctrl k esc navegar comando',
    content:[
      { p:'Os atalhos funcionam quando você não está digitando em um campo de texto.' },
      { ul:[
        'Ctrl + K (ou ⌘ + K) — abre a busca de comandos: telas, disciplinas, tópicos, ações e artigos de ajuda.',
        'R — abre o registro de sessão. Se já houver um cronômetro rodando, abre a finalização.',
        'H — vai para Hoje.',
        'P — vai para Planejamento.',
        'V — vai para Revisões.',
        'A — vai para Análises.',
        '? — abre a Central de Ajuda.',
        'Esc — fecha o que estiver aberto: busca de comandos, painel lateral, modal ou modo foco.'
      ]},
      { p:'Na busca de comandos, use as setas para navegar e Enter para abrir o item selecionado.' }
    ] },

  { id:'navegacao', cat:'atalhos', title:'Como a plataforma está organizada',
    summary:'O que fica em cada tela.',
    keywords:'navegacao telas menu organizacao onde encontrar',
    content:[
      { ul:[
        'Hoje — o que faz sentido estudar agora, progresso da semana e revisões pendentes.',
        'Planejamento — horas por semana e distribuição entre disciplinas.',
        'Revisões — a fila de revisões atrasadas, de hoje e das próximas.',
        'Disciplinas — estrutura de conteúdo (áreas, disciplinas, tópicos) e prazos.',
        'Análises — todas as métricas e gráficos do período escolhido.',
        'Histórico — a lista completa de sessões, com busca e filtros.',
        'Dados — backup, restauração e informações de privacidade.',
        'Configurações — aparência, preferências de estudo, revisões e ajuda.'
      ]},
      { p:'No celular, Disciplinas, Histórico, Ajuda, Dados e Configurações ficam no botão "Mais".' }
    ] }
];

const HELP_FAQ = [
  { q:'Preciso seguir a recomendação da tela Hoje?',
    a:'Não. Ela é um atalho para quando você não quer decidir o que estudar. Estudar outra coisa não gera penalidade nenhuma — pelo botão Registrar você escolhe livremente.' },
  { q:'Preciso cadastrar todos os tópicos antes de começar?',
    a:'Não. Dá para registrar sessões sem tópico algum. Os tópicos são o que habilita cobertura de conteúdo, domínio e revisão espaçada, então vale cadastrá-los aos poucos.' },
  { q:'O que acontece se eu ficar alguns dias sem estudar?',
    a:'Nada é marcado como falha. As revisões daquele período ficam pendentes e as disciplinas não estudadas ganham mais peso na recomendação, porque continuam abaixo do plano da semana.' },
  { q:'Posso estudar mais que o planejado?',
    a:'Pode. O plano é uma referência, não um teto. A disciplina que já passou do previsto apenas perde peso na recomendação, para abrir espaço às que ainda estão atrás.' },
  { q:'Por que determinada disciplina está sendo recomendada?',
    a:'O card mostra os motivos, e o botão "Por que esta sugestão?" abre a lista completa: déficit do plano, prioridade, tempo sem estudar, prazos e revisões pendentes.' },
  { q:'Dificuldade e domínio são a mesma coisa?',
    a:'Não. Dificuldade é o quanto uma sessão pareceu difícil para você, informada na hora. Domínio é a retenção do tópico ao longo do tempo, calculada pelos resultados das revisões.' },
  { q:'Preciso usar o cronômetro?',
    a:'Não. O registro manual permite lançar data e minutos depois, inclusive de dias anteriores.' },
  { q:'O cronômetro continua se eu fechar ou atualizar a página?',
    a:'Sim. O tempo é calculado por marcação de horário, não por um contador na tela. Ao reabrir, ele volta com o tempo correto. Se ficar aberto muitas horas, a plataforma pergunta o que fazer em vez de registrar tudo sozinha.' },
  { q:'Por que uma revisão apareceu de novo tão cedo?',
    a:'Provavelmente o último resultado foi "Esqueci" (volta para o dia seguinte) ou "Lembrei com dificuldade" (intervalo cresce pouco). O intervalo acompanha o quanto você está retendo o conteúdo.' },
  { q:'Posso desativar a revisão de um tópico?',
    a:'Sim, desmarcando "Incluir no ciclo de revisão" ao editar o tópico. Em Configurações também dá para desligar a inclusão automática de novos tópicos.' },
  { q:'Meus dados ficam online?',
    a:'Não. Ficam apenas neste navegador. Não há servidor de dados, conta, sincronização nem telemetria, e a página bloqueia conexões de rede.' },
  { q:'Existe conta ou login?',
    a:'Não existe e não é necessário. A plataforma abre direto e funciona offline.' },
  { q:'Posso usar no celular?',
    a:'Pode, com todas as funções essenciais. A experiência é pensada primeiro para computador, mas o celular continua completo. Os dados, porém, não são compartilhados entre os dispositivos.' },
  { q:'Como levo meus dados para outro computador?',
    a:'Exporte o backup JSON em Dados, leve o arquivo e importe no outro computador pela mesma tela.' },
  { q:'O que acontece se eu limpar os dados do navegador?',
    a:'O histórico é apagado junto, sem como recuperar — a menos que você tenha um backup exportado. É a principal razão para exportar de tempos em tempos.' },
  { q:'Qual a diferença entre backup JSON e CSV?',
    a:'O JSON é o backup completo, o único que restaura a plataforma. O CSV traz só as sessões, para abrir em planilha.' },
  { q:'O que são créditos?',
    a:'Uma unidade de acompanhamento por disciplina: cada uma define quantos minutos valem 1 crédito (padrão 20). Como a regra varia, o planejamento e as comparações gerais usam minutos.' },
  { q:'O que significa aderência?',
    a:'Quanto do tempo planejado foi realmente estudado no período. 100% é ter cumprido exatamente o previsto.' },
  { q:'Qual a diferença entre estratégia e método de revisão?',
    a:'Estratégia é QUANDO o conteúdo volta (o intervalo). Método é COMO você vai revisar (lembrar, resolver, explicar…). São escolhas independentes.' },
  { q:'Preciso escolher estratégia e método para cada tópico?',
    a:'Não. Tudo vem configurado com padrões que funcionam: estratégia Adaptativa e método Automático. Você só mexe se quiser.' },
  { q:'Tenho muitas revisões atrasadas. Preciso fazer todas?',
    a:'Não. Use "Montar sessão de revisão", diga quanto tempo você tem e o Diário escolhe as mais importantes que cabem nesse tempo. O resto continua na fila.' },
  { q:'Por que o método sugerido mudou?',
    a:'O Diário alterna entre as opções adequadas à natureza da disciplina para variar a forma de revisar. Se a última revisão foi "esqueci", ele passa a sugerir recordação ativa. O motivo sempre aparece na tela.' },
  { q:'O que é a frase do dia?',
    a:'Uma frase curta sobre estudo que muda a cada dia. Ela é escolhida localmente, sem internet, e pode ser desligada em Configurações → Interface.' },
  { q:'Marcar "Dominei" sem ter dominado atrapalha?',
    a:'Sim. O intervalo cresce bastante e o conteúdo pode voltar tarde demais. Responder com honestidade é o que faz o sistema trabalhar a seu favor.' },
  { q:'Arquivar apaga meu histórico?',
    a:'Não. Arquivar tira do uso ativo e preserva tudo. Só a exclusão definitiva, que fica como ação secundária, remove sessões.' }
];

const HELP_GLOSSARY = [
  { t:'Área',            d:'O agrupamento mais amplo dos seus estudos. Ex.: Faculdade, Concurso, Idiomas.' },
  { t:'Disciplina',      d:'O que você efetivamente estuda dentro de uma área. Ex.: Cálculo, Direito Constitucional, Gramática.' },
  { t:'Tópico',          d:'Um conteúdo específico dentro da disciplina. É o que entra no ciclo de revisão.' },
  { t:'Sessão',          d:'Um registro de estudo: disciplina, tempo e, opcionalmente, tópico, tipo, dificuldade e comentário.' },
  { t:'Prioridade',      d:'De 1 a 5. Define quanto tempo a disciplina recebe na distribuição e quanto peso tem na recomendação.' },
  { t:'Mínimo semanal',  d:'Tempo reservado para a disciplina antes de qualquer outra divisão, para ela não ser negligenciada.' },
  { t:'Revisão',         d:'Retomada de um tópico já estudado, agendada automaticamente em intervalos que se adaptam.' },
  { t:'Dificuldade',     d:'De 1 a 5, quanto a sessão pareceu difícil. Serve só para análise; não altera créditos nem revisões.' },
  { t:'Domínio',         d:'De 1 a 5, o quanto você está retendo um tópico. Sobe e desce conforme os resultados das revisões.' },
  { t:'Cobertura',       d:'A proporção de tópicos que já receberam pelo menos uma sessão.' },
  { t:'Aderência',       d:'Quanto do tempo planejado foi realmente estudado no período.' },
  { t:'Crédito',         d:'Unidade de acompanhamento. Cada disciplina define quantos minutos valem 1 crédito.' },
  { t:'Prazo',           d:'Uma data importante (prova, entrega). Quanto mais perto, mais peso a disciplina ganha.' },
  { t:'Plano base',      d:'O modelo semanal. Cada semana recebe uma cópia dele, que fica guardada como histórico.' },
  { t:'Recomendação',    d:'A sugestão do que estudar agora, calculada localmente por regras fixas e sempre explicada.' },
  { t:'Estratégia de revisão', d:'Decide QUANDO um tópico volta para revisão. Adaptativa, ciclo programado, intensiva ou manutenção.' },
  { t:'Método de revisão',     d:'Decide COMO revisar: tentar lembrar, resolver exercícios, explicar, escrever de memória, flashcards…' },
  { t:'Importância do tópico', d:'O peso de um conteúdo dentro da disciplina. Influencia a ordem da fila de revisões.' },
  { t:'Natureza do conteúdo',  d:'Se a disciplina é mais conceitual, de memorização, de resolução de problemas ou prática. Orienta o método sugerido.' },
  { t:'Recordação ativa',      d:'Tentar recuperar a informação de memória antes de consultar o material.' }
];

const HELP_EXAMPLES = [
  { id:'faculdade', label:'Faculdade', area:'Faculdade', discipline:'Cálculo',
    topics:['Limites','Derivadas','Integrais'],
    note:'Uma disciplina por matéria do semestre; os tópicos seguem a ementa.' },
  { id:'concurso', label:'Concurso', area:'Concurso', discipline:'Direito Constitucional',
    topics:['Direitos fundamentais','Poder Executivo','Controle de constitucionalidade'],
    note:'Os tópicos podem seguir o edital, o que ajuda a enxergar a cobertura do conteúdo.' },
  { id:'certificacao', label:'Certificação', area:'Tecnologia', discipline:'CCNA',
    topics:['IPv4','VLAN','STP','OSPF'],
    note:'Marcar sessões como Laboratório ajuda a ver se você está praticando ou só lendo.' },
  { id:'idiomas', label:'Idiomas', area:'Inglês', discipline:'Gramática',
    topics:['Present Simple','Past Simple','Present Perfect'],
    note:'Vale criar disciplinas separadas para Gramática, Listening e Vocabulário.' },
  { id:'escola', label:'Escola', area:'Escola', discipline:'História',
    topics:['Brasil Colônia','Revolução Industrial','Guerra Fria'],
    note:'Tópicos por unidade do livro facilitam revisar antes das provas.' },
  { id:'independente', label:'Estudo independente', area:'Música', discipline:'Violão',
    topics:['Acordes','Escalas','Ritmo'],
    note:'Serve para qualquer aprendizado contínuo, não só conteúdo acadêmico.' }
];

/** Ajuda contextual: tooltip curto + artigo completo ao clicar. */
const CONTEXT_HELP = {
  prioridade:      { title:'Prioridade',        tip:'De 1 a 5. Define quanto tempo a disciplina recebe e o peso dela na recomendação.', article:'prioridades' },
  minimo:          { title:'Mínimo semanal',    tip:'Tempo reservado antes de qualquer divisão, para a disciplina não ser negligenciada.', article:'minimos' },
  aderencia:       { title:'Aderência',         tip:'Quanto do tempo planejado foi realmente estudado.', article:'planejado-realizado' },
  cobertura:       { title:'Cobertura',         tip:'Proporção de tópicos que já receberam pelo menos uma sessão.', article:'cobertura-dominio' },
  dominio:         { title:'Domínio',           tip:'De 1 a 5, o quanto você está retendo o tópico. Vem das revisões.', article:'cobertura-dominio' },
  creditos:        { title:'Créditos',          tip:'Cada disciplina define quantos minutos valem 1 crédito.', article:'creditos' },
  revisao:         { title:'Revisão espaçada',  tip:'Tópicos estudados voltam para revisão em intervalos que se adaptam ao seu resultado.', article:'revisao-espacada' },
  dificuldade:     { title:'Dificuldade',       tip:'Sua percepção de esforço na sessão. Não altera créditos nem revisões.', article:'dificuldade' },
  disponibilidade: { title:'Disponibilidade',   tip:'Quantas horas por semana você pretende estudar.', article:'disponibilidade' },
  recomendacao:    { title:'Recomendação',      tip:'Sugestão calculada localmente por regras fixas — e sempre explicada.', article:'como-hoje-decide' },
  planosemana:     { title:'Semana atual',      tip:'Cada semana guarda o plano que valia nela; mudar o plano não reescreve o passado.', article:'plano-base-semana' },
  distribuicao:    { title:'Distribuição',      tip:'Respeita mínimos, divide o resto por prioridade e fecha no total exato.', article:'distribuicao' },
  tiposessao:      { title:'Tipo de sessão',    tip:'Classificar ajuda a ver a proporção entre teoria e prática.', article:'tipos-sessao' },
  importancia:     { title:'Importância do tópico', tip:'Quanto este conteúdo merece atenção dentro da disciplina. Não é a mesma coisa que a prioridade da disciplina.', article:'importancia-topico' },
  estrategia:      { title:'Estratégia de revisão', tip:'Decide QUANDO o conteúdo volta: o intervalo até a próxima revisão.', article:'estrategias-revisao' },
  metodo:          { title:'Método de revisão',     tip:'Decide COMO revisar: lembrar, resolver, explicar, escrever de memória…', article:'metodos-revisao' },
  natureza:        { title:'Natureza do conteúdo',  tip:'Ajuda o Diário a sugerir um método de revisão adequado à disciplina.', article:'metodos-revisao' }
};

/** Ajuda da tela atual (botão "Ajuda desta tela"). */
const SCREEN_HELP = {
  today:      { title:'Hoje', intro:'Esta tela responde a uma pergunta: o que faz sentido estudar agora.',
                points:['O progresso da semana compara o realizado com o plano vigente.','A próxima sessão é uma sugestão calculada, com os motivos sempre visíveis.','As revisões pendentes aparecem aqui e podem ser iniciadas direto.'],
                articles:['como-hoje-decide','obedecer-recomendacao','cronometro'] },
  plan:       { title:'Planejamento', intro:'O planejamento define quanto tempo você pretende dedicar às disciplinas durante a semana.',
                points:['Prioridade define quem recebe mais tempo.','Mínimo é o piso garantido de cada disciplina.','A distribuição automática é só uma sugestão: tudo continua editável.','A semana atual guarda seu próprio registro histórico.'],
                articles:['disponibilidade','prioridades','minimos','distribuicao','plano-base-semana'] },
  reviews:    { title:'Revisões', intro:'Tópicos estudados voltam automaticamente para revisão, em intervalos que se adaptam.',
                points:['Atrasadas e de hoje aparecem primeiro.','O resultado que você informa ajusta o próximo intervalo.','Domínio sobe e desce conforme a retenção.'],
                articles:['revisao-espacada','estrategias-revisao','metodos-revisao','fila-revisao','resultados-revisao','topico-dominado'] },
  disciplines:{ title:'Disciplinas', intro:'Aqui fica a estrutura do conteúdo: áreas, disciplinas, tópicos e prazos.',
                points:['Abrir uma disciplina mostra progresso, tópicos e ações.','Tópicos podem ser reordenados, editados e arquivados.','Prazos próximos aumentam o peso da disciplina.'],
                articles:['organizar-estudos','criar-estrutura','revisoes-prazos-recomendacao'] },
  analytics:  { title:'Análises', intro:'Todas as métricas desta página obedecem ao período escolhido no topo.',
                points:['A comparação usa o período anterior de mesma duração.','Planejado × realizado usa o plano histórico de cada semana.','Cobertura e domínio medem conteúdo, não tempo.'],
                articles:['tempo-estudado','planejado-realizado','cobertura-dominio','calendario-heatmap'] },
  history:    { title:'Histórico', intro:'A lista completa de sessões registradas, com busca e filtros.',
                points:['A busca procura em disciplina, área, tópico e comentário.','Os filtros se combinam entre si.','Editar uma sessão recalcula os créditos pela regra da disciplina.'],
                articles:['registrar-sessao','registro-manual','creditos'] },
  data:       { title:'Dados', intro:'Backup, restauração e informações de privacidade.',
                points:['O JSON restaura tudo; o CSV serve para planilha.','Importar substitui os dados atuais e pede confirmação.','Backups das versões anteriores continuam sendo aceitos.'],
                articles:['como-backup','json-csv','mudar-computador','onde-dados'] },
  settings:   { title:'Configurações', intro:'Preferências de aparência, estudo, revisões e ajuda.',
                points:['O tema Sistema acompanha a preferência do seu sistema operacional.','A densidade compacta reduz espaçamentos sem diminuir a fonte.','A ajuda contextual pode ser completa, discreta ou desativada.'],
                articles:['atalhos','navegacao'] },
  help:       { title:'Ajuda', intro:'Busque por palavra-chave ou navegue pelas categorias.',
                points:['A busca funciona sem acentos e procura em títulos, palavras-chave e conteúdo.','O FAQ responde as dúvidas mais comuns.','O glossário explica os termos usados na interface.'],
                articles:['primeiros-passos','navegacao'] }
};

const CHANGELOG = [
  { v:'5.0', d:'Primeiro uso reconstruído: você adiciona o que estuda e começa em menos de dois minutos. Ajuda interativa com exemplos que funcionam de verdade, revisões guiadas e vocabulário em linguagem natural.' },
  { v:'4.0', d:'Revisões renovadas: estratégias, métodos com roteiro, fila inteligente e sessão de revisão por tempo disponível. Nova seção "Aprender a estudar", checklist "Comece por aqui" e frase do dia.' },
  { v:'3.1.1', d:'Correções na criação e no gerenciamento de áreas, e ajustes de estabilidade.' },
  { v:'3.1', d:'Central de Ajuda, ajuda contextual, busca de comandos (Ctrl+K), modo foco, tema Sistema, densidade compacta e refinamento da experiência no computador.' },
  { v:'3.0', d:'Planejamento semanal, revisão espaçada, recomendações explicáveis e armazenamento em IndexedDB.' },
  { v:'2.0', d:'Análises, insights determinísticos, tipos de sessão e dificuldade percebida.' }
];

const CONTACT_EMAIL = 'contatosantanafilipe@gmail.com';

/* =========================================================================
   v5 — COMO COMEÇAR
   Passos curtos e acionáveis. `check` é avaliado contra o estado real;
   `run` é resolvido em app.js (aqui só guardamos a chave da ação).
   ========================================================================= */
const HOW_TO_START = [
  { id:'discipline', title:'Adicione algo que você estuda',
    text:'Pode ser uma matéria, um idioma, uma certificação — qualquer assunto.',
    example:'Matemática · Inglês · Anatomia · CCNA · Violão',
    action:'addDiscipline', actionLabel:'Adicionar agora' },
  { id:'session', title:'Faça sua primeira sessão',
    text:'Escolha o que vai estudar e quanto tempo. O Diário conta o tempo para você.',
    example:'Inglês · 20 minutos',
    action:'quickStart', actionLabel:'Começar a estudar' },
  { id:'topic', title:'Adicione assuntos conforme precisar',
    text:'Assuntos são as partes de uma disciplina. Não precisa cadastrar tudo de uma vez.',
    example:'Matemática → Derivadas',
    action:'addTopic', actionLabel:'Adicionar assunto' },
  { id:'review', title:'O Diário avisa quando revisar',
    text:'Depois de estudar um assunto, ele volta sozinho no momento certo.',
    example:'Estudou hoje → revisa amanhã → depois em 4 dias…',
    action:'reviewDemo', actionLabel:'Ver como funciona' },
  { id:'plan', title:'Organize sua semana quando quiser',
    text:'Dizer quanto tempo você tem ajuda o Diário a distribuir melhor seus estudos.',
    example:'5 horas por semana',
    action:'plan', actionLabel:'Organizar semana' }
];

/* =========================================================================
   v5 — AJUDA INTERATIVA
   Cada guia: o que é · em uma frase · exemplo visual · ação real.
   `demo` indica uma demonstração em memória (nunca toca no IndexedDB).
   ========================================================================= */
const INTERACTIVE_GUIDES = [
  {
    id:'ig-disciplina', title:'O que é uma disciplina?',
    oneLine:'A principal coisa que você estuda.',
    what:'Disciplina é cada assunto principal que você acompanha no Diário. Tudo o que você registra fica ligado a uma disciplina.',
    tree:{ area:'Faculdade (opcional)', discipline:'Cálculo', topics:['Limites','Derivadas','Integrais'] },
    examples:['Matemática','Inglês','Anatomia','Direito Constitucional','CCNA','Violão'],
    action:'addDiscipline', actionLabel:'Adicionar uma disciplina agora'
  },
  {
    id:'ig-topico', title:'O que é um assunto (tópico)?',
    oneLine:'Um assunto dentro de uma disciplina.',
    what:'Assuntos dividem a disciplina em partes. Eles não são obrigatórios, mas é o que permite ao Diário acompanhar revisões e progresso de conteúdo.',
    tree:{ area:null, discipline:'Inglês', topics:['Present Perfect'] },
    examples:['Cálculo → Derivadas','Inglês → Present Perfect','CCNA → OSPF','Direito → Direitos fundamentais'],
    action:'addTopic', actionLabel:'Adicionar um assunto'
  },
  {
    id:'ig-area', title:'O que é uma área?',
    oneLine:'Um grupo opcional para organizar disciplinas.',
    what:'Área só serve para agrupar. Você pode usar o Diário a vida inteira sem criar nenhuma. Ela ajuda quando você estuda coisas de contextos diferentes ao mesmo tempo.',
    tree:{ area:'Concurso', discipline:'Direito Constitucional', topics:['Direitos fundamentais'] },
    examples:['Faculdade','Concurso','Idiomas','Certificações','Projetos pessoais'],
    action:'addArea', actionLabel:'Criar uma área'
  },
  {
    id:'ig-sessao', title:'O que é uma sessão?',
    oneLine:'Um bloco de estudo que você registrou.',
    what:'Sempre que você estuda e registra, cria uma sessão. Ela guarda a disciplina, o tempo e, se você quiser, o assunto, o tipo e a dificuldade.',
    tree:{ area:null, discipline:'Matemática', topics:['Derivadas · 40 min'] },
    examples:['Inglês · 20 min','Anatomia · 45 min · exercícios','CCNA · 1h · laboratório'],
    action:'quickStart', actionLabel:'Começar uma sessão'
  },
  {
    id:'ig-revisao', title:'Como funciona uma revisão?',
    oneLine:'Você estudou isso antes. Agora vamos ver o que ainda consegue lembrar.',
    what:'Depois de estudar um assunto, o Diário marca uma revisão. Na revisão você tenta lembrar antes de consultar e depois diz como foi. Sua resposta decide quando o assunto volta.',
    demo:'review',
    examples:['Lembrou bem → volta mais tarde','Esqueceu → volta amanhã'],
    action:'openReviews', actionLabel:'Ver minhas revisões'
  },
  {
    id:'ig-plano', title:'Para que serve o planejamento?',
    oneLine:'Você diz quanto tempo tem; o Diário distribui entre as disciplinas.',
    what:'O planejamento é opcional. Com ele, o Diário sabe quanto falta em cada disciplina na semana e usa isso para sugerir o que estudar.',
    demo:'plan',
    examples:['5 horas por semana → Matemática 2h30 · Inglês 1h30 · História 1h'],
    action:'plan', actionLabel:'Organizar minha semana'
  },
  {
    id:'ig-importancia', title:'O que é importância?',
    oneLine:'Quanto um assunto merece atenção quando há muitas revisões.',
    what:'Todo assunto começa com importância Normal. Marcar como Alta faz ele subir na fila de revisões. Use quando tiver prova daquele conteúdo em breve.',
    examples:['Alta: "Tenho prova desse assunto em breve."','Normal: o padrão para quase tudo.','Baixa: "Quero acompanhar, mas sem pressa."'],
    action:'openDisciplines', actionLabel:'Ver meus assuntos'
  }
];

/* Demonstração de revisão — usada pela ajuda interativa, 100% em memória. */
const REVIEW_DEMO = {
  topic:'Present Perfect',
  discipline:'Inglês',
  intro:'Imagine que você estudou este assunto ontem. Hoje o Diário pergunta como foi lembrar dele.',
  outcomes:[
    { v:'forgot',     label:'Esqueci boa parte',       next:'amanhã',      mastery:'cai',       explain:'O assunto volta logo, porque você precisa reforçá-lo.' },
    { v:'hard',       label:'Foi difícil lembrar',      next:'em 2 dias',   mastery:'cai um pouco', explain:'O intervalo cresce pouco: você lembrou, mas com esforço.' },
    { v:'remembered', label:'Lembrei bem',              next:'em 4 dias',   mastery:'sobe',      explain:'O intervalo cresce, porque o conteúdo está se firmando.' },
    { v:'mastered',   label:'Estava fácil',             next:'em 7 dias',   mastery:'vai ao máximo', explain:'O intervalo cresce bastante: você já domina isso.' }
  ],
  closing:'Você não precisa decidir nada além disso. O Diário cuida das datas.'
};

/* Demonstração de planejamento — também só em memória. */
const PLAN_DEMO = {
  hours: 5,
  rows:[
    { name:'Matemática', importance:'É uma das minhas prioridades', minutes:150 },
    { name:'Inglês',     importance:'É importante',                 minutes:90 },
    { name:'História',   importance:'Quero estudar de vez em quando', minutes:60 }
  ],
  note:'Isso é apenas uma sugestão. Você pode mudar qualquer valor.'
};
