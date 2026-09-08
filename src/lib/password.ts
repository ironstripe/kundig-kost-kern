/** Password rules shared by client validation and server functions. */
export const PASSWORD_MIN_LENGTH = 10;

export function validatePassword(password: string, confirm?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "Das Passwort muss Gross- und Kleinbuchstaben enthalten.";
  }
  if (!/\d/.test(password)) {
    return "Das Passwort muss mindestens eine Ziffer enthalten.";
  }
  if (confirm !== undefined && password !== confirm) {
    return "Die beiden Passwörter stimmen nicht überein.";
  }
  return null;
}
