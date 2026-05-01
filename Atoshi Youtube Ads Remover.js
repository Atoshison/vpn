// ==UserScript==
// @name         Atoshi YouTube Ads Remover
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Remove ads from YouTube
// @author       Atoshi
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
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
        autoPlayNextVideo: true
    };

    // Remove pre-roll and mid-roll ads
    function removeAds() {
        try {
            // Remove ad containers
            document.querySelectorAll('[class*="ad-container"]').forEach(el => el.remove());
            document.querySelectorAll('[class*="ytp-ad"]').forEach(el => el.remove());
            document.querySelectorAll('[class*="advertisement"]').forEach(el => el.remove());
            
            // Remove video ads
            const adElements = document.querySelectorAll('div[data-ad-layout], [role="button"][aria-label="Advertisement"]');
            adElements.forEach(el => {
                if (el.parentNode) {
                    el.parentNode.remove();
                }
            });

            // Skip ads if skip button exists
            skipAds();

            // Remove sidebar ads
            document.querySelectorAll('ytd-display-ad-renderer').forEach(el => el.remove());
            document.querySelectorAll('[class*="promoted"]').forEach(el => {
                if (el.textContent.includes('Ad') || el.textContent.includes('Promoted')) {
                    el.remove();
                }
            });
        } catch (e) {
            console.log('Atoshi YouTube Ads Remover: Error removing ads -', e);
        }
    }

    // Skip ads automatically
    function skipAds() {
        try {
            const skipButton = document.querySelector('button.ytp-skip-ad-button');
            if (skipButton) {
                skipButton.click();
            }

            // Try alternative selectors
            const skipButtons = document.querySelectorAll('[aria-label="Skip"]');
            skipButtons.forEach(btn => {
                if (btn.getAttribute('aria-label') === 'Skip') {
                    btn.click();
                }
            });
        } catch (e) {
            console.log('Atoshi YouTube Ads Remover: Error skipping ads -', e);
        }
    }

    // Mute ads
    function muteAds() {
        try {
            const video = document.querySelector('video');
            if (video) {
                const player = document.querySelector('.html5-video-player');
                if (player && player.classList.contains('ad-showing')) {
                    video.muted = true;
                }
            }
        } catch (e) {
            console.log('Atoshi YouTube Ads Remover: Error muting ads -', e);
        }
    }

    // Intercept fetch/XHR for ad requests
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        
        // Block ad-related requests
        if (typeof url === 'string' && (
            url.includes('ad_request') ||
            url.includes('/ads/') ||
            url.includes('pagead') ||
            url.includes('doubleclick')
        )) {
            return Promise.reject(new Error('Ad request blocked by Atoshi YouTube Ads Remover'));
        }
        
        return originalFetch.apply(this, args);
    };

    // Initialize
    function init() {
        removeAds();
        if (config.muteAds) muteAds();
        
        // Watch for new ads
        const observer = new MutationObserver(() => {
            removeAds();
            if (config.muteAds) muteAds();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-ad-layout']
        });

        // Monitor for video player changes
        document.addEventListener('yt-navigate', removeAds);
        
        console.log('✓ Atoshi YouTube Ads Remover is active');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also run at regular intervals
    setInterval(removeAds, 500);
    setInterval(skipAds, 1000);

})();
