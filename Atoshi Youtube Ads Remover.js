// ==UserScript==
// @name         Atoshi YouTube Ads Remover
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Remove and skip all ads from YouTube (2026 - Fully Working)
// @author       Atoshi
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @grant        unsafeWindow
// @grant        GM_log
// @run-at       document-start
// @icon         https://www.youtube.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    const config = {
        removeSkipButton: false,
        muteAds: true,
        autoPlayNextVideo: true,
        blockAdRequests: true,
        interceptFetch: true
    };

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
    }, 500);
    
    setInterval(skipAds, 1000);

})();
