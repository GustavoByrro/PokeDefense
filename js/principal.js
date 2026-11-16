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
        { nome: 'Pikachu',   vida: 1, dano: 10, pontos: 10, velocidade: 170, peso: 4, olhaPara: 'esquerda', srcImg: 'imgs/pikachu.png' },
        { nome: 'Arcanine',  vida: 2, dano: 20, pontos: 25, velocidade: 130, peso: 3, olhaPara: 'esquerda', srcImg: 'imgs/arcanine.png' },
        { nome: 'Rhydon',    vida: 3, dano: 25, pontos: 40, velocidade: 85,  peso: 2, olhaPara: 'esquerda', srcImg: 'imgs/rhydon.png' },
        { nome: 'Dragonite', vida: 4, dano: 35, pontos: 80, velocidade: 65,  peso: 1, olhaPara: 'esquerda', srcImg: 'imgs/dragonite.png' }
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

    let jogadores = carregarJogadores();

    const $arena = $('#arena');
    const $pontuacao = $('#pontuacao');

  
    function mostrarTela(id) {
        $('.tela').hide();
        $('#' + id).show();
        telaAtual = id;
        if (id === 'ranking') atualizarRanking();
        if (id === 'resultado') $('#nome').trigger('focus');
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

        // --- spawn (fica mais rápido com o tempo) ---
        jogo.proxSpawn -= dt * 1000;
        if (jogo.proxSpawn <= 0) {
            criarPokemon(m);
            const intervalo = Math.max(700, 2200 - jogo.tempo * 25);
            jogo.proxSpawn = intervalo * (0.7 + Math.random() * 0.6);
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
        const aceleracao = Math.min(1 + jogo.tempo / 120, 1.8);
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

    function criarPokemon(m) {
        const def = sortearPokemon();
        const doLado = Math.random() < 0.5 ? 'esq' : 'dir';
        const dir = doLado === 'esq' ? 1 : -1;          // esq -> anda para a direita
        const x = doLado === 'esq' ? -METADE : m.W + METADE;
        const y = m.yTiro + (Math.random() * 2 - 1) * 50; // "profundidade" na areia

        // vira a imagem para o lado em que ele está andando
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

        $arena.append($el);
        jogo.pokemons.push({ def: def, $el: $el, x: x, y: y, dir: dir, vida: def.vida, morto: false });
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
            jogo.pontos += p.def.pontos;
            $pontuacao.text(jogo.pontos);

            p.$el.addClass('capturado');
            $('<div class="flutua">').text('+' + p.def.pontos)
                .css({ left: p.x - 20, top: p.y - METADE })
                .appendTo($arena);
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
            setTimeout(finalizarJogo, 700);
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
        $('#pontuacaoFinal').text('Pontuação: ' + jogo.pontos);
        mudarTela('resultado');
    }
 function carregarJogadores() {
        try {
            return JSON.parse(localStorage.getItem('jogadores')) || [];
        } catch (e) {
            return [];
        }
    }

    function salvarPontuacao() {
        const nome = $('#nome').val().trim();
        if (nome === '') {
            alert('Digite seu nome!');
            return;
        }

        const existente = jogadores.find(j => j.nome.toLowerCase() === nome.toLowerCase());
        if (existente) {
            if (jogo.pontos > existente.pontos) existente.pontos = jogo.pontos;
        } else {
            jogadores.push({ nome: nome, pontos: jogo.pontos });
        }

        localStorage.setItem('jogadores', JSON.stringify(jogadores));
        $('#nome').val('');
        mudarTela('ranking');
    }

    function atualizarRanking() {
        jogadores.sort((a, b) => b.pontos - a.pontos); // maior primeiro
        const $corpo = $('#tabela-ranking tbody').empty();

        if (jogadores.length === 0) {
            $corpo.append('<tr><td class="vazio" colspan="3">Nenhum recorde ainda!</td></tr>');
            return;
        }

        const classes = ['ouro', 'prata', 'bronze'];
        const medalhas = ['🥇', '🥈', '🥉'];

        jogadores.forEach(function (j, i) {
            $('<tr>')
                .addClass(classes[i] || '')
                .append($('<td>').text(i < 3 ? medalhas[i] : (i + 1) + 'º'))
                .append($('<td>').text(j.nome))
                .append($('<td>').text(j.pontos))
                .appendTo($corpo);
        });
    }

    $(document).on('click', '[data-tela]', function () {
        this.blur();
        mudarTela($(this).data('tela'));
    });

    $('#btn-iniciar').on('click', function () { this.blur(); iniciarNovoJogo(); });
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
            else if (telaAtual === 'ranking' || telaAtual === 'tutorial') mudarTela('inicial');
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
