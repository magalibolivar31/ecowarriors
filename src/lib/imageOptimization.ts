const IMAGE_PRIORITY_ATTR = 'data-image-priority';
let optimizationObserver: MutationObserver | null = null;

function optimizeImage(img: HTMLImageElement) {
  const isHighPriority = img.getAttribute(IMAGE_PRIORITY_ATTR) === 'high';

  if (!img.hasAttribute('loading')) {
    img.loading = isHighPriority ? 'eager' : 'lazy';
  }

  if (!img.hasAttribute('decoding')) {
    img.decoding = 'async';
  }

  if (!img.hasAttribute('fetchpriority')) {
    img.setAttribute('fetchpriority', isHighPriority ? 'high' : 'auto');
  }
}

export function initializeImageOptimization() {
  if (optimizationObserver) {
    return;
  }

  const optimizeExistingImages = () => {
    document.querySelectorAll('img').forEach((img) => {
      optimizeImage(img);
    });
  };

  optimizationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;

        if (node.tagName === 'IMG') {
          optimizeImage(node as HTMLImageElement);
          return;
        }

        node.querySelectorAll('img').forEach((img) => optimizeImage(img));
      });
    });
  });

  optimizationObserver.observe(document.body, {childList: true, subtree: true});
  requestAnimationFrame(optimizeExistingImages);
}
