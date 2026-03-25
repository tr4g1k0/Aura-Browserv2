/**
 * Product Detection Service
 * JavaScript injection scripts for detecting product/shopping pages
 * and extracting price, title, image, and site information.
 */

// Main product detection + extraction script injected on every page load
export const productDetectionScript = `
(function() {
  try {
    if (window.__auraProductDetectorActive) return;
    window.__auraProductDetectorActive = true;

    function detectProduct() {
      // ── Price Detection ──
      var priceSelectors = [
        '[itemprop="price"]',
        '[data-price]',
        '[class*="price"][class*="current"]',
        '[class*="price"][class*="sale"]',
        '[class*="price"][class*="now"]',
        '[class*="Price"][class*="Current"]',
        '[class*="Price"][class*="Sale"]',
        '[class*="price-main"]',
        '[class*="priceblock"]',
        '[class*="product-price"]',
        '[class*="productPrice"]',
        '[class*="offer-price"]',
        '[class*="selling-price"]',
        '[class*="finalPrice"]',
        '[class*="actual-price"]',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price .a-offscreen',
        '.price-characteristic',
        '[data-automation="buybox-price"]',
        '#price_inside_buybox',
        '.price--main',
        '.product-new-price',
        '[class*="pdp-price"]',
        '[class*="product__price"]',
        '[class*="price"]:not(del):not([class*="was"]):not([class*="old"]):not([class*="compare"]):not([class*="list"]):not([class*="regular"]):not(style)',
        '[id*="price"]:not(del)'
      ];

      var priceEl = null;
      var priceText = '';
      for (var i = 0; i < priceSelectors.length; i++) {
        var els = document.querySelectorAll(priceSelectors[i]);
        for (var j = 0; j < els.length; j++) {
          var el = els[j];
          var text = (el.getAttribute('content') || el.getAttribute('data-price') || el.innerText || '').trim();
          if (text && /[\$\£\€\¥₹]?\s*\d+[.,]?\d*/.test(text)) {
            priceEl = el;
            priceText = text;
            break;
          }
        }
        if (priceEl) break;
      }

      if (!priceEl) return null;

      // ── Add-to-Cart or Buy Button Detection ──
      var cartSelectors = [
        '[class*="add-to-cart"]', '[id*="add-to-cart"]',
        '[class*="addToCart"]', '[id*="addToCart"]',
        '[class*="add_to_cart"]', '[id*="add_to_cart"]',
        '[class*="buy-now"]', '[class*="buyNow"]', '[class*="buy_now"]',
        '[class*="add-to-bag"]', '[class*="addToBag"]',
        'button[name="add"]',
        '[data-action="add-to-cart"]',
        '[aria-label*="Add to Cart"]',
        '[aria-label*="Add to Bag"]',
        '[aria-label*="Buy Now"]',
        '#add-to-cart-button',
        '#buy-now-button',
        '.atc-button',
        '[class*="checkout"]'
      ];
      var hasCartButton = false;
      for (var k = 0; k < cartSelectors.length; k++) {
        if (document.querySelector(cartSelectors[k])) {
          hasCartButton = true;
          break;
        }
      }

      // ── Product Title ──
      var titleEl = document.querySelector('[itemprop="name"]') ||
                    document.querySelector('h1[class*="product"]') ||
                    document.querySelector('h1[class*="title"]') ||
                    document.querySelector('[data-automation="product-title"]') ||
                    document.querySelector('#productTitle') ||
                    document.querySelector('.product-title') ||
                    document.querySelector('h1');
      var title = titleEl ? titleEl.innerText.trim().substring(0, 200) : '';

      if (!title && !hasCartButton) return null;
      if (!title) return null;

      // ── Parse Price ──
      var currencyMatch = priceText.match(/([\$\£\€\¥₹])/)
        || priceText.match(/(USD|GBP|EUR|JPY|INR|CAD|AUD)/i);
      var currency = currencyMatch ? currencyMatch[1] : '$';
      var priceNum = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(/,/g, ''));
      if (isNaN(priceNum) || priceNum <= 0 || priceNum > 1000000) return null;

      // ── Product Image ──
      var imgSelectors = [
        '[itemprop="image"]',
        '#landingImage', '#imgBlkFront',
        '[data-automation="hero-image"] img',
        '.product-image img',
        '[class*="product"][class*="image"] img',
        '[class*="gallery"] img:first-child',
        'meta[property="og:image"]'
      ];
      var imageUrl = '';
      for (var m = 0; m < imgSelectors.length; m++) {
        var imgEl = document.querySelector(imgSelectors[m]);
        if (imgEl) {
          imageUrl = imgEl.src || imgEl.getAttribute('content') || imgEl.getAttribute('data-src') || '';
          if (imageUrl) break;
        }
      }

      // ── Site Name ──
      var siteMeta = document.querySelector('meta[property="og:site_name"]');
      var siteName = siteMeta ? siteMeta.getAttribute('content') : window.location.hostname.replace('www.', '');

      return {
        title: title,
        price: priceNum,
        priceText: priceText,
        currency: currency,
        imageUrl: imageUrl,
        siteName: siteName || '',
        url: window.location.href,
        hasCartButton: hasCartButton
      };
    }

    // Detect after page settles
    function runDetection() {
      var result = detectProduct();
      if (result) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PRODUCT_DETECTED',
          product: result
        }));
      }
    }

    // Run after a delay to let dynamic content load
    setTimeout(runDetection, 2000);
    // Re-check if AJAX updates the page
    setTimeout(runDetection, 5000);

  } catch(e) {
    console.log('[Aura PriceTracker] Detection error:', e);
  }
})();
true;
`;

// Deal Score badge injection script (injected into the webpage)
export function getDealScoreInjectionScript(score: number, label: string, isNew: boolean): string {
  let bgColor, textColor, borderColor;
  if (isNew) {
    bgColor = '#1a1a2e'; textColor = '#00FFFF'; borderColor = '#00FFFF';
  } else if (score >= 9) {
    bgColor = '#00C853'; textColor = '#FFFFFF'; borderColor = '#00E676';
  } else if (score >= 7) {
    bgColor = '#2962FF'; textColor = '#FFFFFF'; borderColor = '#448AFF';
  } else if (score >= 4) {
    bgColor = '#FF8F00'; textColor = '#FFFFFF'; borderColor = '#FFB300';
  } else {
    bgColor = '#D50000'; textColor = '#FFFFFF'; borderColor = '#FF1744';
  }

  // Safely encode dynamic text values as JSON strings for use in injected JS.
  // This prevents XSS by ensuring no HTML or JS can break out of the string context.
  const safeScoreText = JSON.stringify(isNew ? 'NEW' : String(score));
  const safeLabelText = JSON.stringify(isNew ? 'Tracking' : (score >= 9 ? '🔥 BEST' : label));

  return `
    (function() {
      if (document.getElementById('aura-deal-score')) document.getElementById('aura-deal-score').remove();
      var badge = document.createElement('div');
      badge.id = 'aura-deal-score';
      badge.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;width:64px;height:64px;border-radius:50%;background:${bgColor};border:2px solid ${borderColor};display:flex;align-items:center;justify-content:center;flex-direction:column;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.4);transition:transform 0.2s;touch-action:none;';

      // Build badge content with safe DOM APIs instead of innerHTML to prevent XSS.
      var topDiv = document.createElement('div');
      topDiv.style.cssText = 'font-size:10px;font-weight:700;color:${textColor};opacity:0.8;letter-spacing:1px;';
      topDiv.textContent = 'AURA';

      var midDiv = document.createElement('div');
      midDiv.style.cssText = 'font-size:${isNew ? '10' : '22'}px;font-weight:900;color:${textColor};line-height:1;';
      midDiv.textContent = ${safeScoreText};

      var botDiv = document.createElement('div');
      botDiv.style.cssText = 'font-size:8px;color:${textColor};opacity:0.9;';
      botDiv.textContent = ${safeLabelText};

      badge.appendChild(topDiv);
      badge.appendChild(midDiv);
      badge.appendChild(botDiv);
      
      // Make draggable
      var isDragging = false, startX, startY, origX, origY;
      badge.addEventListener('touchstart', function(e) {
        var t = e.touches[0];
        startX = t.clientX; startY = t.clientY;
        var r = badge.getBoundingClientRect();
        origX = r.left; origY = r.top;
        isDragging = false;
      });
      badge.addEventListener('touchmove', function(e) {
        var t = e.touches[0];
        var dx = t.clientX - startX, dy = t.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;
        if (isDragging) {
          e.preventDefault();
          badge.style.right = 'auto';
          badge.style.left = (origX + dx) + 'px';
          badge.style.top = (origY + dy) + 'px';
        }
      });
      badge.addEventListener('touchend', function(e) {
        if (!isDragging) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEAL_SCORE_TAP' }));
        }
      });
      badge.addEventListener('click', function() {
        if (!isDragging) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEAL_SCORE_TAP' }));
        }
      });
      document.body.appendChild(badge);
    })();
    true;
  `;
}

// Checkout page detection for coupon finder
export const checkoutDetectionScript = `
(function() {
  try {
    var checkoutIndicators = [
      '[class*="checkout"]', '[id*="checkout"]',
      '[class*="cart"]', '[id*="cart"]',
      '[class*="payment"]', '[id*="payment"]',
      '[class*="order-summary"]',
      'input[name*="coupon"]', 'input[name*="promo"]',
      'input[placeholder*="coupon"]', 'input[placeholder*="promo"]',
      '[class*="promo-code"]', '[class*="coupon-code"]',
      '[class*="discount-code"]'
    ];
    var isCheckout = false;
    var url = window.location.href.toLowerCase();
    if (url.includes('checkout') || url.includes('cart') || url.includes('basket') || url.includes('payment')) {
      isCheckout = true;
    }
    if (!isCheckout) {
      for (var i = 0; i < checkoutIndicators.length; i++) {
        if (document.querySelector(checkoutIndicators[i])) {
          isCheckout = true;
          break;
        }
      }
    }
    if (isCheckout) {
      var domain = window.location.hostname.replace('www.', '');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'CHECKOUT_DETECTED',
        domain: domain,
        url: window.location.href
      }));
    }
  } catch(e) {}
})();
true;
`;
