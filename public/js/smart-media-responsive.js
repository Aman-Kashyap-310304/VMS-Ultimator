/**
 * ============================================================
 * VMS Ultra Pro — Smart Media Responsive Engine
 * Version: 2.0.0
 * Author: Aman Kashyap | VMS Ultra Pro
 * ============================================================
 *
 * ALGORITHM OVERVIEW:
 * ------------------
 * 1. Device Profiling     — reads window.innerWidth, devicePixelRatio, orientation
 * 2. Breakpoint Resolver  — maps width to a named tier (xs/sm/md/lg/xl)
 * 3. Scale Factor Engine  — derives a continuous 0-1 scalar for interpolation
 * 4. Layout Mutator       — applies margin/padding/font formulas to DOM nodes
 * 5. Image Optimizer      — redraws <img> via Canvas to pixel-perfect DPR dimensions
 * 6. Typography Fluid     — clamp-based font scaling across all text nodes
 * 7. Sidebar Collapser    — hides/shows sidebar with overlay on xs/sm viewports
 * 8. Card Grid Reflow     — switches grid-template-columns formula per breakpoint
 * 9. Table Scroller       — wraps overflow tables and adds horizontal scroll hint
 * 10. Form Field Stacker  — stacks side-by-side form rows on narrow screens
 * 11. Mutation Observer   — watches for DOM changes (async data loads) and re-runs
 * 12. Resize Throttle     — debounced resize handler (16ms RAF-aligned)
 * ============================================================
 */

(function VMSResponsiveEngine() {
    'use strict';

    // ─────────────────────────────────────────────
    // § 1 · CONSTANTS & BREAKPOINT TABLE
    // ─────────────────────────────────────────────
    const BP = {
        xs: { min: 0,    max: 479  },   // phones portrait
        sm: { min: 480,  max: 767  },   // phones landscape / small tablets
        md: { min: 768,  max: 1023 },   // tablets
        lg: { min: 1024, max: 1279 },   // small laptops
        xl: { min: 1280, max: Infinity }// desktops
    };

    /** Base design width (design was made at 1440px) */
    const DESIGN_WIDTH  = 1440;
    const DESIGN_HEIGHT = 900;

    /** Minimum / maximum fluid font sizes (px) */
    const FONT_MIN = 12;
    const FONT_MAX = 18;

    /** DPR cap — never render above 3× (saves memory) */
    const DPR_CAP = Math.min(window.devicePixelRatio || 1, 3);

    // ─────────────────────────────────────────────
    // § 2 · DEVICE STATE
    // ─────────────────────────────────────────────
    let STATE = {};

    function captureState() {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const tier = getTier(W);
        /** Continuous scale: 0 at xs.min, 1 at DESIGN_WIDTH */
        const scale = clamp(W / DESIGN_WIDTH, 0.25, 1);
        STATE = { W, H, tier, scale, dpr: DPR_CAP, portrait: H > W };
    }

    function getTier(w) {
        for (const [name, range] of Object.entries(BP))
            if (w >= range.min && w <= range.max) return name;
        return 'xl';
    }

    function clamp(val, lo, hi) { return Math.min(Math.max(val, lo), hi); }

    /** Linear interpolation */
    function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }

    /**
     * Fluid value formula — adapts any numeric CSS property:
     *   result = min + (max - min) × ((W − minW) / (maxW − minW))
     */
    function fluid(minVal, maxVal, minW = BP.xs.min, maxW = DESIGN_WIDTH) {
        return lerp(minVal, maxVal, (STATE.W - minW) / (maxW - minW));
    }

    // ─────────────────────────────────────────────
    // § 3 · TYPOGRAPHY FLUID ENGINE
    // ─────────────────────────────────────────────
    const FONT_SCALE_MAP = {
        h1:    { min: 22, max: 48 },
        h2:    { min: 18, max: 36 },
        h3:    { min: 16, max: 28 },
        h4:    { min: 15, max: 22 },
        h5:    { min: 14, max: 18 },
        h6:    { min: 13, max: 16 },
        p:     { min: FONT_MIN, max: FONT_MAX },
        span:  { min: FONT_MIN, max: FONT_MAX },
        label: { min: 12, max: 15 },
        small: { min: 10, max: 13 },
        td:    { min: 11, max: 14 },
        th:    { min: 11, max: 14 },
        button:{ min: 12, max: 15 },
        a:     { min: FONT_MIN, max: FONT_MAX }
    };

    function applyTypography() {
        for (const [tag, range] of Object.entries(FONT_SCALE_MAP)) {
            const size = Math.round(fluid(range.min, range.max));
            document.querySelectorAll(tag).forEach(el => {
                el.style.fontSize = `${size}px`;
            });
        }
    }

    // ─────────────────────────────────────────────
    // § 4 · LAYOUT MUTATOR (Margin + Padding)
    // ─────────────────────────────────────────────
    /**
     * Formula:
     *   padding = basePad × scale²   (quadratic squeeze at small screens)
     *   margin  = baseMargin × scale
     */
    const LAYOUT_SELECTORS = {
        '.card':         { basePad: 28, baseMargin: 24 },
        '.main-content': { basePad: 40, baseMargin: 0  },
        '.section':      { basePad: 32, baseMargin: 0  },
        '.form-group':   { basePad: 0,  baseMargin: 20 },
        '.container':    { basePad: 40, baseMargin: 0  },
        '.modal-card':   { basePad: 28, baseMargin: 0  },
        '.header':       { basePad: 16, baseMargin: 0  },
    };

    function applyLayout() {
        const s = STATE.scale;
        for (const [sel, cfg] of Object.entries(LAYOUT_SELECTORS)) {
            document.querySelectorAll(sel).forEach(el => {
                if (cfg.basePad)    el.style.padding       = `${Math.round(cfg.basePad * s * s)}px`;
                if (cfg.baseMargin) el.style.marginBottom  = `${Math.round(cfg.baseMargin * s)}px`;
            });
        }
    }

    // ─────────────────────────────────────────────
    // § 5 · IMAGE OPTIMIZER (Canvas-based DPR redraw)
    // ─────────────────────────────────────────────
    /**
     * Algorithm:
     *   1. Capture natural image dimensions (naturalWidth × naturalHeight)
     *   2. Compute target layout width from parent container or CSS
     *   3. targetCanvasW = layoutW × DPR_CAP
     *   4. targetCanvasH = targetCanvasW × (naturalH / naturalW)  ← preserve aspect ratio
     *   5. drawImage() at full quality (imageSmoothingQuality = 'high')
     *   6. Replace src with canvas.toDataURL('image/webp', 0.92) or PNG fallback
     *   7. Set CSS width/height so layout doesn't shift
     */
    const processedImages = new WeakSet();

    function optimizeImages() {
        document.querySelectorAll('img').forEach(img => {
            if (processedImages.has(img)) return;
            if (!img.complete || !img.naturalWidth) {
                img.addEventListener('load', () => optimizeSingleImage(img), { once: true });
                return;
            }
            optimizeSingleImage(img);
        });
    }

    function optimizeSingleImage(img) {
        try {
            const naturalW = img.naturalWidth;
            const naturalH = img.naturalHeight;
            if (!naturalW || !naturalH) return;

            // Skip tiny icons and SVGs served as data URIs
            if (naturalW < 48 && naturalH < 48) return;
            if (img.src.startsWith('data:image/svg')) return;

            // Determine target display width from rendered layout
            const layoutW = img.getBoundingClientRect().width || img.offsetWidth || naturalW;
            if (layoutW <= 0) return;

            const targetW = Math.round(layoutW * DPR_CAP);
            const targetH = Math.round(targetW * (naturalH / naturalW));

            const canvas = document.createElement('canvas');
            canvas.width  = targetW;
            canvas.height = targetH;

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetW, targetH);

            // Use WebP if supported, else PNG
            const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
            const dataUrl = supportsWebP
                ? canvas.toDataURL('image/webp', 0.92)
                : canvas.toDataURL('image/png');

            // Preserve original src for high-res reload
            img.dataset.originalSrc = img.src;
            img.src = dataUrl;

            // Lock CSS dimensions to computed layout size
            img.style.width  = `${layoutW}px`;
            img.style.height = 'auto';
            img.style.maxWidth = '100%';

            processedImages.add(img);
        } catch (e) {
            // Cross-origin images: silently skip canvas taint errors
        }
    }

    // ─────────────────────────────────────────────
    // § 6 · SIDEBAR COLLAPSER
    // ─────────────────────────────────────────────
    let overlay = null;

    function manageSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        const mainContent = document.querySelector('.main-content');
        const { tier } = STATE;

        if (tier === 'xs' || tier === 'sm') {
            // Mobile: collapse sidebar off-screen, show toggle button
            sidebar.style.transform = sidebar.classList.contains('open')
                ? 'translateX(0)'
                : 'translateX(-100%)';
            sidebar.style.position = 'fixed';
            sidebar.style.zIndex   = '1001';
            sidebar.style.width    = '260px';
            if (mainContent) {
                mainContent.style.marginLeft = '0';
                mainContent.style.width      = '100%';
                mainContent.style.padding    = `${Math.round(16 * STATE.scale)}px`;
            }
            ensureOverlay();
            ensureMenuToggle();
        } else if (tier === 'md') {
            // Tablet: narrow sidebar
            sidebar.style.transform = 'translateX(0)';
            sidebar.style.position  = 'fixed';
            sidebar.style.width     = '220px';
            if (mainContent) mainContent.style.marginLeft = '220px';
            removeOverlay();
        } else {
            // Desktop: full sidebar
            sidebar.style.transform = 'translateX(0)';
            sidebar.style.position  = 'fixed';
            sidebar.style.width     = '280px';
            if (mainContent) mainContent.style.marginLeft = '280px';
            sidebar.classList.remove('open');
            removeOverlay();
        }
    }

    function ensureOverlay() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.id = 'vms-sidebar-overlay';
        overlay.style.cssText = `
            position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(0,0,0,0.45); z-index:1000; display:none;
            backdrop-filter:blur(2px);
        `;
        overlay.addEventListener('click', closeSidebarMobile);
        document.body.appendChild(overlay);
    }

    function removeOverlay() {
        if (overlay) { overlay.remove(); overlay = null; }
    }

    function ensureMenuToggle() {
        if (document.getElementById('vms-mobile-toggle')) return;
        const btn = document.createElement('button');
        btn.id = 'vms-mobile-toggle';
        btn.innerHTML = '<i class="bi bi-list"></i>';
        btn.style.cssText = `
            position:fixed; top:12px; left:12px; z-index:1100;
            background:var(--primary,#2563eb); color:#fff; border:none;
            border-radius:10px; width:42px; height:42px; font-size:1.4rem;
            cursor:pointer; display:flex; align-items:center; justify-content:center;
            box-shadow:0 4px 12px rgba(37,99,235,0.35);
        `;
        btn.addEventListener('click', toggleSidebarMobile);
        document.body.appendChild(btn);
    }

    function toggleSidebarMobile() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        const isOpen = sidebar.classList.toggle('open');
        sidebar.style.transform = isOpen ? 'translateX(0)' : 'translateX(-100%)';
        if (overlay) overlay.style.display = isOpen ? 'block' : 'none';
    }

    function closeSidebarMobile() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        sidebar.classList.remove('open');
        sidebar.style.transform = 'translateX(-100%)';
        if (overlay) overlay.style.display = 'none';
    }

    // ─────────────────────────────────────────────
    // § 7 · CARD GRID REFLOW
    // ─────────────────────────────────────────────
    /**
     * Grid columns formula:
     *   cols = max(1, floor(containerWidth / minCardWidth))
     *   gap  = fluid(12, 24)
     */
    const GRID_SELECTORS = ['.admin-portals-grid', '.stats-grid', '.cards-grid', '.grid'];

    function applyGridReflow() {
        const minCard = { xs: 280, sm: 280, md: 260, lg: 240, xl: 220 };
        const tier = STATE.tier;
        const gap = Math.round(fluid(8, 24));

        GRID_SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(grid => {
                const containerW = grid.parentElement
                    ? grid.parentElement.getBoundingClientRect().width
                    : STATE.W;
                const cols = Math.max(1, Math.floor(containerW / minCard[tier]));
                grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                grid.style.gap = `${gap}px`;
            });
        });
    }

    // ─────────────────────────────────────────────
    // § 8 · TABLE RESPONSIVE WRAPPER
    // ─────────────────────────────────────────────
    function wrapTables() {
        document.querySelectorAll('table').forEach(table => {
            if (table.parentElement && table.parentElement.classList.contains('vms-table-wrapper')) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'vms-table-wrapper';
            wrapper.style.cssText = `
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                border-radius: 12px;
                position: relative;
            `;
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);

            // Scroll hint gradient on mobile
            if (STATE.tier === 'xs' || STATE.tier === 'sm') {
                wrapper.style.background = 'linear-gradient(to right, transparent 80%, rgba(37,99,235,0.08))';
            } else {
                wrapper.style.background = '';
            }
        });
    }

    // ─────────────────────────────────────────────
    // § 9 · FORM FIELD STACKER
    // ─────────────────────────────────────────────
    function stackFormRows() {
        const isMobile = STATE.tier === 'xs' || STATE.tier === 'sm';
        document.querySelectorAll('.form-row, .field-row, .input-row').forEach(row => {
            row.style.flexDirection = isMobile ? 'column' : 'row';
            row.style.gap = isMobile ? '12px' : '16px';
        });
        document.querySelectorAll('.form-control, input, select, textarea').forEach(el => {
            el.style.width  = '100%';
            el.style.fontSize = `${Math.round(fluid(13, 15))}px`;
            el.style.padding  = `${Math.round(fluid(8, 12))}px ${Math.round(fluid(10, 16))}px`;
        });
    }

    // ─────────────────────────────────────────────
    // § 10 · BUTTON SCALING
    // ─────────────────────────────────────────────
    function scaleButtons() {
        const padV = Math.round(fluid(8, 12));
        const padH = Math.round(fluid(12, 20));
        const radius = Math.round(fluid(8, 12));
        document.querySelectorAll('.btn').forEach(btn => {
            btn.style.padding      = `${padV}px ${padH}px`;
            btn.style.borderRadius = `${radius}px`;
            btn.style.fontSize     = `${Math.round(fluid(12, 15))}px`;
        });
    }

    // ─────────────────────────────────────────────
    // § 11 · MODAL RESPONSIVENESS
    // ─────────────────────────────────────────────
    function adjustModals() {
        const maxW  = STATE.tier === 'xs' ? '95vw' : STATE.tier === 'sm' ? '90vw' : '420px';
        const pad   = Math.round(fluid(16, 28));
        document.querySelectorAll('.modal-card, .custom-dialog-box').forEach(card => {
            card.style.maxWidth = maxW;
            card.style.padding  = `${pad}px`;
            card.style.width    = '100%';
        });
    }

    // ─────────────────────────────────────────────
    // § 12 · PROFILE IMAGE CIRCLE RESIZE
    // ─────────────────────────────────────────────
    function resizeProfileImages() {
        const size = Math.round(fluid(64, 100));
        document.querySelectorAll('.profile-img').forEach(img => {
            img.style.width        = `${size}px`;
            img.style.height       = `${size}px`;
            img.style.borderRadius = '50%';
            img.style.objectFit   = 'cover';
        });
    }

    // ─────────────────────────────────────────────
    // § 13 · INJECT GLOBAL RESPONSIVE CSS
    // ─────────────────────────────────────────────
    function injectBaseCSS() {
        if (document.getElementById('vms-responsive-css')) return;
        const style = document.createElement('style');
        style.id = 'vms-responsive-css';
        style.innerHTML = `
            *, *::before, *::after { box-sizing: border-box; }
            body { overflow-x: hidden; }
            img  { max-width: 100%; height: auto; display: block; }
            .sidebar {
                transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                            width 0.28s ease;
            }
            .main-content { transition: margin-left 0.28s ease; }
            .vms-table-wrapper { width: 100%; }
            table { min-width: 520px; }

            /* Fluid heading via CSS clamp as fallback */
            h1 { font-size: clamp(22px, 4vw, 48px); }
            h2 { font-size: clamp(18px, 3.2vw, 36px); }
            h3 { font-size: clamp(16px, 2.8vw, 28px); }

            /* Prevent sidebar toggle overlap on desktop */
            @media (min-width: 1024px) {
                #vms-mobile-toggle { display: none !important; }
            }
            @media (max-width: 1023px) {
                .main-content { margin-left: 0 !important; }
            }

            /* Smooth image rendering */
            img { image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }
        `;
        document.head.appendChild(style);
    }

    // ─────────────────────────────────────────────
    // § 14 · ORCHESTRATOR
    // ─────────────────────────────────────────────
    function runAll() {
        captureState();
        applyTypography();
        applyLayout();
        manageSidebar();
        applyGridReflow();
        wrapTables();
        stackFormRows();
        scaleButtons();
        adjustModals();
        resizeProfileImages();
        optimizeImages();
    }

    // ─────────────────────────────────────────────
    // § 15 · RESIZE THROTTLE (RAF-aligned debounce)
    // ─────────────────────────────────────────────
    let rafPending = false;

    function onResize() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            runAll();
            rafPending = false;
        });
    }

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(onResize, 100), { passive: true });

    // ─────────────────────────────────────────────
    // § 16 · MUTATION OBSERVER (async content)
    // ─────────────────────────────────────────────
    const observer = new MutationObserver(() => {
        if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(() => {
                wrapTables();
                optimizeImages();
                applyTypography();
                scaleButtons();
                stackFormRows();
                rafPending = false;
            });
        }
    });

    // ─────────────────────────────────────────────
    // § 17 · INIT
    // ─────────────────────────────────────────────
    function init() {
        injectBaseCSS();
        runAll();
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API for manual calls
    window.VMSResponsive = {
        run: runAll,
        state: () => ({ ...STATE }),
        fluid,
        optimizeImages,
        toggleSidebar: toggleSidebarMobile
    };

})();
