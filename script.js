/* ===================== ЧАСТИЦЫ: пепел + искры, реагируют на курсор ===================== */
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
const rippleCanvas = document.getElementById('ripples');
const rctx = rippleCanvas.getContext('2d');
let W, H;
function resize(){
  W = canvas.width = rippleCanvas.width = window.innerWidth;
  H = canvas.height = rippleCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const mouse = { x: W/2, y: H/2, active:false };
window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;

  // лёгкий параллакс-наклон сцены
  const nx = (e.clientX / W - 0.5) * 2;
  const ny = (e.clientY / H - 0.5) * 2;
  document.documentElement.style.setProperty('--tiltX', (nx * 4).toFixed(2) + 'deg');
  document.documentElement.style.setProperty('--tiltY', (-ny * 4).toFixed(2) + 'deg');

  // курсор оставляет за собой пару искр
  if(Math.random() < 0.35) spawnCursorSpark(e.clientX, e.clientY);
});
window.addEventListener('mouseleave', () => { mouse.active = false; });

const PARTICLE_COUNT = 90;
const particles = [];

function makeParticle(){
  const isSpark = Math.random() < 0.45;
  return {
    x: Math.random()*W,
    y: Math.random()*H,
    r: isSpark ? Math.random()*1.6+0.6 : Math.random()*2.2+0.8,
    speedY: isSpark ? -(Math.random()*0.5+0.25) : (Math.random()*0.3+0.1),
    speedX: (Math.random()-0.5)*0.3,
    alpha: Math.random()*0.5+0.2,
    flicker: Math.random()*0.02+0.005,
    isSpark,
    trail: false
  };
}
for(let i=0;i<PARTICLE_COUNT;i++) particles.push(makeParticle());

function spawnCursorSpark(x,y){
  if(particles.length > PARTICLE_COUNT + 40) return;
  particles.push({
    x: x + (Math.random()-0.5)*10,
    y: y + (Math.random()-0.5)*10,
    r: Math.random()*1.4+0.5,
    speedY: -(Math.random()*0.8+0.4),
    speedX: (Math.random()-0.5)*0.6,
    alpha: 0.8,
    flicker: 0.04,
    isSpark: true,
    trail: true,
    life: 90
  });
}

function drawParticles(){
  ctx.clearRect(0,0,W,H);
  for(let idx = particles.length - 1; idx >= 0; idx--){
    const p = particles[idx];

    // отталкивание/притяжение курсором
    if(mouse.active){
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if(dist < 90 && dist > 0.1){
        const force = (90 - dist) / 90 * 0.6;
        p.x += (dx/dist) * force;
        p.y += (dy/dist) * force;
      }
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    if(p.isSpark){
      ctx.fillStyle = `rgba(196,8,8,${p.alpha})`;
      ctx.shadowColor = 'rgba(196,8,8,0.8)';
      ctx.shadowBlur = 6;
    } else {
      ctx.fillStyle = `rgba(185,178,173,${p.alpha*0.6})`;
      ctx.shadowBlur = 0;
    }
    ctx.fill();

    p.y += p.speedY;
    p.x += p.speedX;
    p.alpha += (Math.random()-0.5)*p.flicker;
    p.alpha = Math.max(0.05, Math.min(0.8, p.alpha));

    if(p.trail){
      p.life--;
      p.alpha -= 0.01;
      if(p.life <= 0 || p.alpha <= 0){
        particles.splice(idx,1);
        continue;
      }
    } else if(p.y < -10 || p.y > H+10 || p.x < -10 || p.x > W+10){
      Object.assign(p, makeParticle());
      p.y = p.isSpark ? H+10 : -10;
    }
  }
  requestAnimationFrame(drawParticles);
}
drawParticles();

/* ===================== РЯБЬ ОТ КЛИКА ===================== */
const ripples = [];
window.addEventListener('click', (e) => {
  if(e.target.closest('#controls') || e.target.closest('#start-screen') || e.target.closest('#replay-btn')) return;
  ripples.push({ x:e.clientX, y:e.clientY, r:2, alpha:0.6 });
});
function drawRipples(){
  rctx.clearRect(0,0,W,H);
  for(let i = ripples.length-1; i>=0; i--){
    const rp = ripples[i];
    rctx.beginPath();
    rctx.arc(rp.x, rp.y, rp.r, 0, Math.PI*2);
    rctx.strokeStyle = `rgba(196,8,8,${rp.alpha})`;
    rctx.lineWidth = 1.4;
    rctx.stroke();
    rp.r += 2.2;
    rp.alpha -= 0.015;
    if(rp.alpha <= 0) ripples.splice(i,1);
  }
  requestAnimationFrame(drawRipples);
}
drawRipples();

/* ===================== СВЕЧЕНИЕ, СИНХРОНИЗИРОВАННОЕ СО ЗВУКОМ ===================== */
const root = document.documentElement;
let analyser, dataArray, audioCtx;

function setupAudioAnalyser(){
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(document.getElementById('bg-music'));
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    pulseFromAudio();
  }catch(e){
    console.warn('Audio analyser недоступен, используется базовая пульсация', e);
  }
}
function pulseFromAudio(){
  if(analyser){
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a,b)=>a+b,0)/dataArray.length;
    const intensity = Math.min(0.9, 0.2 + (avg/255)*0.9);
    root.style.setProperty('--glow', intensity.toFixed(3));
  }
  requestAnimationFrame(pulseFromAudio);
}

/* ===================== ЗВУК: mute-кнопка ===================== */
const music = document.getElementById('bg-music');
const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  music.muted = !music.muted;
  muteBtn.textContent = music.muted ? '🔇' : '🔊';
});

/* ===================== ПЕЧАТНАЯ МАШИНКА ===================== */
const lines = [
  { text: "Инициализация протокола...", accent:true },
  { text: "Доступ разрешен.", accent:true },
  { text: "16 июля 2026 года. 20:48." },
  { text: "Точное время, когда жизнь изменилась навсегда." },
  { text: "Момент, когда Темный Князь впервые услышал голос своей Дьяволицы. Сегодня ровно 30 дней нашему Завету." },
  { text: "30 дней, как ты сняла свою глухую броню." },
  { text: "30 дней, как я стал твоей 183-сантиметровой крепостью." },
  { text: "30 дней, как я заново научился доверять." },
  { text: "30 дней, как мы прошли моменты от смеха до слёз, пройдя это вместе." },
  { text: "Ты открыла мне свою душу, открыла свои страхи, что я безмерно ценю. Я буду оставаться таким же терпеливым и заботливым, чтобы ты чувствовала себя в безопасности." },
  { text: "Потому что ты — идеальна." },
  { text: "Твоя улыбка, от которой я начинаю расплываться, твой голос, который успокаивает, твоя стеснительность и твоя дикая энергия." },
  { text: "Я безмерно благодарен тебе за все, что мы пережили, за то как ты успокаивала меня, за то как я загнался из-за денег, а ты успокаивала меня как котёнка. В твоих руках я могу быть полностью безоружным, потому что ты единственная, перед кем я беззащитен." },
  { text: "Это только первый месяц нашей вечности, Солнышко." },
  { text: "Жди октября, моя Суккуба." },
  { text: "Дальше — только больше." },
  { text: "Дальше — только мы." },
];

const terminal = document.getElementById('terminal');
const skipHint = document.getElementById('skip-hint');
const TYPE_SPEED = 32; // мс на символ
const PAUSE_AFTER_LINE = 1500; // мс

let skipCurrentLine = false;
terminal.addEventListener('click', () => { skipCurrentLine = true; });

function typeLine(index){
  if(index >= lines.length){
    skipHint.classList.remove('show');
    setTimeout(triggerFinale, 1200);
    return;
  }
  skipHint.classList.add('show');
  const lineObj = lines[index];
  const p = document.createElement('div');
  p.className = 'line' + (lineObj.accent ? ' accent' : '');
  terminal.appendChild(p);

  const cursor = document.createElement('span');
  cursor.className = 'cursor';

  let i = 0;
  skipCurrentLine = false;

  function typeChar(){
    if(skipCurrentLine){
      p.textContent = lineObj.text;
      p.appendChild(cursor);
      terminal.scrollTop = terminal.scrollHeight;
      setTimeout(()=>{ cursor.remove(); typeLine(index+1); }, 300);
      return;
    }
    if(i < lineObj.text.length){
      p.textContent = lineObj.text.slice(0, i+1);
      p.appendChild(cursor);
      i++;
      terminal.scrollTop = terminal.scrollHeight;
      setTimeout(typeChar, TYPE_SPEED);
    } else {
      cursor.remove();
      setTimeout(()=>typeLine(index+1), PAUSE_AFTER_LINE);
    }
  }
  typeChar();
}

/* ===================== СЧЁТЧИК ДНЕЙ ===================== */
function animateCounter(){
  const el = document.getElementById('day-counter');
  const num = el.querySelector('b');
  el.classList.add('show');
  let n = 0;
  const target = 30;
  const step = setInterval(() => {
    n++;
    num.textContent = n;
    if(n >= target) clearInterval(step);
  }, 45);
}

function triggerFinale(){
  const stage = document.getElementById('stage');
  stage.classList.add('glitch');
  setTimeout(()=>{
    stage.classList.remove('glitch');
    document.getElementById('finale').classList.add('show');
    setTimeout(()=>{
      document.getElementById('signature').classList.add('show');
    }, 900);
    setTimeout(()=>{
      document.getElementById('replay-btn').classList.add('show');
    }, 1000);
  }, 500);
}

/* ===================== ИНТЕРАКТИВНОЕ СЕРДЦЕ ===================== */
const demonWrap = document.getElementById('demon-wrap');
const heart = document.getElementById('heart');
demonWrap.addEventListener('click', () => {
  heart.classList.remove('pulse-strong');
  void heart.offsetWidth; // рестарт анимации
  heart.classList.add('pulse-strong');
  const rect = demonWrap.getBoundingClientRect();
  for(let i=0;i<14;i++){
    spawnCursorSpark(
      rect.left + rect.width/2 + (Math.random()-0.5)*40,
      rect.top + rect.height/2 + (Math.random()-0.5)*40
    );
  }
});

/* ===================== ПОВТОР ===================== */
document.getElementById('replay-btn').addEventListener('click', () => {
  terminal.innerHTML = '';
  document.getElementById('finale').classList.remove('show');
  document.getElementById('signature').classList.remove('show');
  document.getElementById('replay-btn').classList.remove('show');
  document.getElementById('day-counter').classList.remove('show');
  document.getElementById('day-counter').querySelector('b').textContent = '0';
  setTimeout(()=>{
    typeLine(0);
    animateCounter();
  }, 400);
});

/* ===================== СТАРТ ПО КЛИКУ ===================== */
document.getElementById('start-screen').addEventListener('click', () => {
  const screen = document.getElementById('start-screen');
  screen.classList.add('hidden');
  document.getElementById('controls').classList.add('show');

  music.volume = 0.55;
  music.play().catch(()=>console.warn('Автовоспроизведение заблокировано браузером — нужен файл music.mp3'));
  setupAudioAnalyser();

  setTimeout(()=>{
    typeLine(0);
    animateCounter();
  }, 600);
}, { once:true });
