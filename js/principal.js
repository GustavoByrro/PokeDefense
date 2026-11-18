$(function () {

    const TAM = 120;                 // tamanho do pokémon na tela (px)
    const METADE = TAM / 2;
    const VIDA_MAXIMA = 100;
    const VEL_BOLA = 750;            // px por segundo
    const COOLDOWN_TIRO = 300;       // ms entre lançamentos
    const DIST_CONTATO = 80;         // distância em que o pokémon alcança o jogador
    const TOLERANCIA_Y = 70;         // tolerância vertical para acertar

    // olhaPara: para que lado a imagem original está virada
    const LISTA_POKEMONS = [
        { nome: 'Rattata',   vida: 1, dano: 10, pontos: 10, velocidade: 170, peso: 4, olhaPara: 'esquerda', srcImg: 'imgs/rattata-f.png' },
        { nome: 'Pikachu',   vida: 1, dano: 15, pontos: 15, velocidade: 150, peso: 4, olhaPara: 'esquerda', srcImg: 'imgs/pikachu.png' },
        { nome: 'Beedrill', vida: 2, dano: 20, pontos: 20, velocidade: 130,  peso: 3, olhaPara: 'esquerda', srcImg: 'imgs/beedrill.png' },
        { nome: 'Vileplume', vida: 2, dano: 25, pontos: 25, velocidade: 130,  peso: 3, olhaPara: 'esquerda', srcImg: 'imgs/vileplume-f.png' },
        { nome: 'Rhydon',    vida: 3, dano: 25, pontos: 25, velocidade: 85,  peso: 2, olhaPara: 'esquerda', srcImg: 'imgs/rhydon.png' },
        { nome: 'Clefable', vida: 3, dano: 30, pontos: 40, velocidade: 85,  peso: 2, olhaPara: 'esquerda', srcImg: 'imgs/clefable.png' },
        { nome: 'Dragonite', vida: 4, dano: 35, pontos: 60, velocidade: 65,  peso: 1, olhaPara: 'esquerda', srcImg: 'imgs/dragonite.png' },
        { nome: 'Arcanine',  vida: 4, dano: 35, pontos: 60, velocidade: 70, peso: 1, olhaPara: 'esquerda', srcImg: 'imgs/arcanine.png' }
    ];

    const LISTA_PERSONAGENS_ESPECIAIS = [
        { nome: 'Arthur', vida: 2, dano: 100, pontos: 20, velocidade: 140, olhaPara: 'direita', srcImg: 'imgs/Arthur.jpeg' },
        { nome: 'Gustavo', vida: 2, dano: 100, pontos: -20, velocidade: 140, olhaPara: 'direita', srcImg: 'imgs/Gustavoglagla.jpeg' },
        { nome: 'Benicio', vida: 2, dano: 100, pontos: 20, velocidade: 140, olhaPara: 'direita', srcImg: 'imgs/Benicio.jpeg' },
        { nome: 'Pedro', vida: 2, dano: 100, pontos: 20, velocidade: 140, olhaPara: 'esquerda', srcImg: 'imgs/PedroNegro.jpeg' },
        { nome: 'Gomes', vida: 2, dano: 100, pontos: 20, velocidade: 140, olhaPara: 'esquerda', srcImg: 'imgs/Gomes.jpeg' },
        { nome: 'Davi', vida: 2, dano: 100, pontos: 20, velocidade: 140, olhaPara: 'esquerda', srcImg: 'imgs/Davi.jpeg' }
    ];

    
    let telaAtual = 'inicial';
    let telaAnterior = 'inicial';
    let transicionando = false;
    let loopRodando = false;

    let jogo = {
        ativo: false,
        pontos: 0,
        vida: VIDA_MAXIMA,
        tempo: 0,
        proxSpawn: 1000,
        ultimoTiro: 0,
        ultimoFrame: 0,
        pokemons: [],
        bolas: []
    };

    let modoEspecial = false;
    let modoBossFinal = false;
    let proximoSpawnEspecial = 0;
    let pontuacaoComumPendente = null;

    const $arena = $('#arena');
    const $pontuacao = $('#pontuacao');

    const SUPABASE_URL = 'https://ekatgswxxieaqandkekq.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_5aZarxSIiVmx8OYfRTuk0g_H_mckxnI';
    const SUPABASE_TABLE = 'ranking';

    function headersSupabase() {
        return {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
        };
    }

    function normalizarNomeRanking(nome) {
        return String(nome || '')
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    async function salvarPontuacaoGlobal(nome, pontos) {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Configuração do ranking global ausente.');
        }

        const nomeLimpo = String(nome || '').trim();
        const pontosNumericos = Number(pontos) || 0;

        if (!nomeLimpo) {
            throw new Error('O nome do jogador não pode ficar vazio.');
        }

        const respostaBusca = await fetch(SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE + '?select=id,nome_usuario,pontuacao&order=pontuacao.desc&limit=1000', {
            method: 'GET',
            headers: headersSupabase()
        });

        if (!respostaBusca.ok) {
            const erro = await respostaBusca.text();
            throw new Error(erro || 'Não foi possível consultar o ranking global.');
        }

        const registros = await respostaBusca.json();
        const registrosDoJogador = (registros || []).filter((j) => normalizarNomeRanking(j.nome_usuario || '') === normalizarNomeRanking(nomeLimpo));
        const melhorRegistro = registrosDoJogador.reduce((melhor, atual) => {
            const pontuacaoAtual = Number(atual.pontuacao ?? 0);
            const melhorPontuacao = melhor ? Number(melhor.pontuacao ?? 0) : -Infinity;
            return pontuacaoAtual > melhorPontuacao ? atual : melhor;
        }, null);

        if (melhorRegistro && pontosNumericos <= Number(melhorRegistro.pontuacao ?? 0)) {
            return false;
        }

        const resposta = await fetch(SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE + '?select=id,nome_usuario,pontuacao', {
            method: 'POST',
            headers: headersSupabase(),
            body: JSON.stringify({ nome_usuario: nomeLimpo, pontuacao: pontosNumericos })
        });

        if (!resposta.ok) {
            const erro = await resposta.text();
            throw new Error(erro || 'Erro ao salvar no ranking global.');
        }

        return true;
    }

    async function carregarRankingGlobal() {
        try {
            const resposta = await fetch(SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE + '?select=nome_usuario,pontuacao&order=pontuacao.desc&limit=1000', {
                method: 'GET',
                headers: headersSupabase()
            });

            if (!resposta.ok) {
                throw new Error('Não foi possível carregar o ranking global.');
            }

            const dados = await resposta.json();
            const bestPorJogador = new Map();

            for (const jogador of (dados || [])) {
                const nome = String(jogador.nome_usuario || 'Jogador').trim();
                const nomeNormalizado = normalizarNomeRanking(nome);
                const pontos = Number(jogador.pontuacao ?? 0);
                const atual = bestPorJogador.get(nomeNormalizado);

                if (!atual || pontos > atual.pontos) {
                    bestPorJogador.set(nomeNormalizado, { nome, pontos });
                }
            }

            return Array.from(bestPorJogador.values()).sort((a, b) => b.pontos - a.pontos);
        } catch (erro) {
            console.error('Ranking global indisponível:', erro);
            return [];
        }
    }

    function mostrarTela(id) {
        $('.tela').hide();
        $('#' + id).show();
        telaAtual = id;
        if (id === 'ranking') atualizarRanking();
        if (id === 'resultado' && !$('#nome').prop('hidden')) $('#nome').trigger('focus');
    }

    function mostrarMensagemEspecial() {
        const $msg = $('#mensagem-especial');
        $msg.removeAttr('hidden').css('display', 'block').text('MODO ESPECIAL · venezuelanos');
        clearTimeout(mostrarMensagemEspecial.timer);
        mostrarMensagemEspecial.timer = setTimeout(function () {
            $msg.hide().attr('hidden', 'hidden');
        }, 2200);
    }

    function mudarTela(destino) {
        // Pausa e retomada são instantâneas (sem animação)
        if (destino === 'pausa') {
            telaAnterior = telaAtual;
            mostrarTela('pausa');
            return;
        }
        if (telaAtual === 'pausa' && destino === 'jogo') {
            mostrarTela('jogo');
            return;
        }

        if (transicionando) return;
        transicionando = true;

        if (destino === 'inicial' && telaAtual !== 'resultado') {
            jogo.ativo = false; // partida abandonada
        }

        const $topo = $('.transicao-metade.topo');
        const $baixo = $('.transicao-metade.baixo');

        $topo.removeClass('animar-topo');
        $baixo.removeClass('animar-baixo');
        void $topo[0].offsetWidth; // reinicia a animação
        $topo.addClass('animar-topo');
        $baixo.addClass('animar-baixo');

        setTimeout(function () { mostrarTela(destino); }, 100);
        setTimeout(function () { transicionando = false; }, 700);
    }

    function retomarJogo() {
        if (telaAnterior === 'jogo') mudarTela('jogo');
        else mudarTela('inicial');
    }

    function iniciarNovoJogo() {
        modoEspecial = false;
        modoBossFinal = false;
        proximoSpawnEspecial = 0;
        pontuacaoComumPendente = null;
        $arena.find('.pokemon, .bola, .flutua').remove();

        jogo.ativo = true;
        jogo.pontos = 0;
        jogo.vida = VIDA_MAXIMA;
        jogo.tempo = 0;
        jogo.proxSpawn = 1000;
        jogo.ultimoTiro = 0;
        jogo.pokemons = [];
        jogo.bolas = [];

        atualizarHud();
        mudarTela('jogo');

        if (!loopRodando) {
            loopRodando = true;
            jogo.ultimoFrame = performance.now();
            requestAnimationFrame(loop);
        }
    }

    function loop(agora) {
        if (!jogo.ativo) { loopRodando = false; return; }
        requestAnimationFrame(loop);

        const dt = Math.min((agora - jogo.ultimoFrame) / 1000, 0.05);
        jogo.ultimoFrame = agora;

        if (telaAtual !== 'jogo') return; // pausado / em transição
        atualizar(dt);
    }

    function medidas() {
        const W = $arena.width();
        const H = $arena.height();
        return { W: W, H: H, cx: W / 2, yTiro: H * 0.8 };
    }

    function atualizar(dt) {
        const m = medidas();
        jogo.tempo += dt;

        if (modoEspecial) {
            proximoSpawnEspecial -= dt * 1000;
            if (proximoSpawnEspecial <= 0) {
                criarPersonagemEspecial(m);
                const intervalo = Math.max(450, 1800 - jogo.tempo * 40);
                proximoSpawnEspecial = intervalo * (0.7 + Math.random() * 0.6);
            }
        } else if (modoBossFinal) {
            if (jogo.pokemons.length === 0) {
                modoBossFinal = false;
                jogo.ativo = false;
                setTimeout(function () {
                    $('#pontuacaoFinal').text('Pontuação: ' + jogo.pontos + ' · Boss final vencido!');
                    mostrarTela('resultado');
                }, 200);
                return;
            }
        } else {
            // --- spawn (fica mais rápido com o tempo) ---
            jogo.proxSpawn -= dt * 1000;
            if (jogo.proxSpawn <= 0) {
                criarPokemon(m);
                const intervalo = Math.max(700, 2200 - jogo.tempo * 25);
                jogo.proxSpawn = intervalo * (0.7 + Math.random() * 0.6);
            }
        }

        // --- pokébolas ---
        for (let i = jogo.bolas.length - 1; i >= 0; i--) {
            const b = jogo.bolas[i];
            b.x += b.dir * VEL_BOLA * dt;
            b.$el.css('left', b.x);

            let acertou = false;
            for (const p of jogo.pokemons) {
                if (p.morto) continue;
                if (Math.abs(b.x - p.x) < METADE * 0.7 + 16 && Math.abs(m.yTiro - p.y) < TOLERANCIA_Y) {
                    acertarPokemon(p);
                    acertou = true;
                    break;
                }
            }
            if (acertou || b.x < -40 || b.x > m.W + 40) {
                b.$el.remove();
                jogo.bolas.splice(i, 1);
            }
        }

        // --- pokémons ---
        const aceleracao = modoEspecial
            ? Math.min(1 + jogo.tempo / 40, 2.5)
            : Math.min(1 + jogo.tempo / 120, 1.8);
        for (let i = jogo.pokemons.length - 1; i >= 0; i--) {
            const p = jogo.pokemons[i];
            if (p.morto) { jogo.pokemons.splice(i, 1); continue; }

            p.x += p.dir * p.def.velocidade * aceleracao * dt;
            p.$el.css('left', p.x - METADE);

            if (Math.abs(p.x - m.cx) < DIST_CONTATO) {
                p.morto = true;
                p.$el.remove();
                jogo.pokemons.splice(i, 1);
                causarDano(p.def.dano);
                if (!jogo.ativo) return;
            }
        }

    }

    function sortearPokemon() {
        const total = LISTA_POKEMONS.reduce((s, p) => s + p.peso, 0);
        let r = Math.random() * total;
        for (const p of LISTA_POKEMONS) {
            r -= p.peso;
            if (r <= 0) return p;
        }
        return LISTA_POKEMONS[0];
    }

    function criarPokemonBase(def, x, y, dir) {
        const andaParaDireita = dir === 1;
        const imagemOlhaDireita = def.olhaPara === 'direita';
        const virar = andaParaDireita !== imagemOlhaDireita;

        const $img = $('<img>').attr({ src: def.srcImg, alt: def.nome }).toggleClass('vira', virar);
        const $hp = $('<div class="hp"><i></i></div>');
        if (def.vida === 1) $hp.hide();

        const $el = $('<div class="pokemon">')
            .append($hp)
            .append($('<div class="corpo">').append($img))
            .css({ left: x - METADE, top: y - METADE, zIndex: Math.round(y) });

        if (modoEspecial) {
            $el.addClass('especial');
        }

        $arena.append($el);
        jogo.pokemons.push({ def: def, $el: $el, x: x, y: y, dir: dir, vida: def.vida, morto: false });
    }

    function criarPokemon(m) {
        const def = sortearPokemon();
        const doLado = Math.random() < 0.5 ? 'esq' : 'dir';
        const dir = doLado === 'esq' ? 1 : -1;
        const x = doLado === 'esq' ? -METADE : m.W + METADE;
        const y = m.yTiro + (Math.random() * 2 - 1) * 50;
        criarPokemonBase(def, x, y, dir);
    }

    function criarPersonagemEspecial(m) {
        const def = LISTA_PERSONAGENS_ESPECIAIS[Math.floor(Math.random() * LISTA_PERSONAGENS_ESPECIAIS.length)];
        const doLadoEsquerdo = Math.random() < 0.5;
        const dir = doLadoEsquerdo ? 1 : -1;
        const x = doLadoEsquerdo ? -METADE : m.W + METADE;
        const y = m.yTiro + (Math.random() * 2 - 1) * 50;
        const alvo = { ...def, olhaPara: dir === 1 ? 'direita' : 'esquerda' };
        criarPokemonBase(alvo, x, y, dir);
    }

    function iniciarBossFinal() {
        $arena.find('.pokemon, .bola, .flutua').remove();

        modoEspecial = true;
        modoBossFinal = true;
        jogo.ativo = true;
        jogo.pontos = 0;
        jogo.vida = VIDA_MAXIMA;
        jogo.tempo = 0;
        jogo.proxSpawn = 9999;
        proximoSpawnEspecial = 1000;
        jogo.ultimoTiro = 0;
        jogo.pokemons = [];
        jogo.bolas = [];

        atualizarHud();
        mostrarMensagemEspecial();
        mostrarTela('jogo');

        if (!loopRodando) {
            loopRodando = true;
            jogo.ultimoFrame = performance.now();
            requestAnimationFrame(loop);
        }
    }

    function lancarBola(dir) {
        const agora = performance.now();
        if (agora - jogo.ultimoTiro < COOLDOWN_TIRO) return;
        jogo.ultimoTiro = agora;

        const m = medidas();
        const $el = $('<div class="bola">')
            .addClass(dir < 0 ? 'esq' : 'dir')
            .css({ left: m.cx, top: m.yTiro });

        $arena.append($el);
        jogo.bolas.push({ $el: $el, x: m.cx, dir: dir });
    }

    function acertarPokemon(p) {
        p.vida--;
        p.$el.find('.hp i').css('width', (Math.max(p.vida, 0) / p.def.vida * 100) + '%');

        if (p.vida <= 0) {
            p.morto = true;

            if (p.def.nome === 'Benicio') {
                jogo.pontos += 67;
                $pontuacao.text(jogo.pontos);
                $('<div class="flutua">').text('+67')
                    .css({ left: p.x - 20, top: p.y - METADE, color: '#ffe066' })
                    .appendTo($arena);
            } else {
                jogo.pontos += p.def.pontos;
                $pontuacao.text(jogo.pontos);
                $('<div class="flutua">').text('+' + p.def.pontos)
                    .css({ left: p.x - 20, top: p.y - METADE })
                    .appendTo($arena);
            }

            if (p.def.nome === 'Pedro') {
                $('#arena').addClass('escurecido');
                setTimeout(function () {
                    $('#arena').removeClass('escurecido');
                }, 900);
            }

            if (p.def.nome === 'Davi') {
                $('#arena').addClass('psicodelico');
                setTimeout(function () {
                    $('#arena').removeClass('psicodelico');
                }, 1200);
            }

            p.$el.addClass('capturado');
            setTimeout(function () {
                p.$el.remove();
                $arena.find('.flutua').first().remove();
            }, 800);
        }
    }

    function causarDano(dano) {
        jogo.vida = Math.max(0, jogo.vida - dano);
        atualizarHud();

        $('#jogador').removeClass('dano');
        void $('#jogador')[0].offsetWidth;
        $('#jogador').addClass('dano');

        if (jogo.vida <= 0) {
            jogo.ativo = false;
            if (modoEspecial) {
                setTimeout(finalizarJogoEspecial, 700);
            } else {
                setTimeout(finalizarJogo, 700);
            }
        }
    }

    function atualizarHud() {
        $pontuacao.text(jogo.pontos);
        const pct = (jogo.vida / VIDA_MAXIMA) * 100;
        $('#vida-preenchimento')
            .css('width', pct + '%')
            .toggleClass('medio', pct <= 60 && pct > 30)
            .toggleClass('baixo', pct <= 30);
        $('#vida-texto').text('VIDA ' + jogo.vida);
    }

    function finalizarJogo() {
        $('#nome').prop('hidden', false).val('');
        $('#btn-salvar').text('Salvar recorde');
        $('#pontuacaoFinal').text('Pontuação: ' + jogo.pontos);
        mudarTela('resultado');
    }

    function lerRankingEspecial() {
        try {
            const dados = JSON.parse(localStorage.getItem('poke-defense-modo-especial') || '{}');
            if (Array.isArray(dados)) {
                const rankingLegado = {};
                dados.forEach(function (pontos, indice) {
                    const nome = 'Recorde especial antigo ' + (indice + 1);
                    rankingLegado['legado-' + (indice + 1)] = {
                        nome: nome,
                        pontuacao: Number(pontos) || 0
                    };
                });
                return rankingLegado;
            }
            return dados && typeof dados === 'object' ? dados : {};
        } catch (erro) {
            console.error('Falha ao ler o ranking especial:', erro);
            return {};
        }
    }

    function salvarRankingEspecial(nome, pontos) {
        const nomeLimpo = String(nome || '').trim();
        const pontosNumericos = Number(pontos) || 0;
        if (!nomeLimpo) throw new Error('O nome do jogador não pode ficar vazio.');

        const ranking = lerRankingEspecial();
        const chave = normalizarNomeRanking(nomeLimpo);
        const registroAtual = ranking[chave];
        if (registroAtual && pontosNumericos <= Number(registroAtual.pontuacao ?? 0)) {
            return false;
        }

        ranking[chave] = { nome: nomeLimpo, pontuacao: pontosNumericos };
        localStorage.setItem('poke-defense-modo-especial', JSON.stringify(ranking));
        return true;
    }

    function finalizarJogoEspecial() {
        $('#nome').val('').prop('hidden', false);
        $('#btn-salvar').text('Salvar pontuação especial');
        $('#pontuacaoFinal').text('Pontuação especial: ' + jogo.pontos);
        mostrarTela('resultado');
    }

    function disparouEasterEgg(nome) {
        return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes('venezuelanos');
    }

    async function salvarPontuacao() {
        if (modoEspecial) {
            const nome = $('#nome').val().trim();
            if (!nome) {
                alert('Digite seu nome!');
                return;
            }

            let salvouPontuacaoComum = false;
            try {
                if (pontuacaoComumPendente !== null) {
                    salvouPontuacaoComum = await salvarPontuacaoGlobal(nome, pontuacaoComumPendente);
                }
            } catch (erro) {
                console.error('Falha ao salvar a pontuação comum após o modo especial:', erro);
                alert('Não foi possível salvar a pontuação comum. Tente novamente.');
                return;
            }

            let salvouPontuacaoEspecial;
            try {
                salvouPontuacaoEspecial = salvarRankingEspecial(nome, jogo.pontos);
            } catch (erro) {
                console.error('Falha ao salvar no ranking especial:', erro);
                alert('Não foi possível salvar no ranking especial. Tente novamente.');
                return;
            }

            if (!salvouPontuacaoComum && !salvouPontuacaoEspecial) {
                alert('Nenhuma pontuação foi atualizada: este nome já tem pontuações iguais ou maiores nos dois modos.');
                return;
            }

            modoEspecial = false;
            modoBossFinal = false;
            pontuacaoComumPendente = null;
            $('#nome').prop('hidden', false).val('');
            $('#btn-salvar').text('Salvar recorde');
            mostrarTela('ranking');
            if (!salvouPontuacaoEspecial) {
                alert('A pontuação comum foi atualizada, mas a pontuação especial já era igual ou maior.');
            }
            return;
        }

        const nome = $('#nome').val().trim();
        if (nome === '') {
            alert('Digite seu nome!');
            return;
        }

        if (disparouEasterEgg(nome)) {
            pontuacaoComumPendente = Number(jogo.pontos) || 0;
            $('#nome').val('');
            iniciarBossFinal();
            return;
        }

        const pontos = Number(jogo.pontos) || 0;

        let salvouPontuacao;
        try {
            salvouPontuacao = await salvarPontuacaoGlobal(nome, pontos);
        } catch (erro) {
            console.error('Falha ao salvar no ranking global:', erro);
            alert('Não foi possível salvar no ranking global. Tente novamente.');
            return;
        }

        if (!salvouPontuacao) {
            alert('Esse nome já tem uma pontuação igual ou maior. Para usá-lo, faça uma pontuação maior.');
            return;
        }

        $('#nome').val('');
        mostrarTela('ranking');
    }

    async function atualizarRanking() {
        const ranking = await carregarRankingGlobal();
        const rankingEspecial = lerRankingEspecial();
        const $corpo = $('#tabela-ranking tbody').empty();
        const jogadoresPorNome = new Map();

        for (const jogador of ranking) {
            const chave = normalizarNomeRanking(jogador.nome);
            const especial = rankingEspecial[chave];
            jogadoresPorNome.set(chave, {
                nome: jogador.nome,
                pontos: jogador.pontos,
                pontosEspeciais: especial ? Number(especial.pontuacao) : null
            });
        }

        for (const [chave, especial] of Object.entries(rankingEspecial)) {
            if (!jogadoresPorNome.has(chave)) {
                jogadoresPorNome.set(chave, {
                    nome: especial.nome,
                    pontos: null,
                    pontosEspeciais: Number(especial.pontuacao)
                });
            }
        }

        const jogadores = Array.from(jogadoresPorNome.values()).sort(function (a, b) {
            if (a.pontos != null && b.pontos != null) return b.pontos - a.pontos;
            if (a.pontos != null) return -1;
            if (b.pontos != null) return 1;
            return b.pontosEspeciais - a.pontosEspeciais;
        });

        const top10 = jogadores.slice(0, 10);
        for (let i = 0; i < top10.length; i++) {
            const jogador = top10[i];
            const $tr = $('<tr>');

            $tr.append($('<td>').text(i + 1 + 'º'));
            $tr.append($('<td>').text(jogador.nome));
            $tr.append($('<td>').text(jogador.pontos ?? '—'));
            $tr.append($('<td>').text(jogador.pontosEspeciais ?? '—'));
            $corpo.append($tr);
        }

        if (jogadores.length === 0) {
            $corpo.append('<tr><td class="vazio" colspan="4">Nenhum recorde ainda!</td></tr>');
        }
    }

    $(document).on('click', '[data-tela]', function () {
        this.blur();
        mudarTela($(this).data('tela'));
    });

    $('#btn-iniciar').on('click', function () { this.blur(); iniciarNovoJogo(); });
    $('#btn-jogar-ranking').on('click', function () { this.blur(); iniciarNovoJogo(); });
    $('#btn-retomar').on('click', function () { this.blur(); retomarJogo(); });
    $('#btn-salvar').on('click', salvarPontuacao);

    $(document).on('keydown', function (e) {
        const k = e.key;

        if (telaAtual === 'resultado') {
            if (k === 'Enter') { e.preventDefault(); salvarPontuacao(); }
            return;
        }

        if (k === 'Escape') {
            if (telaAtual === 'jogo') mudarTela('pausa');
            else if (telaAtual === 'ranking' || telaAtual === 'tutorial' || telaAtual === 'creditos') mudarTela('inicial');
            else if (telaAtual === 'pausa') mudarTela('inicial');
            return;
        }

        if (k === 'Enter') {
            if (telaAtual === 'inicial') { e.preventDefault(); iniciarNovoJogo(); }
            else if (telaAtual === 'pausa') { e.preventDefault(); retomarJogo(); }
            return;
        }

        if (telaAtual === 'jogo') {
            const tecla = k.toLowerCase();
            if (k === 'ArrowLeft' || tecla === 'a') { e.preventDefault(); lancarBola(-1); }
            else if (k === 'ArrowRight' || tecla === 'd') { e.preventDefault(); lancarBola(1); }
        }
    });

    // começa na tela inicial
    mostrarTela('inicial');
});