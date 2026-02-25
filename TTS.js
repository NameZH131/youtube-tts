// ==UserScript==
// @name         YouTube 字幕TTS配音 
// @namespace    https://github.com/NameZH131
// @version      0.2.0-alpha
// @description  解析YouTube字幕元素（按class匹配）并进行TTS语音朗读，适配多行翻译字幕场景。由于有的视频的翻译不是一行一行的，需要安装别的翻译插件，基本是一行中文，一行中文，然后通过字幕元素的class解析。使用f12去复制，I do used to working with AI
// @author       NameZH131 (github：NameZH131)
// @match        *://*.youtube.com/watch*
// @icon         https://www.youtube.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @homepage     https://github.com/NameZH131/YouTube TTS（替换为你的仓库地址）
// @supportURL   https://github.com/NameZH131/YouTube TTS/issues（替换为你的issues地址）
// @license      MIT
// ==/UserScript==
(function() {
    'use strict';

    const STORAGE_KEY = 'youtubeSubReaderFinalFix';
    const defaultConfig = {
        customClass: '',
        useCustom: false,
        volume: 1,
        rate: 1,
        videoVol: 1,
        voiceName: '',
        autoRead: false,
        autoInterval: 1000,
        autoStopOnPlay: true,
        lang: 'zh',
    };

    let config = GM_getValue(STORAGE_KEY, defaultConfig);
    const synth = window.speechSynthesis;
    let panel = null;
    let voices = [];
    let video = null;
    let autoReadTimer = null;
    let prevParsedText = '';

    // ====================== 核心工具（修改：增加文本变化判断） ======================
    function saveConfig() { GM_setValue(STORAGE_KEY, config); }

    function hidePanel() {
        if (panel) {
            panel.style.display = 'none';
        }
    }

    function showPanel() {
        if (!panel) createPanel();
        panel.style.display = 'block';
    }

    function getVideoEl() {
        if (!video) video = document.querySelector('video');
        return video;
    }

    function getValidSelector() {
        if (!config.customClass.trim()) return '';
        return config.customClass.trim()
            .split(/\s+/)
            .filter(cls => cls)
            .map(cls => cls.startsWith('.') ? cls : `.${cls}`)
            .join('');
    }

    function forceParse() {
        const sel = getValidSelector();
        console.log('【调试】当前选择器：', sel);

        let els = [];
        try {
            const normalEls = document.querySelectorAll(sel);
            els = Array.from(normalEls);

            if (els.length === 0) {
                const walk = (node) => {
                    if (node.shadowRoot) {
                        try {
                            const shadowEls = node.shadowRoot.querySelectorAll(sel);
                            Array.from(shadowEls).forEach(el => els.push(el));
                        } catch (e) {
                            console.warn('【调试】shadow DOM查找失败：', e);
                        }
                    }
                    Array.from(node.children || []).forEach(walk);
                };
                walk(document.body);
            }
        } catch (e) {
            console.error('【调试】选择器错误：', e);
            return { text: '', error: `选择器错误：${e.message}` };
        }

        console.log('【调试】匹配到元素数量：', els.length);
        const text = els
            .map(el => (el.textContent || el.innerText || '').trim())
            .filter(t => t)
            .join(' ');
        console.log('【调试】解析到文本：', text);

        return { text, error: '' };
    }

    // 新增：判断文本是否发生变化的核心函数
    function isTextChanged() {
        const { text } = forceParse();
        // 文本为空且上一次也为空 → 无变化
        if (!text && !prevParsedText) return { changed: false, text: '' };
        // 文本内容不同 → 有变化
        if (text !== prevParsedText) {
            prevParsedText = text; // 更新历史文本
            return { changed: true, text };
        }
        // 文本内容相同 → 无变化
        return { changed: false, text };
    }

    // ====================== 朗读逻辑 ======================
    function loadVoices() {
        voices = synth.getVoices().filter(v => v.lang.includes('zh') || v.name.includes('Chinese'));
        if (panel) {
            const voiceSel = document.getElementById('voice-select');
            if (voiceSel) {
                voiceSel.innerHTML = voices.map(v =>
                    `<option value="${v.name}" ${v.name === config.voiceName ? 'selected' : ''}>${v.name} (${v.lang})</option>`
                ).join('');
            }
        }
    }

    function speakText(text) {
        const video = getVideoEl();
        if (config.autoStopOnPlay && video && !video.paused) {
            return;
        }

        if (synth.speaking) synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = config.volume;
        utterance.rate = config.rate;
        utterance.voice = voices.find(v => v.name === config.voiceName) || voices[0] || null;
        synth.speak(utterance);
    }

    // ====================== 自动朗读核心逻辑（修改：仅文本变化时处理） ======================
    function startAutoRead() {
        stopAutoRead();

        if (!config.useCustom || !config.customClass) {
            alert(getText('alertAutoRead'));
            config.autoRead = false;
            updateAutoReadUI();
            saveConfig();
            return;
        }

        autoReadTimer = setInterval(() => {
            if (!config.autoRead) return;

            const { changed, text } = isTextChanged();
            if (!changed) {
                return;
            }

            speakText(text);
            if (panel && panel.style.display !== 'none') {
                const resultEl = document.getElementById('result');
                if (resultEl) {
                    resultEl.innerHTML = `${getText('autoReading')}<br/>${text}`;
                    resultEl.style.color = '#2196F3';
                }
            }
        }, config.autoInterval);
    }

    function stopAutoRead() {
        if (autoReadTimer) {
            clearInterval(autoReadTimer);
            autoReadTimer = null;
        }
        console.log('【自动朗读】已停止');
    }

    function toggleAutoRead() {
        config.autoRead = !config.autoRead;
        saveConfig();
        updateAutoReadUI();

        if (config.autoRead) {
            startAutoRead();
        } else {
            stopAutoRead();
            if (synth.speaking) {
                synth.cancel();
            }
        }
    }

    function updateAutoReadUI() {
        const autoSwitch = document.getElementById('auto-read-switch');
        const autoBtn = document.getElementById('auto-read-btn');
        const intervalInput = document.getElementById('auto-interval');
        const autoStopCheckbox = document.getElementById('auto-stop-on-play');

        if (autoSwitch) autoSwitch.checked = config.autoRead;
        if (autoBtn) {
            autoBtn.textContent = config.autoRead ? getText('stopAutoRead') : getText('startAutoRead');
            autoBtn.style.background = config.autoRead ? '#f44336' : '#4CAF50';
        }
        if (intervalInput) intervalInput.value = config.autoInterval;
        if (autoStopCheckbox) autoStopCheckbox.checked = config.autoStopOnPlay;
    }

    // ====================== 面板 ======================
    function createPanel() {
        if (panel) return;
        panel = document.createElement('div');
        panel.id = 'sub-fix-panel';
        panel.style.cssText = `
            position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
            width:450px; background:#111; color:#fff; padding:20px; border-radius:10px;
            z-index:9999999; box-shadow:0 0 20px rgba(0,0,0,0.9);
            font-family:Arial, sans-serif; display:none;
        `;

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = 15;

        const titleGroup = document.createElement('div');
        titleGroup.style.display = 'flex';
        titleGroup.style.alignItems = 'center';
        titleGroup.style.gap = '10px';

        const title = document.createElement('div');
        title.style.fontWeight = 'bold';
        title.style.fontSize = '16px';
        title.dataset.key = 'panelTitle';
        title.textContent = '字幕TTS配音';

        const langToggle = document.createElement('button');
        langToggle.id = 'lang-toggle';
        langToggle.style.cssText = `
            background: #333; border: 1px solid #555; color: #fff;
            padding: 4px 8px; border-radius: 4px; cursor: pointer;
            font-size: 12px; transition: background 0.2s;
        `;
        langToggle.textContent = 'EN';
        langToggle.addEventListener('click', () => {
            config.lang = config.lang === 'zh' ? 'en' : 'zh';
            saveConfig();
            updateLanguage();
        });

        titleGroup.append(title, langToggle);

        const closeBtn = document.createElement('button');
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = '#fff';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', hidePanel);

        header.append(titleGroup, closeBtn);
        panel.append(header);

        const controlsWrap = document.createElement('div');
        controlsWrap.innerHTML = `
            <div style="margin:10px 0;">
                <div data-key="videoVol" style="margin-bottom:5px;">🎬 视频音量</div>
                <input type="range" id="video-vol" min="0" max="1" step="0.01" value="${config.videoVol}" style="width:100%;">
            </div>
            <div style="margin:10px 0;">
                <div data-key="readVol" style="margin-bottom:5px;">🔊 朗读音量</div>
                <input type="range" id="read-vol" min="0" max="1" step="0.01" value="${config.volume}" style="width:100%;">
            </div>
            <div style="margin:10px 0;">
                <div data-key="readRate" style="margin-bottom:5px;">⚡ 朗读速度</div>
                <input type="range" id="read-rate" min="0.5" max="2" step="0.1" value="${config.rate}" style="width:100%;">
            </div>
            <div style="margin:10px 0;">
                <div data-key="voiceSelect" style="margin-bottom:5px;">🗣️ 朗读音色</div>
                <select id="voice-select" style="width:100%; padding:6px; background:#222; color:#fff; border:1px solid #444; border-radius:4px;"></select>
            </div>
        `;
        panel.append(controlsWrap);

        const autoWrap = document.createElement('div');
        autoWrap.style.margin = '15px 0';
        autoWrap.style.paddingTop = '10px';
        autoWrap.style.borderTop = '1px solid #333';
        autoWrap.innerHTML = `
            <div style="display:flex; align-items:center; margin-bottom:10px;">
                <input type="checkbox" id="auto-read-switch" ${config.autoRead ? 'checked' : ''}>
                <label data-key="autoReadLabel" style="margin-left:5px; cursor:pointer; font-weight:bold;">自动朗读功能</label>
            </div>
            <div style="margin:10px 0;">
                <div data-key="autoIntervalLabel" style="margin-bottom:5px;">⏱️ 自动检测间隔（毫秒）</div>
                <input type="number" id="auto-interval" min="500" max="5000" step="100" value="${config.autoInterval}"
                    style="width:100%; padding:8px; background:#222; color:#fff; border:1px solid #444; border-radius:4px;">
                <div data-key="autoIntervalHint" style="font-size:12px; color:#aaa; margin-top:3px;">建议值：500-2000（值越小检测越频繁）</div>
            </div>
            <div style="display:flex; align-items:center; margin:8px 0;">
                <input type="checkbox" id="auto-stop-on-play" ${config.autoStopOnPlay ? 'checked' : ''}>
                <label data-key="autoStopLabel" style="margin-left:5px; cursor:pointer;">视频播放时暂停自动朗读</label>
            </div>
            <button id="auto-read-btn" style="width:100%; padding:8px; margin-top:8px; background:${config.autoRead ? '#f44336' : '#4CAF50'}; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                ${config.autoRead ? '🛑 停止自动朗读' : '▶️ 启动自动朗读'}
            </button>
        `;
        panel.append(autoWrap);

        const customWrap = document.createElement('div');
        customWrap.style.margin = '15px 0';
        customWrap.style.paddingTop = '10px';
        customWrap.style.borderTop = '1px solid #333';
        customWrap.innerHTML = `
            <div style="display:flex; align-items:center; margin-bottom:8px;">
                <input type="checkbox" id="use-custom" ${config.useCustom ? 'checked' : ''}>
                <label data-key="useCustomLabel" style="margin-left:5px; cursor:pointer;">启用自定义类名</label>
            </div>
            <input type="text" id="custom-class" data-placeholder-key="customClassPlaceholder"
                value="${config.customClass}" style="width:100%; padding:8px; margin-bottom:8px; background:#222; color:#fff; border:1px solid #444; border-radius:4px;">
            <button id="force-parse-btn" data-key="forceParseBtn" style="width:100%; padding:8px; background:#4CAF50; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                🔍 测试解析
            </button>
            <button id="speak-btn" data-key="speakBtn" style="width:100%; padding:8px; margin-top:5px; background:#2196F3; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                🎤 解析并朗读
            </button>
            <div id="result" style="margin-top:10px; padding:10px; background:#222; border-radius:4px; min-height:60px; font-size:14px; line-height:1.4;"></div>
        `;
        panel.append(customWrap);

        document.body.append(panel);

        // 绑定控件事件
        document.getElementById('video-vol').addEventListener('input', (e) => {
            config.videoVol = parseFloat(e.target.value);
            const v = getVideoEl(); if (v) v.volume = config.videoVol;
            saveConfig();
        });
        document.getElementById('read-vol').addEventListener('input', (e) => {
            config.volume = parseFloat(e.target.value);
            saveConfig();
        });
        document.getElementById('read-rate').addEventListener('input', (e) => {
            config.rate = parseFloat(e.target.value);
            saveConfig();
        });
        document.getElementById('voice-select').addEventListener('change', (e) => {
            config.voiceName = e.target.value;
            saveConfig();
        });
        document.getElementById('use-custom').addEventListener('change', (e) => {
            config.useCustom = e.target.checked;
            saveConfig();
            updateResult();
            if (config.autoRead && !config.useCustom) {
                toggleAutoRead();
            }
        });
        document.getElementById('custom-class').addEventListener('input', (e) => {
            config.customClass = e.target.value.trim();
            saveConfig();
            updateResult();
        });

        document.getElementById('auto-read-switch').addEventListener('change', toggleAutoRead);
        document.getElementById('auto-read-btn').addEventListener('click', toggleAutoRead);
        document.getElementById('auto-interval').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value >= 500 && value <= 5000) {
                config.autoInterval = value;
                saveConfig();
                if (config.autoRead) {
                    startAutoRead();
                }
            }
        });
        document.getElementById('auto-stop-on-play').addEventListener('change', (e) => {
            config.autoStopOnPlay = e.target.checked;
            saveConfig();
        });

        document.getElementById('force-parse-btn').addEventListener('click', () => {
            if (!config.useCustom) {
                alert(getText('enableCustomAlert'));
                return;
            }
            prevParsedText = '';
            const { text, error } = forceParse();
            const resultEl = document.getElementById('result');
            if (error) {
                resultEl.innerHTML = `❌ ${error}`;
                resultEl.style.color = '#f44336';
            } else if (text) {
                resultEl.innerHTML = `✅ ${getText('parsedSuccess')}<br/>${text}`;
                resultEl.style.color = '#4CAF50';
            } else {
                resultEl.innerHTML = '❌ ' + getText('parseFailed');
                resultEl.style.color = '#f44336';
            }
        });

        document.getElementById('speak-btn').addEventListener('click', () => {
            if (!config.useCustom) {
                alert(getText('enableCustomAlert'));
                return;
            }
            const { changed, text } = isTextChanged();
            if (changed && text) {
                speakText(text);
                document.getElementById('result').innerHTML = `✅ ${getText('reading')}<br/>${text}`;
                document.getElementById('result').style.color = '#4CAF50';
            } else if (!changed) {
                document.getElementById('result').innerHTML = `ℹ️ ${getText('noChange')}`;
                document.getElementById('result').style.color = '#ff9800';
            } else {
                alert(getText('noTextAlert'));
            }
        });

        loadVoices();
        synth.onvoiceschanged = loadVoices;
        updateLanguage();
        if (config.autoRead) {
            setTimeout(startAutoRead, 1000);
        }
    }

    function getText(key) {
        const i18n = {
            zh: {
                panelTitle: '字幕TTS配音',
                videoVol: '🎬 视频音量',
                readVol: '🔊 朗读音量',
                readRate: '⚡ 朗读速度',
                voiceSelect: '🗣️ 朗读音色',
                autoReadLabel: '自动朗读功能',
                autoIntervalLabel: '⏱️ 自动检测间隔（毫秒）',
                autoIntervalHint: '建议值：500-2000（值越小检测越频繁）',
                autoStopLabel: '视频播放时暂停自动朗读',
                startAutoRead: '▶️ 启动自动朗读',
                stopAutoRead: '🛑 停止自动朗读',
                useCustomLabel: '启用自定义类名',
                customClassPlaceholder: '粘贴字幕类名（空格分隔）',
                forceParseBtn: '🔍 测试解析',
                speakBtn: '🎤 解析并朗读',
                enableCustomHint: '请勾选「启用自定义类名」并输入类名',
                pasteClassHint: '请粘贴字幕的完整类名（空格分隔）',
                parsedSuccess: '已解析到文本：',
                parseFailed: '暂未解析到文本',
                enableCustomAlert: '请先勾选「启用自定义类名」',
                reading: '正在朗读：',
                noChange: '文本未变化，无需重复朗读',
                noTextAlert: '未解析到任何文本！请检查类名',
                alertAutoRead: '请先启用自定义类名并输入有效的字幕类名！',
                autoReading: '🔄 自动朗读中：',
            },
            en: {
                panelTitle: 'Subtitle TTS',
                videoVol: '🎬 Video Volume',
                readVol: '🔊 Read Volume',
                readRate: '⚡ Read Rate',
                voiceSelect: '🗣️ Voice',
                autoReadLabel: 'Auto Read',
                autoIntervalLabel: '⏱️ Check Interval (ms)',
                autoIntervalHint: 'Recommended: 500-2000',
                autoStopLabel: 'Pause when video plays',
                startAutoRead: '▶️ Start Auto Read',
                stopAutoRead: '🛑 Stop Auto Read',
                useCustomLabel: 'Enable custom class name',
                customClassPlaceholder: 'Paste subtitle class names (space separated)',
                forceParseBtn: '🔍 Test Parse',
                speakBtn: '🎤 Parse & Read',
                enableCustomHint: 'Check "Enable custom class name" and input class name',
                pasteClassHint: 'Paste the complete class names (space separated)',
                parsedSuccess: 'Parsed text:',
                parseFailed: 'No text found',
                enableCustomAlert: 'Please check "Enable custom class name" first',
                reading: 'Reading:',
                noChange: 'Text unchanged, no need to repeat',
                noTextAlert: 'No text found! Please check class name',
                alertAutoRead: 'Please enable custom class name and input valid class name!',
                autoReading: '🔄 Auto reading:',
            }
        };
        return i18n[config.lang][key] || key;
    }

    function updateLanguage() {
        document.querySelectorAll('[data-key]').forEach(el => {
            const key = el.dataset.key;
            el.textContent = getText(key);
        });
        document.querySelectorAll('[data-placeholder-key]').forEach(el => {
            const key = el.dataset.placeholderKey;
            el.placeholder = getText(key);
        });
        const langToggle = document.getElementById('lang-toggle');
        if (langToggle) {
            langToggle.textContent = config.lang === 'zh' ? 'EN' : '中文';
        }
        updateResult();
        updateAutoReadUI();
    }

    function updateResult() {
        const resultEl = document.getElementById('result');
        if (!resultEl) return;
        if (!config.useCustom) {
            resultEl.innerHTML = '💡 ' + getText('enableCustomHint');
            resultEl.style.color = '#aaa';
            return;
        }
        if (!config.customClass) {
            resultEl.innerHTML = '⚠️ ' + getText('pasteClassHint');
            resultEl.style.color = '#ff9800';
            return;
        }
        const { text } = forceParse();
        if (text) {
            resultEl.innerHTML = `✅ ${getText('parsedSuccess')}<br/>${text}`;
            resultEl.style.color = '#4CAF50';
        } else {
            resultEl.innerHTML = '❌ ' + getText('parseFailed');
            resultEl.style.color = '#f44336';
        }
    }

    // ====================== 播放器按钮 ======================
    function addPlayerBtn() {
        function tryAdd() {
            const controls = document.querySelector('.ytp-right-controls');
            if (!controls || document.getElementById('sub-btn')) return;
            const btn = document.createElement('button');
            btn.id = 'sub-btn';
            btn.className = 'ytp-button';
            btn.textContent = '📢';
            btn.title = 'Subtitle TTS';
            btn.style.cssText = `
                width:40px; height:100%; background:transparent; border:none;
                color:#fff; font-size:18px; cursor:pointer;
                display:flex; align-items:center; justify-content:center;
            `;
            btn.addEventListener('click', (e) => { e.stopPropagation(); showPanel(); });
            controls.prepend(btn);
        }
        const interval = setInterval(tryAdd, 500);
        setTimeout(() => clearInterval(interval), 15000);
        tryAdd();
        document.addEventListener('yt-navigate-finish', () => setTimeout(tryAdd, 1500));
    }

    // ====================== 启动逻辑 ======================
    window.addEventListener('load', () => {
        setTimeout(() => {
            addPlayerBtn();
            const v = getVideoEl(); if (v) v.volume = config.videoVol;
            setInterval(() => { if (config.useCustom) updateResult(); }, 1000);
            if (config.autoRead) {
                startAutoRead();
            }
        }, 5000);
    });

    document.addEventListener('yt-navigate-finish', () => {
        setTimeout(() => {
            video = null;
            prevParsedText = '';
            const v = getVideoEl(); if (v) v.volume = config.videoVol;
            if (config.autoRead) {
                startAutoRead();
            }
        }, 1500);
    });

    window.addEventListener('beforeunload', () => {
        stopAutoRead();
        if (synth.speaking) {
            synth.cancel();
        }
    });
})();