export const validPassword = (value) =>
  value.length >= 8 &&
  value.length <= 64 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);
