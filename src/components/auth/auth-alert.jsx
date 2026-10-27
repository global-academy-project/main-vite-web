export default function AuthAlert({ type = "info", children, action }) {
  if (!children) return null;
  return (
    <div className={`auth-alert auth-alert--${type}`} role="alert">
      <span>
        {type === "success"
          ? "✓"
          : type === "warning"
            ? "!"
            : type === "error"
              ? "×"
              : "i"}
      </span>
      <div>
        {children}
        {action}
      </div>
    </div>
  );
}
