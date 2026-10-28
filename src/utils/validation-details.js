const fieldAliases = {
  confirmPassword: "passwordConfirm",
  newPassword: "password",
};

export function getFieldErrors(error, aliases = {}) {
  if (error?.code !== "INVALID_REQUEST" || !Array.isArray(error.details)) {
    return {};
  }

  return error.details.reduce((errors, detail) => {
    if (!detail?.field || !detail?.message) return errors;
    const field = aliases[detail.field] ?? fieldAliases[detail.field] ?? detail.field;
    errors[field] = errors[field] ? `${errors[field]} ${detail.message}` : detail.message;
    return errors;
  }, {});
}

export function getDetailMessages(error) {
  return error?.code === "INVALID_REQUEST" && Array.isArray(error.details)
    ? error.details.map((detail) => detail?.message).filter(Boolean)
    : [];
}
