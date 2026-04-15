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

  const pendingImages = new Set<HTMLImageElement>();
  let pendingFrame: number | null = null;

  const enqueueImageOptimization = (img: HTMLImageElement) => {
    pendingImages.add(img);

    if (pendingFrame !== null) {
      return;
    }

    pendingFrame = window.requestAnimationFrame(() => {
      pendingImages.forEach((image) => optimizeImage(image));
      pendingImages.clear();
      pendingFrame = null;
    });
  };

  const startObserver = () => {
    if (optimizationObserver || !document.body) {
      return;
    }

    optimizationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLImageElement) {
          enqueueImageOptimization(mutation.target);
          return;
        }

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          if (node.tagName === 'IMG') {
            enqueueImageOptimization(node as HTMLImageElement);
            return;
          }

          node.querySelectorAll('img').forEach((img) => enqueueImageOptimization(img));
        });
      });
    });

    optimizationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', IMAGE_PRIORITY_ATTR],
    });
    optimizeExistingImages();
  };

  if (document.readyState === 'loading' || !document.body) {
    window.addEventListener('DOMContentLoaded', startObserver, {once: true});
    return;
  }

  startObserver();
}
