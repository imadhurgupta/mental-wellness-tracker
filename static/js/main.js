document.addEventListener('DOMContentLoaded', function () {
    initMoodSelector();
    initAnalyticsCharts();
    initRealtimeCharts();
    initBreathingGuide();
    initPomodoroTimer();
    initAmbientSounds();
    initCommunityHub();
    initAlertDismissal();
    initFormConfirmations();
});

/* ==========================================================================
   1. Mood Selector Controls
   ========================================================================== */
function initMoodSelector() {
    const moodButtons = document.querySelectorAll('.mood-btn');
    const moodInput = document.getElementById('selected-mood-input');
    
    if (!moodButtons.length || !moodInput) return;

    // Define colors for selected states
    const moodThemes = {
        'Happy': { bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981', shadow: 'rgba(16, 185, 129, 0.2)' },
        'Motivated': { bg: 'rgba(245, 158, 11, 0.15)', border: '#F59E0B', shadow: 'rgba(245, 158, 11, 0.2)' },
        'Calm': { bg: 'rgba(59, 130, 246, 0.15)', border: '#3B82F6', shadow: 'rgba(59, 130, 246, 0.2)' },
        'Tired': { bg: 'rgba(156, 163, 175, 0.15)', border: '#9CA3AF', shadow: 'rgba(156, 163, 175, 0.2)' },
        'Self-Doubt': { bg: 'rgba(139, 92, 246, 0.15)', border: '#8B5CF6', shadow: 'rgba(139, 92, 246, 0.2)' },
        'Stressed': { bg: 'rgba(239, 68, 68, 0.15)', border: '#EF4444', shadow: 'rgba(239, 68, 68, 0.2)' },
        'Anxious': { bg: 'rgba(236, 72, 153, 0.15)', border: '#EC4899', shadow: 'rgba(236, 72, 153, 0.2)' },
        'Burned Out': { bg: 'rgba(220, 38, 38, 0.2)', border: '#DC2626', shadow: 'rgba(220, 38, 38, 0.3)' }
    };

    moodButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            // Remove active state from all buttons
            moodButtons.forEach(b => {
                b.classList.remove('active');
                b.style.removeProperty('--active-glow-bg');
                b.style.removeProperty('--active-glow-color');
                b.style.removeProperty('--active-glow-shadow');
            });

            // Add active class and set customized CSS variables for coloring
            const mood = this.getAttribute('data-mood');
            this.classList.add('active');
            moodInput.value = mood;

            const theme = moodThemes[mood] || { bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.2)', shadow: 'rgba(255, 255, 255, 0.1)' };
            this.style.setProperty('--active-glow-bg', theme.bg);
            this.style.setProperty('--active-glow-color', theme.border);
            this.style.setProperty('--active-glow-shadow', theme.shadow);
        });
    });
}

/* ==========================================================================
   2. Chart.js Implementation (module-scoped instances for live updates)
   ========================================================================== */

// Module-scope chart instances and container refs — set once, reused by polling
let _moodChart     = null;
let _triggerChart  = null;
let _latestMoods   = [];
let _moodContainer    = null;  // .chart-container for mood chart
let _triggerContainer = null;  // .chart-container for trigger chart

const CHART_FONT = { family: "'Inter', sans-serif", size: 11 };
const BAR_BG_COLORS = [
    'rgba(239, 68, 68, 0.45)',
    'rgba(245, 158, 11, 0.45)',
    'rgba(16, 185, 129, 0.45)',
    'rgba(6, 182, 212, 0.45)',
    'rgba(139, 92, 246, 0.45)',
    'rgba(236, 72, 153, 0.45)',
    'rgba(251, 191, 36, 0.45)'
];
const BAR_BORDER_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EC4899', '#FBBF24'];

// Shared "no data" placeholder HTML
const NO_MOOD_MSG    = '<div class="chart-empty-msg">Log your mood to start seeing trends.</div>';
const NO_TRIGGER_MSG = '<div class="chart-empty-msg">No stress triggers logged yet.</div>';

function buildMoodChart(canvas, chartData) {
    _latestMoods = chartData.moods || [];
    return new Chart(canvas, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Mood Level',
                data: chartData.scores,
                borderColor: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: '#C084FC',
                pointBorderColor: '#0B0F19',
                pointHoverRadius: 8,
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700, easing: 'easeInOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E293B',
                    titleColor: '#FFF',
                    bodyColor: '#E2E8F0',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const moodName = _latestMoods[context.dataIndex] || '';
                            return ` Mood: ${moodName} (Score: ${context.raw}/5)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#9CA3AF', font: CHART_FONT }
                },
                y: {
                    min: 1, max: 5,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#9CA3AF',
                        font: CHART_FONT,
                        stepSize: 1,
                        callback: v => ({ 1:'Worst', 2:'Stressed', 3:'Neutral', 4:'Calm', 5:'Excellent' }[v] || v)
                    }
                }
            }
        }
    });
}

function buildTriggerChart(canvas, triggerData) {
    const labels = Object.keys(triggerData);
    const data   = Object.values(triggerData);
    return new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: BAR_BG_COLORS.slice(0, labels.length),
                borderColor:     BAR_BORDER_COLORS.slice(0, labels.length),
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700, easing: 'easeInOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E293B',
                    titleColor: '#FFF',
                    bodyColor: '#E2E8F0',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#9CA3AF', font: CHART_FONT }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#9CA3AF', font: CHART_FONT, stepSize: 1 }
                }
            }
        }
    });
}

/**
 * Creates a fresh <canvas> inside a container and returns it.
 * Wipes any existing "no data" overlay first.
 */
function _spawnCanvas(container, id) {
    container.innerHTML = '';
    const c = document.createElement('canvas');
    c.id = id;
    container.appendChild(c);
    return c;
}

/**
 * Renders the "no data yet" placeholder inside a container.
 * Removes any existing canvas so Chart.js won't complain.
 */
function _showNoDataMsg(container, html) {
    container.innerHTML = html;
}

function initAnalyticsCharts() {
    // Grab card element — this is our reliable anchor (always in the DOM)
    const moodCard = document.getElementById('moodChartCard');
    if (!moodCard) return;  // Not on dashboard page

    // Store container references at module scope for later use by the polling loop
    _moodContainer    = moodCard.querySelector('.chart-container');
    const triggerCard = document.querySelector('.analytics-section .glass-card:last-child');
    _triggerContainer = triggerCard ? triggerCard.querySelector('.chart-container') : null;

    // Read initial data baked into the HTML by the server
    const moodCanvas    = _moodContainer ? _moodContainer.querySelector('canvas') : null;
    const triggerCanvas = _triggerContainer ? _triggerContainer.querySelector('canvas') : null;

    const chartData   = moodCanvas    ? JSON.parse(moodCanvas.getAttribute('data-history')  || '{}') : {};
    const triggerData = triggerCanvas ? JSON.parse(triggerCanvas.getAttribute('data-triggers') || '{}') : {};

    // Mood chart: render if server gave us data, otherwise show placeholder
    if (chartData.labels && chartData.labels.length > 0) {
        _moodChart = buildMoodChart(moodCanvas, chartData);
    } else if (_moodContainer) {
        _showNoDataMsg(_moodContainer, NO_MOOD_MSG);
    }

    // Trigger chart
    if (triggerData && Object.keys(triggerData).length > 0 && triggerCanvas) {
        _triggerChart = buildTriggerChart(triggerCanvas, triggerData);
    } else if (_triggerContainer) {
        _showNoDataMsg(_triggerContainer, NO_TRIGGER_MSG);
    }
}

/* ==========================================================================
   2b. Real-Time Chart Polling
   ========================================================================== */
function initRealtimeCharts() {
    // Anchor to the card element — always present on the dashboard page
    const moodCard = document.getElementById('moodChartCard');
    if (!moodCard) return;

    const POLL_MS       = 30000;   // 30 seconds
    const lastUpdatedEl = document.getElementById('chartLastUpdated');

    function updateTimestamp() {
        if (!lastUpdatedEl) return;
        const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        lastUpdatedEl.textContent = `Updated ${t}`;
    }

    function applyChartUpdate(newChartData, newTriggerData) {
        const hasMoodData    = newChartData   && newChartData.labels && newChartData.labels.length > 0;
        const hasTriggerData = newTriggerData && Object.keys(newTriggerData).length > 0;

        // ── Mood Line Chart ──────────────────────────────────────────────────
        if (hasMoodData) {
            if (_moodChart) {
                // In-place update: mutate data arrays and call update()
                _latestMoods = newChartData.moods;
                _moodChart.data.labels           = newChartData.labels;
                _moodChart.data.datasets[0].data = newChartData.scores;
                _moodChart.update('active');
            } else if (_moodContainer) {
                // First data arrived after page loaded with no logs — build chart now
                const canvas = _spawnCanvas(_moodContainer, 'moodTrendChart');
                _moodChart = buildMoodChart(canvas, newChartData);
            }
        }

        // ── Trigger Bar Chart ────────────────────────────────────────────────
        if (hasTriggerData) {
            if (_triggerChart) {
                const labels = Object.keys(newTriggerData);
                const data   = Object.values(newTriggerData);
                _triggerChart.data.labels                       = labels;
                _triggerChart.data.datasets[0].data             = data;
                _triggerChart.data.datasets[0].backgroundColor  = BAR_BG_COLORS.slice(0, labels.length);
                _triggerChart.data.datasets[0].borderColor      = BAR_BORDER_COLORS.slice(0, labels.length);
                _triggerChart.update('active');
            } else if (_triggerContainer) {
                const canvas = _spawnCanvas(_triggerContainer, 'triggersDistributionChart');
                _triggerChart = buildTriggerChart(canvas, newTriggerData);
            }
        }

        updateTimestamp();
    }

    function fetchAndUpdate() {
        fetch('/api/chart-data', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(payload => applyChartUpdate(payload.chart_data, payload.trigger_counts))
            .catch(err  => console.warn('[RealTimeChart] Poll failed:', err));
    }

    // Set initial timestamp label
    updateTimestamp();

    // ① Immediate fetch — show fresh data right on page load (no 30-second wait)
    fetchAndUpdate();

    // ② Start recurring poll every 30 s
    setInterval(fetchAndUpdate, POLL_MS);
}


/* ==========================================================================
   3. Box Breathing Guide
   ========================================================================== */
function initBreathingGuide() {
    const circle = document.getElementById('breathingCircle');
    const instruction = document.getElementById('breathingInstruction');
    const secondsDisplay = document.getElementById('breathingSeconds');
    const startBtn = document.getElementById('btnStartBreathing');
    
    if (!circle || !instruction || !secondsDisplay || !startBtn) return;

    let timerId = null;
    let secondsLeft = 4;
    let cycleState = 0; // 0: Inhale, 1: Hold, 2: Exhale, 3: Hold empty
    let isRunning = false;

    const states = [
        { name: 'inhale', text: 'Inhale Slowly...', class: 'inhale' },
        { name: 'hold1', text: 'Hold Breath...', class: 'hold' },
        { name: 'exhale', text: 'Exhale Gently...', class: 'exhale' },
        { name: 'hold2', text: 'Hold Empty...', class: 'hold-empty' }
    ];

    function updateBreathingCycle() {
        if (!isRunning) return;

        secondsDisplay.textContent = `${secondsLeft}s`;

        if (secondsLeft === 0) {
            // Move to next state
            cycleState = (cycleState + 1) % 4;
            const nextState = states[cycleState];
            
            // Apply proper animations and styles
            circle.className = 'breathing-circle ' + nextState.class;
            instruction.textContent = nextState.text;
            
            secondsLeft = 4; // Box breathing is 4-4-4-4
        } else {
            secondsLeft--;
        }

        timerId = setTimeout(updateBreathingCycle, 1000);
    }

    function startBreathing() {
        isRunning = true;
        startBtn.textContent = 'Pause Session';
        startBtn.classList.add('active');
        
        cycleState = 0;
        secondsLeft = 4;
        const startState = states[cycleState];
        
        circle.className = 'breathing-circle ' + startState.class;
        instruction.textContent = startState.text;
        secondsDisplay.textContent = '4s';
        
        timerId = setTimeout(updateBreathingCycle, 1000);
    }

    function pauseBreathing() {
        isRunning = false;
        clearTimeout(timerId);
        timerId = null;
        startBtn.textContent = 'Start Breathing';
        startBtn.classList.remove('active');
        circle.className = 'breathing-circle';
        instruction.textContent = 'Ready to Start';
        secondsDisplay.textContent = '4-4-4-4';
    }

    startBtn.addEventListener('click', function () {
        if (isRunning) {
            pauseBreathing();
        } else {
            startBreathing();
        }
    });
}

/* ==========================================================================
   4. Pomodoro Focus Timer
   ========================================================================== */
function initPomodoroTimer() {
    const timerText = document.getElementById('timerText');
    const startBtn = document.getElementById('btnStartTimer');
    const resetBtn = document.getElementById('btnResetTimer');
    const modeTabs = document.querySelectorAll('.mode-tab');
    
    if (!timerText || !startBtn || !resetBtn) return;

    let timerInterval = null;
    let totalSeconds = 1500; // 25 minutes default
    let isRunning = false;
    let currentMode = 'focus'; // focus, break, longBreak

    const modeDurations = {
        'focus': 1500,       // 25m
        'break': 300,        // 5m
        'longBreak': 900     // 15m
    };

    function updateTimerDisplay() {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        timerText.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Synthesize simple audio chime using Web Audio API
    function playChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            // Classic bell envelope
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1); // drop to A4
            
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1.5);
        } catch (e) {
            console.error("Audio chime synthesis failed:", e);
        }
    }

    function tick() {
        if (totalSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            isRunning = false;
            startBtn.textContent = 'Start';
            playChime();
            alert(`${currentMode === 'focus' ? 'Focus Session Completed!' : 'Break Time Completed!'} Well done.`);
            resetTimer();
        } else {
            totalSeconds--;
            updateTimerDisplay();
        }
    }

    function startTimer() {
        isRunning = true;
        startBtn.textContent = 'Pause';
        timerInterval = setInterval(tick, 1000);
    }

    function pauseTimer() {
        isRunning = false;
        startBtn.textContent = 'Start';
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function resetTimer() {
        pauseTimer();
        totalSeconds = modeDurations[currentMode];
        updateTimerDisplay();
    }

    startBtn.addEventListener('click', function () {
        if (isRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    });

    resetBtn.addEventListener('click', resetTimer);

    modeTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            modeTabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');
            
            currentMode = this.getAttribute('data-mode');
            resetTimer();
        });
    });

    // Run layout setup initially
    updateTimerDisplay();
}

/* ==========================================================================
   5. Web Audio API Ambient Sound Synthesizer
   ========================================================================== */
function initAmbientSounds() {
    const playRainBtn = document.getElementById('playRainBtn');
    const playWindBtn = document.getElementById('playWindBtn');
    
    if (!playRainBtn || !playWindBtn) return;

    let audioCtx = null;
    let rainSource = null;
    let windSource = null;

    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // Synthesize White Noise Buffer
    function createNoiseBuffer(duration = 2) {
        const ctx = getAudioContext();
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // Synthesize Brown/Pinkish Noise Buffer for Wind
    function createBrownNoiseBuffer(duration = 2) {
        const ctx = getAudioContext();
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            // Brownian filter integration
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; // Compensate volume level
        }
        return buffer;
    }

    // Build Rain Sound Graph
    function startRain() {
        const ctx = getAudioContext();
        const noise = ctx.createBufferSource();
        noise.buffer = createNoiseBuffer();
        noise.loop = true;

        // Bandpass filter to sculpt noise into raindrops
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.08; // Safe low volume

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        noise.start();
        return { source: noise, gain: gainNode };
    }

    // Build Wind Sound Graph
    function startWind() {
        const ctx = getAudioContext();
        const noise = ctx.createBufferSource();
        noise.buffer = createBrownNoiseBuffer();
        noise.loop = true;

        // Lowpass filter to simulate blowing sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 350;

        // LFO (Low-Frequency Oscillator) to modulate wind intensity slowly
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.15; // Slow sweep (6-7s)
        
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 180; // Modulate cut-off frequency by 180Hz

        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.15; // Safe low volume

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        lfo.start();
        noise.start();

        return { source: noise, lfo: lfo, gain: gainNode };
    }

    // Rain Button Toggle
    playRainBtn.addEventListener('click', function () {
        if (rainSource) {
            // Stop
            try {
                rainSource.source.stop();
            } catch (e) {}
            rainSource = null;
            this.textContent = 'Play Rain';
            this.classList.remove('active');
        } else {
            // Start
            try {
                rainSource = startRain();
                this.textContent = 'Stop Rain';
                this.classList.add('active');
            } catch (e) {
                console.error("Rain audio start failed:", e);
            }
        }
    });

    // Wind Button Toggle
    playWindBtn.addEventListener('click', function () {
        if (windSource) {
            // Stop
            try {
                windSource.source.stop();
                windSource.lfo.stop();
            } catch (e) {}
            windSource = null;
            this.textContent = 'Play Wind';
            this.classList.remove('active');
        } else {
            // Start
            try {
                windSource = startWind();
                this.textContent = 'Stop Wind';
                this.classList.add('active');
            } catch (e) {
                console.error("Wind audio start failed:", e);
            }
        }
    });
}

/* ==========================================================================
   6. Community Hub - AJax reactions & Expert Guided Audio Synth
   ========================================================================== */
function initCommunityHub() {
    // 1. AJax Peer Reactions
    const reactionForms = document.querySelectorAll('.reaction-form');
    reactionForms.forEach(form => {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const button = this.querySelector('button');
            const postId = this.getAttribute('data-post-id');
            const type = this.querySelector('input[name="reaction_type"]').value;
            
            fetch(`/community/react/${postId}`, {
                method: 'POST',
                body: new URLSearchParams(new FormData(this)),
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const countSpan = button.querySelector('.reaction-count');
                    countSpan.textContent = data.count;
                    if (data.action === 'added') {
                        button.classList.add('active');
                    } else {
                        button.classList.remove('active');
                    }
                }
            })
            .catch(err => console.error("Reaction toggle failed:", err));
        });
    });

    // 2. Synthesize Curated Guided Audio
    const audioCards = document.querySelectorAll('.audio-card');
    let activeAudioSource = null;
    let activeAudioCard = null;
    let audioCtx = null;
    let progressInterval = null;
    let secondsElapsed = 0;
    
    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function stopActiveAudio() {
        if (activeAudioSource) {
            try {
                activeAudioSource.stop();
                if (activeAudioSource.binauralOsc1) activeAudioSource.binauralOsc1.stop();
                if (activeAudioSource.binauralOsc2) activeAudioSource.binauralOsc2.stop();
            } catch (e) {}
            activeAudioSource = null;
        }
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        if (activeAudioCard) {
            activeAudioCard.classList.remove('playing');
            const playBtn = activeAudioCard.querySelector('.btn-audio-play');
            // Play icon
            playBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg>';
            const progressFill = activeAudioCard.querySelector('.audio-progress-fill');
            progressFill.style.width = '0%';
            activeAudioCard = null;
        }
    }

    // Synthesis engine for guided drones
    function startSynthesis(cardId, durationSeconds) {
        const ctx = getAudioContext();
        
        let sourceNode = {};
        
        if (cardId === 'sigh-grounder') {
            // Physiological Sigh Grounder: Synthesize soft periodic low drone + gentle sweep
            const masterGain = ctx.createGain();
            masterGain.gain.value = 0.25;
            masterGain.connect(ctx.destination);
            
            // Sub Drone (110Hz - A2)
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(110, ctx.currentTime);
            
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.08, ctx.currentTime);
            osc.connect(oscGain);
            oscGain.connect(masterGain);
            osc.start();
            
            // Soft white noise ocean wave filter sweeps to simulate inhales/exhales
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(300, ctx.currentTime);
            
            // LFO for breathing cycle
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // ~8s cycle
            
            const lfoGain = ctx.createGain();
            lfoGain.gain.setValueAtTime(150, ctx.currentTime);
            
            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);
            
            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(masterGain);
            
            lfo.start();
            noise.start();
            
            sourceNode.stop = function() {
                osc.stop();
                noise.stop();
                lfo.stop();
            };
        } else {
            // Focus Binaural Entrainment: 100Hz and 106Hz sine waves for 6Hz theta entrainment
            const masterGain = ctx.createGain();
            masterGain.gain.value = 0.2;
            masterGain.connect(ctx.destination);
            
            const oscL = ctx.createOscillator();
            oscL.frequency.setValueAtTime(100, ctx.currentTime);
            const pannerL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
            if (pannerL) pannerL.pan.value = -1;
            
            const oscR = ctx.createOscillator();
            oscR.frequency.setValueAtTime(106, ctx.currentTime);
            const pannerR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
            if (pannerR) pannerR.pan.value = 1;
            
            const gainL = ctx.createGain();
            gainL.gain.value = 0.08;
            const gainR = ctx.createGain();
            gainR.gain.value = 0.08;
            
            if (pannerL && pannerR) {
                oscL.connect(gainL).connect(pannerL).connect(masterGain);
                oscR.connect(gainR).connect(pannerR).connect(masterGain);
            } else {
                oscL.connect(gainL).connect(masterGain);
                oscR.connect(gainR).connect(masterGain);
            }
            
            oscL.start();
            oscR.start();
            
            sourceNode.binauralOsc1 = oscL;
            sourceNode.binauralOsc2 = oscR;
            sourceNode.stop = function() {
                oscL.stop();
                oscR.stop();
            };
        }
        
        return sourceNode;
    }

    audioCards.forEach(card => {
        const playBtn = card.querySelector('.btn-audio-play');
        const progressFill = card.querySelector('.audio-progress-fill');
        const cardId = card.getAttribute('data-audio-id');
        const duration = parseInt(card.getAttribute('data-duration') || '120');
        
        playBtn.addEventListener('click', function () {
            if (activeAudioCard === card) {
                stopActiveAudio();
            } else {
                stopActiveAudio();
                
                activeAudioCard = card;
                card.classList.add('playing');
                playBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
                
                try {
                    activeAudioSource = startSynthesis(cardId, duration);
                } catch (e) {
                    console.error("Meditation synthesis failed:", e);
                }
                
                secondsElapsed = 0;
                progressInterval = setInterval(function () {
                    secondsElapsed++;
                    const percent = (secondsElapsed / duration) * 100;
                    progressFill.style.width = `${percent}%`;
                    
                    if (secondsElapsed >= duration) {
                        stopActiveAudio();
                    }
                }, 1000);
            }
        });
    });
}

/* ==========================================================================
   7. CSP-Compliant Event Listeners (Alerts and Confirmations)
   ========================================================================== */
function initAlertDismissal() {
    document.addEventListener('click', function (e) {
        const closeBtn = e.target.closest('.alert-close');
        if (closeBtn) {
            closeBtn.parentElement.style.display = 'none';
        }
    });
}

function initFormConfirmations() {
    document.addEventListener('submit', function (e) {
        const form = e.target.closest('form[data-confirm]');
        if (form) {
            const msg = form.getAttribute('data-confirm');
            if (!confirm(msg)) {
                e.preventDefault();
            }
        }
    });
}

