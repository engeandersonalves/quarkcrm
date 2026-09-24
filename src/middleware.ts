import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/env";

const PUBLIC_PREFIXES = ["/p/", "/captura", "/api/"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  // Páginas públicas e APIs (que validam o próprio acesso) não precisam de sessão aqui.
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return response;

  if (!hasSupabase) {
    if (pathname === "/login" || pathname === "/setup") return response;
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getSession lê o cookie localmente e só vai à rede quando o token precisa ser renovado.
  // É apenas o "porteiro" das telas: os dados continuam protegidos pelo RLS do banco.
  const {
    data: { session },
  } = await sb.auth.getSession();
  const user = session?.user;

  if (!user && pathname !== "/login" && pathname !== "/setup") {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
