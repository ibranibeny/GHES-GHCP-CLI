export function totalBeforeReview(price, quantity, discountPercent) {
  return price * quantity - discountPercent;
}

export function totalAfterReview(price, quantity, discountPercent) {
  if (!Number.isFinite(price) || price < 0) {
    throw new RangeError('Price must be finite and non-negative');
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError('Quantity must be a positive safe integer');
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new RangeError('Discount must be between 0 and 100');
  }
  const subtotal = price * quantity;
  if (!Number.isFinite(subtotal)) {
    throw new RangeError('Subtotal must be finite');
  }
  return Math.round(subtotal * (1 - discountPercent / 100) * 100) / 100;
}
