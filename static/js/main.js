// UI State and Interactive Controls
document.addEventListener('DOMContentLoaded', function () {
    initMoodSelector();
    initAnalyticsCharts();
    initBreathingGuide();
    initPomodoroTimer();
    initAmbientSounds();
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
   2. Chart.js Implementation
   ========================================================================== */
function initAnalyticsCharts() {
    const moodCanvas = document.getElementById('moodTrendChart');
    const triggerCanvas = document.getElementById('triggersDistributionChart');

    if (!moodCanvas) return;

    // Retrieve data from data attributes
    const chartData = JSON.parse(moodCanvas.getAttribute('data-history') || '{}');
    const triggerData = JSON.parse(triggerCanvas?.getAttribute('data-triggers') || '{}');

    // Custom Font Config
    const chartFontConfig = {
        family: "'Inter', sans-serif",
        size: 11
    };

    // 1. Mood Trend Line Chart
    if (chartData.labels && chartData.labels.length > 0) {
        new Chart(moodCanvas, {
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
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1E293B',
                        titleColor: '#FFF',
                        bodyColor: '#E2E8F0',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const index = context.dataIndex;
                                const moodName = chartData.moods[index];
                                return ` Mood: ${moodName} (Score: ${context.raw}/5)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#9CA3AF', font: chartFontConfig }
                    },
                    y: {
                        min: 1,
                        max: 5,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#9CA3AF',
                            font: chartFontConfig,
                            stepSize: 1,
                            callback: function(value) {
                                const labels = { 1: 'Worst', 2: 'Stressed', 3: 'Neutral', 4: 'Calm', 5: 'Excellent' };
                                return labels[value] || value;
                            }
                        }
                    }
                }
            }
        });
    } else {
        // Draw empty message inside canvas container
        const container = moodCanvas.parentElement;
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6B7280;font-size:0.9rem;">Log your mood to start seeing trends.</div>';
    }

    // 2. Trigger Frequency Bar Chart
    if (triggerCanvas && Object.keys(triggerData).length > 0) {
        const labels = Object.keys(triggerData);
        const data = Object.values(triggerData);

        new Chart(triggerCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.45)', // Red
                        'rgba(245, 158, 11, 0.45)', // Orange
                        'rgba(16, 185, 129, 0.45)', // Emerald
                        'rgba(6, 182, 212, 0.45)',  // Cyan
                        'rgba(139, 92, 246, 0.45)', // Purple
                        'rgba(236, 72, 153, 0.45)'  // Pink
                    ],
                    borderColor: [
                        '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EC4899'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1E293B',
                        titleColor: '#FFF',
                        bodyColor: '#E2E8F0',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9CA3AF', font: chartFontConfig }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#9CA3AF', font: chartFontConfig, stepSize: 1 }
                    }
                }
            }
        });
    } else if (triggerCanvas) {
        const container = triggerCanvas.parentElement;
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6B7280;font-size:0.9rem;">No triggers logged yet.</div>';
    }
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
            modeTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
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
