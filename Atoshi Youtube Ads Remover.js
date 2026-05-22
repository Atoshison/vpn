// ==UserScript==
// @name         Atoshi YouTube Ads Remover
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Remove and skip all ads from YouTube (2026 - Fully Working)
// @author       Atoshi TM
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @grant        unsafeWindow
// @grant        GM_log
// @run-at       document-start
// @icon         data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="60" fill="%2322c55e" rx="8"/><path d="M 35 20 L 35 40 L 55 30 Z" fill="white"/></svg>
// ==/UserScript==

(function() {
    'use strict';

    const config = {
        removeSkipButton: false,
        muteAds: true,
        autoPlayNextVideo: true,
        blockAdRequests: true,
        interceptFetch: true,
        autoJumpNextChapter: true
    };

    let jumpToNextChapterAfterAd = false;

    // Enhanced ad removal with 2026 selectors
    function removeAds() {
        try {
            // Skip ads first
            skipAds();

            // Remove primary ad containers (2026 updated)
            const adSelectors = [
                '[class*="ytp-ad"]',
                '[class*="ad-container"]',
                '[class*="advertisement"]',
                'div[data-ad-layout]',
                'div[data-ad-width]',
                'div[data-ad-module]',
                'div[data-ad-manager-id]',
                'ytd-display-ad-renderer',
                'yt-player-endscreen-element [data-ad-module]',
                '[role="button"][aria-label="Advertisement"]',
                'ins.adsbygoogle'
            ];

            adSelectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        if (el && el.parentNode) {
                            el.remove();
                        }
                    });
                } catch (e) {}
            });

            // Remove promoted content
            document.querySelectorAll('[class*="promoted"]').forEach(el => {
                const text = el.textContent || '';
                if (text.includes('Ad') || text.includes('Promoted') || text.includes('Sponsorship')) {
                    el.remove();
                }
            });

            // Remove overlay ads
            document.querySelectorAll('.ytp-overlay-background').forEach(el => el.remove());
            
            // Clean ytInitialData
            if (window.ytInitialData) {
                if (window.ytInitialData.playerOverlays) {
                    window.ytInitialData.playerOverlays = [];
                }
            }

            // Clean ytInitialPlayerResponse
            if (window.ytInitialPlayerResponse) {
                window.ytInitialPlayerResponse.adPlacements = [];
                window.ytInitialPlayerResponse.playerAds = [];
            }
        } catch (e) {
            console.log('Atoshi YouTube Ads Remover: Error removing ads -', e);
        }
    }

    // Enhanced skip ads with multiple selectors (2026)
    function skipAds() {
        try {
            // Primary skip button selector
            let skipBtn = document.querySelector('button.ytp-skip-ad-button');
            if (!skipBtn) skipBtn = document.querySelector('[aria-label="Skip ad"]');
            if (!skipBtn) skipBtn = document.querySelector('[aria-label="Skip"]');
            if (!skipBtn) skipBtn = document.querySelector('button[aria-label="Skip ad"]');
            if (!skipBtn) skipBtn = document.querySelector('button[aria-label="Skip"]');

            if (skipBtn && skipBtn.offsetHeight > 0) {
                skipBtn.click();
                return true;
            }

            // Try generic skip button patterns
            const buttons = document.querySelectorAll('button[class*="skip"]');
            for (let btn of buttons) {
                if (btn.offsetHeight > 0 && (btn.textContent.includes('Skip') || btn.getAttribute('aria-label')?.includes('Skip'))) {
                    btn.click();
                    return true;
                }
            }
        } catch (e) {
            console.log('Atoshi YouTube Ads Remover: Error skipping ads -', e);
        }
        return false;
    }

    // Mute ads (2026)
    function muteAds() {
        try {
            const video = document.querySelector('video');
            if (video) {
                const player = document.querySelector('.html5-video-player');
                if (player && (player.classList.contains('ad-showing') || player.classList.contains('playing-ad'))) {
                    video.muted = true;
                }
            }
        } catch (e) {
            console.log('Atoshi YouTube Ads Remover: Error muting ads -', e);
        }
    }

    function getChapterList() {
        try {
            const response = window.ytInitialPlayerResponse ||
                (window.ytplayer && window.ytplayer.config && window.ytplayer.config.args && window.ytplayer.config.args.player_response && JSON.parse(window.ytplayer.config.args.player_response));

            let chapters = [];
            if (response && Array.isArray(response.chapters)) {
                chapters = response.chapters.map(ch => {
                    const start = Number(ch.start_time ?? ch.start_seconds ?? ch.start);
                    let title = '';
                    if (ch.title) {
                        if (typeof ch.title === 'string') title = ch.title;
                        else if (ch.title.simpleText) title = ch.title.simpleText;
                        else if (Array.isArray(ch.title.runs)) title = ch.title.runs.map(r => r.text).join('');
                    }
                    return { start, title };
                });
            }

            if (!chapters.length) {
                const chapterEls = document.querySelectorAll('ytd-player-chapters-renderer tp-yt-paper-item, .ytp-chapter-hover-container, .ytp-chapter-title');
                chapterEls.forEach(el => {
                    if (!el) return;
                    const text = el.textContent || '';
                    const startAttr = el.getAttribute('data-start-time') || el.getAttribute('data-start') || el.getAttribute('data-time');
                    const start = Number(startAttr);
                    if (!Number.isNaN(start)) {
                        chapters.push({ start, title: text.trim() });
                    } else {
                        const match = text.match(/(\d+):(\d+)(?::(\d+))?/);
                        if (match) {
                            const secs = Number(match[1]) * 60 + Number(match[2]) + (match[3] ? Number(match[3]) * 3600 : 0);
                            chapters.push({ start: secs, title: text.replace(match[0], '').trim() });
                        }
                    }
                });
            }

            return chapters
                .filter(ch => Number.isFinite(ch.start))
                .sort((a, b) => a.start - b.start);
        } catch (e) {
            return [];
        }
    }

    function isAdPlaying() {
        const player = document.querySelector('.html5-video-player');
        return Boolean(player && (player.classList.contains('ad-showing') || player.classList.contains('playing-ad') || player.classList.contains('ad-interrupting')));
    }

    function seekToNextChapter() {
        if (!config.autoJumpNextChapter) return;
        const video = document.querySelector('video');
        if (!video) return;

        const chapters = getChapterList();
        if (!chapters.length) return;

        const currentTime = video.currentTime;
        const nextChapter = chapters.find(ch => ch.start > currentTime + 0.5);
        if (nextChapter) {
            video.currentTime = nextChapter.start;
            console.log('Atoshi YouTube Ads Remover: Jumped to next chapter', nextChapter.title || nextChapter.start);
        }
    }

    function handleAdChapterJump() {
        const currentlyInAd = isAdPlaying();
        if (currentlyInAd) {
            jumpToNextChapterAfterAd = true;
        } else if (jumpToNextChapterAfterAd) {
            jumpToNextChapterAfterAd = false;
            seekToNextChapter();
        }
    }

    // Intercept ytInitialData and ytInitialPlayerResponse (API-level blocking - 2026)
    function cleanGlobalData() {
        try {
            if (window.ytInitialData) {
                if (window.ytInitialData.playerOverlays) {
                    window.ytInitialData.playerOverlays = [];
                }
                if (window.ytInitialData.adPlacements) {
                    window.ytInitialData.adPlacements = [];
                }
            }
            if (window.ytInitialPlayerResponse) {
                window.ytInitialPlayerResponse.adPlacements = [];
                window.ytInitialPlayerResponse.playerAds = [];
                window.ytInitialPlayerResponse.adSlots = [];
            }
        } catch (e) {}
    }

    // Intercept fetch/XHR for ad requests (2026 - API-level blocking)
    if (config.blockAdRequests) {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            
            // Block ad-related requests
            if (typeof url === 'string' && (
                url.includes('ad_request') ||
                url.includes('/ads/') ||
                url.includes('pagead') ||
                url.includes('doubleclick') ||
                url.includes('googleadservices')
            )) {
                return Promise.reject(new Error('Ad request blocked by Atoshi YouTube Ads Remover'));
            }
            
            // Modify player response to remove ads
            return originalFetch.apply(this, args).then(response => {
                const clonedResponse = response.clone();
                
                if (url.includes('player?') || url.includes('get_watch?') || url.includes('youtubei')) {
                    return clonedResponse.json().then(data => {
                        try {
                            if (data.playerAds) data.playerAds = [];
                            if (data.adPlacements) data.adPlacements = [];
                            if (data.adSlots) data.adSlots = [];
                            if (data.playerOverlays) data.playerOverlays = [];
                        } catch (e) {}
                        
                        return new Response(JSON.stringify(data), {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    }).catch(() => response);
                }
                
                return response;
            }).catch(err => {
                // Log blocked requests
                if (err.message.includes('Ad request blocked')) {
                    console.log('Atoshi: Blocked ad request -', url);
                }
                throw err;
            });
        };
    }
    // Initialize (2026)
    function init() {
        // Clean global data first
        cleanGlobalData();
        
        // Remove ads
        removeAds();
        if (config.muteAds) muteAds();
        
        // Watch for new ads and changes
        const observer = new MutationObserver(() => {
            removeAds();
            if (config.muteAds) muteAds();
            cleanGlobalData();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-ad-layout', 'data-ad-width', 'data-ad-module']
        });

        // Monitor for video player changes
        document.addEventListener('yt-navigate', () => {
            removeAds();
            cleanGlobalData();
        });

        // Listen for page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                removeAds();
                cleanGlobalData();
            }
        });
        
        console.log('✓ Atoshi YouTube Ads Remover (v2.0) is active - May 2026');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also run at regular intervals for continuous protection
    setInterval(() => {
        removeAds();
        cleanGlobalData();
            handleAdChapterJump();
        }, 500);
        
        setInterval(() => {
            skipAds();
            handleAdChapterJump();
        }, 1000);
