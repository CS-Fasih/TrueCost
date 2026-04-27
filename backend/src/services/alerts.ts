export function shouldTriggerAlert(currentPrice: number, targetPrice: number): boolean {
  return Number.isFinite(currentPrice) && Number.isFinite(targetPrice) && currentPrice <= targetPrice;
}
