// ==UserScript==
// @name         YouTube 字幕TTS配音
// @namespace    https://github.com/NameZH131
// @version      0.7.0-alpha
// @description  解析YouTube字幕元素（按class匹配）并进行TTS语音朗读
// @author       NameZH131 (github: NameZH131)
// @match        *://*.youtube.com/watch*
// @icon         https://www.youtube.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @homepage     https://github.com/NameZH131/youtube-tts
// @supportURL   https://github.com/NameZH131/youtube-tts/issues
// @license      MIT
// ==/UserScript==
(function() {
    'use strict';

    // ====================== 配置管理 ======================
    const STORAGE_KEY = 'youtubeSubReaderFinalFix';

    const defaultConfig = {
        customClass: '',
        useCustom: true,
        volume: 1,
        rate: 1,
        videoVol: 1,
        voiceName: '',
        autoRead: true,
        autoInterval: 100,
        autoStopOnPlay: false,
        lang: 'zh',
    };

    let config = { ...defaultConfig, ...GM_getValue(STORAGE_KEY, {}) };

    // 清理配置中的非法值（防止缓存污染）
    function sanitizeConfig(cfg) {
        const cleaned = { ...cfg };
        
        // 清理 customClass：不能包含脚本内容
        if (cleaned.customClass && cleaned.customClass.includes('UserScript')) {
            console.warn('[配置清理] 检测到非法 customClass 值，已重置');
            cleaned.customClass = '';
        }
        
        return cleaned;
    }

    config = sanitizeConfig(config);

    function saveConfig() {
        GM_setValue(STORAGE_KEY, config);
    }

    // ====================== 全局状态 ======================
    const SYNTH = window.speechSynthesis;
    let panel = null;
    let voices = [];
    let video = null;
    let autoReadTimer = null;
    let prevParsedText = '';

    // ====================== 核心工具函数 ======================
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

    function findSubtitleElements(selector) {
        let elements = [];
        try {
            elements = Array.from(document.querySelectorAll(selector));

            if (elements.length === 0) {
                const walk = (node) => {
                    if (node.shadowRoot) {
                        try {
                            const shadowEls = node.shadowRoot.querySelectorAll(selector);
                            elements.push(...Array.from(shadowEls));
                        } catch (e) {
                            console.warn('[字幕解析] shadow DOM 查找失败:', e);
                        }
                    }
                    Array.from(node.children || []).forEach(walk);
                };
                walk(document.body);
            }
        } catch (e) {
            console.error('[字幕解析] 选择器错误:', e);
        }
        return elements;
    }

    function parseSubtitles() {
        // 未启用自定义追踪
        if (!config.useCustom) {
            return { text: '', error: '未启用自定义追踪', elements: [] };
        }

        const selector = getValidSelector();

        // 未输入追踪表达式
        if (!selector || selector.trim() === '') {
            return { text: '', error: '未输入 class 表达式', elements: [] };
        }

        let elements;
        try {
            elements = findSubtitleElements(selector);
        } catch (e) {
            return { text: '', error: e.message, elements: [] };
        }

        // 匹配到0个元素
        if (elements.length === 0) {
            return { text: '', error: `未找到匹配的元素（选择器：${selector}）`, elements: [] };
        }

        const text = elements
            .map(el => (el.textContent || el.innerText || '').trim())
            .filter(t => t)
            .join(' ');

        // 匹配到元素但没有文本内容
        if (!text) {
            return { text: '', error: `匹配到 ${elements.length} 个元素，但无文本内容`, elements };
        }

        return { text, error: '', elements };
    }

    function isTextChanged() {
        const { text } = parseSubtitles();
        if (!text && !prevParsedText) return { changed: false, text: '' };
        if (text !== prevParsedText) {
            prevParsedText = text;
            return { changed: true, text };
        }
        return { changed: false, text };
    }

    // ====================== TTS 朗读逻辑 ======================
    function loadVoices() {
        voices = SYNTH.getVoices().filter(v => v.lang.includes('zh') || v.name.includes('Chinese'));
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

        if (SYNTH.speaking) SYNTH.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = config.volume;
        utterance.rate = config.rate;
        utterance.voice = voices.find(v => v.name === config.voiceName) || voices[0] || null;

        SYNTH.speak(utterance);
    }

    // ====================== 自动朗读 ======================
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

            if (config.autoStopOnPlay) {
                const video = getVideoEl();
                if (video && !video.paused) return;
            }

            const { changed, text } = isTextChanged();
            if (!changed) return;

            speakText(text);

            if (panel && panel.style.display !== 'none') {
                const resultEl = document.getElementById('result');
                if (resultEl) {
                    resultEl.textContent = `${getText('autoReading')} ${text}`;
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
        console.log('[自动朗读] 已停止');
    }

    function toggleAutoRead() {
        config.autoRead = !config.autoRead;
        saveConfig();
        updateAutoReadUI();

        if (config.autoRead) {
            startAutoRead();
        } else {
            stopAutoRead();
            if (SYNTH.speaking) SYNTH.cancel();
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

    // ====================== UI 面板 ======================
    function hidePanel() {
        if (panel) panel.style.display = 'none';
    }

    function showPanel() {
        if (!panel) createPanel();
        panel.style.display = 'block';
    }

    function createPanel() {
        if (panel) return;

        panel = document.createElement('div');
        panel.id = 'sub-fix-panel';
        panel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 90vw; max-width: 450px; max-height: 90vh;
            background: #111; color: #fff; padding: 20px; border-radius: 10px;
            z-index: 9999999; box-shadow: 0 0 20px rgba(0,0,0,0.9);
            font-family: Arial, sans-serif; display: none; overflow-y: auto;
        `;

        // 标题栏
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;';
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="font-weight: bold; font-size: 16px;" data-key="panelTitle">字幕TTS配音</div>
                <button id="lang-toggle" style="background: #333; border: 1px solid #555; color: #fff; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">EN</button>
            </div>
            <button id="close-btn" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">×</button>
        `;
        panel.append(header);

        // 音量/速率控制
        const controlsWrap = document.createElement('div');
        controlsWrap.innerHTML = `
            <div style="margin: 10px 0;">
                <div data-key="videoVol" style="margin-bottom: 5px;">🎬 视频音量</div>
                <input type="range" id="video-vol" min="0" max="1" step="0.01" value="${config.videoVol}" style="width: 100%;">
            </div>
            <div style="margin: 10px 0;">
                <div data-key="readVol" style="margin-bottom: 5px;">🔊 朗读音量</div>
                <input type="range" id="read-vol" min="0" max="1" step="0.01" value="${config.volume}" style="width: 100%;">
            </div>
            <div style="margin: 10px 0;">
                <div data-key="readRate" style="margin-bottom: 5px;">⚡ 朗读速度</div>
                <input type="range" id="read-rate" min="0.5" max="2" step="0.1" value="${config.rate}" style="width: 100%;">
            </div>
            <div style="margin: 10px 0;">
                <div data-key="voiceSelect" style="margin-bottom: 5px;">🗣️ 朗读音色</div>
                <select id="voice-select" style="width: 100%; padding: 6px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px;"></select>
            </div>
        `;
        panel.append(controlsWrap);

        // 自动朗读控制
        const autoWrap = document.createElement('div');
        autoWrap.style.cssText = 'margin: 15px 0; padding-top: 10px; border-top: 1px solid #333;';
        autoWrap.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <input type="checkbox" id="auto-read-switch" ${config.autoRead ? 'checked' : ''}>
                <label data-key="autoReadLabel" style="margin-left: 5px; cursor: pointer; font-weight: bold;">自动朗读功能</label>
            </div>
            <div style="margin: 10px 0;">
                <div data-key="autoIntervalLabel" style="margin-bottom: 5px;">⏱️ 自动检测间隔（毫秒）</div>
                <input type="number" id="auto-interval" min="100" max="2000" step="50" value="${config.autoInterval}"
                    style="width: 100%; padding: 8px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px;">
                <div data-key="autoIntervalHint" style="font-size: 12px; color: #aaa; margin-top: 3px;">建议值：100-2000（值越小检测越频繁）</div>
            </div>
            <div style="display: flex; align-items: center; margin: 8px 0;">
                <input type="checkbox" id="auto-stop-on-play" ${config.autoStopOnPlay ? 'checked' : ''}>
                <label data-key="autoStopLabel" style="margin-left: 5px; cursor: pointer;">视频播放时暂停自动朗读</label>
            </div>
            <button id="auto-read-btn" style="width: 100%; padding: 8px; margin-top: 8px; background: ${config.autoRead ? '#f44336' : '#4CAF50'}; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                ${config.autoRead ? '🛑 停止自动朗读' : '▶️ 启动自动朗读'}
            </button>
        `;
        panel.append(autoWrap);

        // 自定义追踪控制
        const customWrap = document.createElement('div');
        customWrap.style.cssText = 'margin: 15px 0; padding-top: 10px; border-top: 1px solid #333;';
        customWrap.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <input type="checkbox" id="use-custom" ${config.useCustom ? 'checked' : ''}>
                <label data-key="useCustomLabel" style="margin-left: 5px; cursor: pointer;">启用自定义追踪</label>
            </div>
            <div style="margin-left: 24px; margin-bottom: 8px;">
                <input type="text" id="custom-class" data-placeholder-key="customClassPlaceholder"
                    value="${config.customClass}" style="width: 100%; padding: 8px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px;">
            </div>
            <button id="force-parse-btn" data-key="forceParseBtn" style="width: 100%; padding: 8px; background: #4CAF50; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                🔍 测试解析
            </button>
            <button id="speak-btn" data-key="speakBtn" style="width: 100%; padding: 8px; margin-top: 5px; background: #2196F3; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                🎤 解析并朗读
            </button>
            <div id="result" style="margin-top: 10px; padding: 10px; background: #222; border-radius: 4px; min-height: 60px; font-size: 14px; line-height: 1.4;"></div>
        `;
        panel.append(customWrap);

        document.body.appendChild(panel);

        // 绑定事件
        bindEvents();
    }

    function bindEvents() {
        // 标题栏事件
        document.getElementById('lang-toggle').addEventListener('click', () => {
            config.lang = config.lang === 'zh' ? 'en' : 'zh';
            saveConfig();
            updateLanguage();
        });
        document.getElementById('close-btn').addEventListener('click', hidePanel);

        // 音量/速率事件
        document.getElementById('video-vol').addEventListener('input', (e) => {
            config.videoVol = parseFloat(e.target.value);
            const video = getVideoEl();
            if (video) video.volume = config.videoVol;
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

        // 自动朗读事件
        document.getElementById('auto-read-switch').addEventListener('change', toggleAutoRead);
        document.getElementById('auto-read-btn').addEventListener('click', toggleAutoRead);
        document.getElementById('auto-interval').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value >= 100 && value <= 2000) {
                config.autoInterval = value;
                saveConfig();
            }
        });
        document.getElementById('auto-stop-on-play').addEventListener('change', (e) => {
            config.autoStopOnPlay = e.target.checked;
            saveConfig();
        });

        // 自定义追踪事件
        document.getElementById('use-custom').addEventListener('change', (e) => {
            config.useCustom = e.target.checked;
            saveConfig();

            // 更新解析状态
            const resultEl = document.getElementById('result');
            if (resultEl) {
                if (!config.useCustom) {
                    resultEl.textContent = '💡 请勾选「启用自定义追踪」';
                    resultEl.style.color = '#aaa';
                } else {
                    const { text, error } = parseSubtitles();
                    if (error) {
                        resultEl.textContent = `⚠️ ${error}`;
                        resultEl.style.color = '#ff9800';
                    } else if (text) {
                        resultEl.textContent = `✅ 已解析：${text}`;
                        resultEl.style.color = '#4CAF50';
                    } else {
                        resultEl.textContent = '💡 请输入字幕元素的 class 名';
                        resultEl.style.color = '#aaa';
                    }
                }
            }
        });

        // Class 输入事件
        document.getElementById('custom-class').addEventListener('input', (e) => {
            let value = e.target.value;
            
            // 验证输入：防止粘贴非法内容
            if (value.includes('UserScript') || value.includes('function') || value.includes('GM_')) {
                console.warn('[输入验证] 检测到非法内容，已自动清理');
                value = '';
                e.target.value = '';
            }
            
            config.customClass = value;
            saveConfig();

            // 实时更新解析状态
            if (config.useCustom) {
                const { text, error } = parseSubtitles();
                const resultEl = document.getElementById('result');
                if (resultEl) {
                    if (error) {
                        resultEl.textContent = `⚠️ ${error}`;
                        resultEl.style.color = '#ff9800';
                    } else if (text) {
                        resultEl.textContent = `✅ 已解析：${text}`;
                        resultEl.style.color = '#4CAF50';
                    } else {
                        resultEl.textContent = '💡 等待输入 class 表达式...';
                        resultEl.style.color = '#aaa';
                    }
                }
            }
        });

        document.getElementById('force-parse-btn').addEventListener('click', () => {
            if (!config.useCustom) {
                alert(getText('alertAutoRead'));
                return;
            }
            const { text, error } = parseSubtitles();
            const resultEl = document.getElementById('result');
            if (resultEl) {
                if (error) {
                    resultEl.textContent = `❌ 解析失败：${error}`;
                    resultEl.style.color = '#f44336';
                } else {
                    resultEl.textContent = `✅ 解析成功：${text}`;
                    resultEl.style.color = '#4CAF50';
                }
            }
        });

        document.getElementById('speak-btn').addEventListener('click', () => {
            if (!config.useCustom) {
                alert(getText('alertAutoRead'));
                return;
            }
            const { text, error } = parseSubtitles();
            const resultEl = document.getElementById('result');
            if (resultEl) {
                if (error) {
                    resultEl.textContent = `❌ 解析失败：${error}`;
                    resultEl.style.color = '#f44336';
                    return;
                }
                if (text) {
                    speakText(text);
                    resultEl.textContent = `🎤 正在朗读：${text}`;
                    resultEl.style.color = '#2196F3';
                }
            }
        });

        loadVoices();
        updateLanguage();

        // 初始化解析状态显示
        const resultEl = document.getElementById('result');
        if (resultEl) {
            if (!config.useCustom) {
                resultEl.textContent = '💡 请勾选「启用自定义追踪」';
                resultEl.style.color = '#aaa';
            } else {
                const { text, error } = parseSubtitles();
                if (error) {
                    resultEl.textContent = `⚠️ ${error}`;
                    resultEl.style.color = '#ff9800';
                } else if (text) {
                    resultEl.textContent = `✅ 已解析：${text}`;
                    resultEl.style.color = '#4CAF50';
                } else {
                    const modeText = config.trackMode === 'xpath' ? 'XPath' : 'class';
                    resultEl.textContent = `💡 请输入字幕元素的 ${modeText} 表达式`;
                    resultEl.style.color = '#aaa';
                }
            }
        }

        // 初始化输入框值
        const classInput = document.getElementById('custom-class');
        if (classInput) {
            // 设置输入框值（确保不被污染）
            if (config.customClass && !config.customClass.includes('UserScript')) {
                classInput.value = config.customClass;
            } else {
                classInput.value = '';
            }
        }
    }

    // ====================== 多语言支持 ======================
    const translations = {
        zh: {
            panelTitle: '字幕TTS配音',
            videoVol: '🎬 视频音量',
            readVol: '🔊 朗读音量',
            readRate: '⚡ 朗读速度',
            voiceSelect: '🗣️ 朗读音色',
            autoReadLabel: '自动朗读功能',
            autoIntervalLabel: '⏱️ 自动检测间隔（毫秒）',
            autoIntervalHint: '建议值：100-2000（值越小检测越频繁）',
            autoStopLabel: '视频播放时暂停自动朗读',
            stopAutoRead: '🛑 停止自动朗读',
            startAutoRead: '▶️ 启动自动朗读',
            useCustomLabel: '启用自定义追踪',
            customClassPlaceholder: '输入字幕元素的class名（多个用空格分隔）',
            forceParseBtn: '🔍 测试解析',
            speakBtn: '🎤 解析并朗读',
            autoReading: '📖 自动朗读中：',
            speaking: '🎤 正在朗读：',
            alertAutoRead: '请先启用自定义追踪并输入表达式',
        },
        en: {
            panelTitle: 'Subtitle TTS',
            videoVol: '🎬 Video Volume',
            readVol: '🔊 Reading Volume',
            readRate: '⚡ Reading Speed',
            voiceSelect: '🗣️ Voice',
            autoReadLabel: 'Auto Read',
            autoIntervalLabel: '⏱️ Auto Interval (ms)',
            autoIntervalHint: 'Recommended: 100-2000 (lower = more frequent)',
            autoStopLabel: 'Pause on video play',
            stopAutoRead: '🛑 Stop Auto Read',
            startAutoRead: '▶️ Start Auto Read',
            useCustomLabel: 'Enable Custom Tracking',
            customClassPlaceholder: 'Enter subtitle class names (separated by spaces)',
            forceParseBtn: '🔍 Test Parse',
            speakBtn: '🎤 Parse & Speak',
            autoReading: '📖 Auto Reading:',
            speaking: '🎤 Speaking:',
            alertAutoRead: 'Please enable custom tracking and enter expression',
        }
    };

    function getText(key) {
        return translations[config.lang][key] || key;
    }

    function updateLanguage() {
        const langToggle = document.getElementById('lang-toggle');
        if (langToggle) {
            langToggle.textContent = config.lang === 'zh' ? 'EN' : '中文';
        }

        document.querySelectorAll('[data-key]').forEach(el => {
            const key = el.dataset.key;
            const text = getText(key);
            el.textContent = text;
        });

        document.querySelectorAll('[data-placeholder-key]').forEach(el => {
            const key = el.dataset.placeholderKey;
            el.placeholder = getText(key);
        });
    }

    // ====================== 小喇叭按钮 ======================
    function createToggleBtn() {
        const existingBtn = document.getElementById('tts-toggle-btn');
        if (existingBtn) return existingBtn;

        const btn = document.createElement('button');
        btn.id = 'tts-toggle-btn';
        btn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="#9c27b0"/>
                <path d="M15.54 8.46C16.4774 9.39764 17.004 10.6692 17.004 12C17.004 13.3308 16.4774 14.6024 15.54 15.54" stroke="#9c27b0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M19.07 4.93C20.5447 6.40515 21.3779 8.40916 21.3779 10.5C21.3779 12.5908 20.5447 14.5949 19.07 16.07" stroke="#9c27b0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        btn.style.cssText = `
            background: transparent; border: none; cursor: pointer;
            padding: 8px; display: flex;
            align-items: center; justify-content: center;
            opacity: 0.9; transition: opacity 0.2s, transform 0.2s;
        `;
        btn.title = '字幕TTS配音';

        btn.addEventListener('mouseenter', () => {
            btn.style.opacity = '1';
            btn.style.transform = 'scale(1.1)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.opacity = '0.9';
            btn.style.transform = 'scale(1)';
        });
        btn.addEventListener('click', () => {
            if (panel && panel.style.display !== 'none') {
                hidePanel();
            } else {
                showPanel();
            }
        });

        return btn;
    }

    function injectToggleBtn() {
        const rightControls = document.querySelector('.ytp-right-controls');
        if (rightControls && !document.getElementById('tts-toggle-btn')) {
            const btn = createToggleBtn();
            rightControls.appendChild(btn);
            console.log('[小喇叭按钮] 已插入到播放器右侧控制栏');
        }
    }

    // ====================== 键盘快捷键 ======================
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel && panel.style.display !== 'none') {
            hidePanel();
        }
    });

    // ====================== 页面卸载清理 ======================
    window.addEventListener('beforeunload', () => {
        stopAutoRead();
        if (SYNTH.speaking) SYNTH.cancel();
    });

    // ====================== 初始化 ======================
    console.log('[YouTube 字幕TTS配音] 脚本已加载 (v0.7.0-alpha)');
    console.log('[提示] 按 ESC 键关闭面板');

    setTimeout(() => {
        createPanel();
        injectToggleBtn();
        if (config.autoRead) startAutoRead();
    }, 1000);

    // 持续监听确保按钮存在
    setInterval(injectToggleBtn, 3000);

})();