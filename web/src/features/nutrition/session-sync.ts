export function syncNutritionSessionFromEmail(
  service: { completeLogin(email: string): void; logout(): void },
  email: string | null,
) {
  if (email) {
    service.completeLogin(email);
    return;
  }
  service.logout();
}