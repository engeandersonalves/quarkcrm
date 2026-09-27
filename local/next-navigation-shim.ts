// Substitui next/navigation na versão local (sem Next.js).
export function useRouter() {
  return { push: () => {}, replace: () => {}, refresh: () => {}, back: () => history.back() };
}
