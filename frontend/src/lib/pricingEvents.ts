const pricingChangedEvent = "photo-arena:pricing-changed";
let pricingChannel: BroadcastChannel | null | undefined;

function getPricingChannel() {
  if (pricingChannel !== undefined) return pricingChannel;
  try {
    pricingChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(pricingChangedEvent) : null;
  } catch {
    pricingChannel = null;
  }
  return pricingChannel;
}

export function notifyPricingChanged() {
  window.dispatchEvent(new Event(pricingChangedEvent));
  getPricingChannel()?.postMessage(null);
}

export function onPricingChanged(refresh: () => void) {
  window.addEventListener(pricingChangedEvent, refresh);
  const channel = getPricingChannel();
  channel?.addEventListener("message", refresh);
  return () => {
    window.removeEventListener(pricingChangedEvent, refresh);
    channel?.removeEventListener("message", refresh);
  };
}
