const IMAGE_PRIORITY_ATTR = 'data-image-priority';

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
  document.querySelectorAll('img').forEach((img) => {
    optimizeImage(img);
  });

  const observer = new MutationObserver((mutations) => {
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

  observer.observe(document.body, {childList: true, subtree: true});
}
