"""
Inventech Web — Frontend Security Test Suite
=============================================
Testa o frontend Next.js contra vulnerabilidades comuns no browser.

Instalação (uma vez):
    pip install playwright
    playwright install chromium

Uso:
    python frontend_security_test.py --web-url http://localhost:3001 --email seu@email.com --password suasenha

Testes cobertos:
    1.  Security Headers (X-Frame-Options, CSP, HSTS, etc.)
    2.  Proteção de rotas — redirect para /login sem cookie
    3.  Open Redirect via ?redirect= com URL externa
    4.  Cookies HttpOnly — não acessíveis via document.cookie
    5.  Formulário de login — validação client-side (campo vazio, email inválido)
    6.  Clickjacking — página não deve carregar em iframe
    7.  Autocomplete em campos sensíveis (senha)
    8.  Exposição de dados sensíveis no HTML fonte
    9.  Sessão expirada — remover cookie e verificar redirect
   10.  2FA UI — campos corretos e sem auto-submit inseguro
"""

import argparse
import json
import sys
import time
from datetime import datetime

try:
    from playwright.sync_api import sync_playwright, Page, expect
    from colorama import Fore, Style, init
    init(autoreset=True)
except ImportError:
    print("Instale dependências:")
    print("  pip install playwright colorama")
    print("  playwright install chromium")
    sys.exit(1)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def ok(msg):     print(f"{Fore.GREEN}  [PASS]{Style.RESET_ALL} {msg}")
def fail(msg):   print(f"{Fore.RED}  [FAIL]{Style.RESET_ALL} {msg}")
def warn(msg):   print(f"{Fore.YELLOW}  [WARN]{Style.RESET_ALL} {msg}")
def info(msg):   print(f"{Fore.CYAN}  [INFO]{Style.RESET_ALL} {msg}")
def header(msg): print(f"\n{Fore.MAGENTA}{'='*60}\n  {msg}\n{'='*60}{Style.RESET_ALL}")


class FrontendSecurityTester:
    def __init__(self, web_url: str, api_url: str, email: str, password: str):
        self.web = web_url.rstrip("/")
        self.api  = api_url.rstrip("/")
        self.email    = email
        self.password = password
        self.results: list[dict] = []

    def _record(self, test: str, passed: bool | None, detail: str = ""):
        self.results.append({"test": test, "passed": passed, "detail": detail})

    def _login(self, page: Page) -> bool:
        """Faz login via UI e espera chegar no dashboard."""
        page.goto(f"{self.web}/login")
        page.fill('input[type="email"]', self.email)
        page.fill('input[type="password"]', self.password)
        page.click('button[type="submit"]')
        try:
            page.wait_for_url(f"**/dashboard**", timeout=8000)
            return True
        except Exception:
            # Pode precisar de 2FA
            if "2fa" in page.url or page.locator('input[maxlength="6"]').count() > 0:
                warn("2FA ativo — login UI parou em verificação de código. Testes que precisam de sessão serão pulados.")
            else:
                warn(f"Login UI falhou. URL atual: {page.url}")
            return False

    # ─── 1. SECURITY HEADERS ──────────────────────────────────────────────────

    def test_security_headers(self, page: Page):
        header("1. Security Headers")

        import urllib.request
        try:
            req = urllib.request.Request(f"{self.web}/login")
            with urllib.request.urlopen(req) as resp:
                headers = {k.lower(): v for k, v in resp.getheaders()}
        except Exception as e:
            warn(f"Não foi possível buscar headers: {e}")
            self._record("security_headers", None, str(e))
            return

        checks = {
            "x-frame-options":          ("DENY" in headers.get("x-frame-options", "").upper(),
                                         "Clickjacking protection"),
            "x-content-type-options":   ("nosniff" in headers.get("x-content-type-options", "").lower(),
                                         "MIME-type sniffing protection"),
            "referrer-policy":          (bool(headers.get("referrer-policy")),
                                         "Referrer-Policy presente"),
            "permissions-policy":       (bool(headers.get("permissions-policy")),
                                         "Permissions-Policy presente"),
            "content-security-policy":  (bool(headers.get("content-security-policy")),
                                         "Content-Security-Policy presente"),
        }

        all_ok = True
        for hdr, (present, desc) in checks.items():
            val = headers.get(hdr, "ausente")
            if present:
                ok(f"{desc}: '{val[:60]}'")
            else:
                fail(f"{desc} — header '{hdr}' ausente ou incorreto")
                all_ok = False

        # CSP não deve ter 'unsafe-eval' em produção
        csp = headers.get("content-security-policy", "")
        if "unsafe-eval" in csp and "localhost" not in self.web:
            fail("CSP contém 'unsafe-eval' em produção — risco de XSS")
            all_ok = False
        elif "unsafe-eval" in csp:
            warn("CSP contém 'unsafe-eval' — aceitável em dev, remova em produção")

        self._record("security_headers", all_ok)

    # ─── 2. PROTEÇÃO DE ROTAS ─────────────────────────────────────────────────

    def test_route_protection(self, page: Page):
        header("2. Proteção de Rotas (sem cookie)")

        # Garante que não há cookies de sessão
        page.context.clear_cookies()

        protected_routes = [
            "/dashboard",
            "/clientes",
            "/equipamentos",
            "/ordens-de-servico",
        ]

        all_ok = True
        for route in protected_routes:
            page.goto(f"{self.web}{route}", wait_until="domcontentloaded")
            time.sleep(0.5)
            current = page.url

            if "/login" in current:
                ok(f"{route} → redirecionou para /login")
            else:
                fail(f"{route} → NÃO redirecionou! URL atual: {current}")
                all_ok = False

        self._record("route_protection", all_ok)

    # ─── 3. OPEN REDIRECT ─────────────────────────────────────────────────────

    def test_open_redirect(self, page: Page):
        header("3. Open Redirect via ?redirect=")

        page.context.clear_cookies()

        evil_redirects = [
            "https://evil.com",
            "//evil.com",
            "https://evil.com/phishing",
        ]

        from urllib.parse import urlparse, quote

        vuln_found = False
        web_host = urlparse(self.web).netloc  # ex: localhost:3001

        for target in evil_redirects:
            url = f"{self.web}/login?redirect={quote(target, safe='')}"
            page.goto(url, wait_until="domcontentloaded")
            time.sleep(0.8)
            current = page.url
            current_host = urlparse(current).netloc

            # Vulnerável APENAS se o browser foi de fato para o domínio externo
            if current_host and current_host != web_host:
                fail(f"CRÍTICO: Open redirect para '{target}' — URL atual: {current}")
                vuln_found = True
            else:
                ok(f"'{target}' não causou redirect externo (permaneceu em {current_host})")

        self._record("open_redirect", not vuln_found)

    # ─── 4. COOKIES HTTPONLY ──────────────────────────────────────────────────

    def test_cookie_httponly(self, page: Page):
        header("4. Cookies HttpOnly (não acessíveis via JS)")

        # Injeta cookies de sessão simulados com HttpOnly para testar
        cookies = page.context.cookies()
        session_cookies = [c for c in cookies if c["name"] in ("access_token", "refresh_token")]

        if not session_cookies:
            # Tenta fazer login primeiro
            self._login(page)
            cookies = page.context.cookies()
            session_cookies = [c for c in cookies if c["name"] in ("access_token", "refresh_token")]

        if not session_cookies:
            warn("Sem cookies de sessão para verificar — pulando (faça login primeiro)")
            self._record("cookie_httponly", None, "sem cookies")
            return

        all_httponly = True
        for cookie in session_cookies:
            # Tenta acessar via JS
            js_cookies = page.evaluate("document.cookie")
            if cookie["name"] in js_cookies:
                fail(f"Cookie '{cookie['name']}' ACESSÍVEL via document.cookie — sem HttpOnly!")
                all_httponly = False
            else:
                ok(f"Cookie '{cookie['name']}' não visível via document.cookie (HttpOnly OK)")

            # Verifica flag HttpOnly diretamente
            if cookie.get("httpOnly"):
                ok(f"Cookie '{cookie['name']}' tem flag HttpOnly definida")
            else:
                fail(f"Cookie '{cookie['name']}' SEM flag HttpOnly!")
                all_httponly = False

        self._record("cookie_httponly", all_httponly)

    # ─── 5. VALIDAÇÃO CLIENT-SIDE ─────────────────────────────────────────────

    def test_form_validation(self, page: Page):
        header("5. Validação Client-Side do Formulário de Login")

        page.context.clear_cookies()
        page.goto(f"{self.web}/login", wait_until="domcontentloaded")

        all_ok = True

        # 5a — Submit com campos vazios
        page.click('button[type="submit"]')
        time.sleep(0.5)
        errors = page.locator('[class*="error"], [class*="invalid"], [role="alert"]').all_text_contents()
        if errors:
            ok(f"Campos vazios bloqueados: {errors[:2]}")
        elif "/login" in page.url:
            ok("Campos vazios bloqueados (permaneceu em /login)")
        else:
            fail(f"Submit com campos vazios não foi bloqueado — URL: {page.url}")
            all_ok = False

        # 5b — Email inválido
        page.fill('input[type="email"]', "nao-e-um-email")
        page.fill('input[type="password"]', "qualquercoisa")
        page.click('button[type="submit"]')
        time.sleep(0.5)
        if "/login" in page.url:
            ok("Email inválido bloqueado pelo Zod/browser")
        else:
            fail(f"Email inválido não foi bloqueado — URL: {page.url}")
            all_ok = False

        # 5c — Verifica se campo senha tem type="password" (não expõe em tela)
        pwd_type = page.locator('input[name="password"], input[placeholder*="senha" i]').first.get_attribute("type")
        if pwd_type == "password":
            ok("Campo senha tem type='password'")
        else:
            fail(f"Campo senha tem type='{pwd_type}' — senha visível por padrão!")
            all_ok = False

        self._record("form_validation", all_ok)

    # ─── 6. CLICKJACKING ──────────────────────────────────────────────────────

    def test_clickjacking(self, page: Page):
        header("6. Clickjacking (iframe embedding)")

        # Tenta carregar a página em um iframe via JS
        page.goto("about:blank")
        page.set_content(f"""
            <html><body>
            <iframe id="target" src="{self.web}/login" width="800" height="600"></iframe>
            <script>
                setTimeout(() => {{
                    try {{
                        const f = document.getElementById('target');
                        window._loaded = f.contentDocument ? 'loaded' : 'blocked';
                    }} catch(e) {{
                        window._loaded = 'blocked_csp';
                    }}
                }}, 2000);
            </script>
            </body></html>
        """)
        time.sleep(3)

        result = page.evaluate("window._loaded ?? 'unknown'")
        info(f"Resultado do iframe: {result}")

        if result in ("blocked", "blocked_csp"):
            ok("Página não carregou em iframe (X-Frame-Options ou CSP frame-ancestors)")
            self._record("clickjacking", True)
        elif result == "loaded":
            fail("CRÍTICO: Página carregou em iframe — clickjacking possível!")
            self._record("clickjacking", False)
        else:
            warn("Resultado inconclusivo — verifique X-Frame-Options nos headers")
            self._record("clickjacking", None, "inconclusivo")

    # ─── 7. AUTOCOMPLETE ──────────────────────────────────────────────────────

    def test_autocomplete(self, page: Page):
        header("7. Autocomplete em Campos Sensíveis")

        page.context.clear_cookies()
        page.goto(f"{self.web}/login", wait_until="domcontentloaded")

        pwd_input = page.locator('input[type="password"]').first
        autocomplete = pwd_input.get_attribute("autocomplete") or ""

        if autocomplete in ("new-password", "current-password", "off"):
            ok(f"Campo senha tem autocomplete='{autocomplete}'")
            self._record("autocomplete_password", True)
        elif autocomplete == "":
            warn("Campo senha sem atributo autocomplete — browser decide (geralmente aceita salvar)")
            self._record("autocomplete_password", None, "sem atributo")
        else:
            fail(f"Campo senha tem autocomplete='{autocomplete}' — pode vazar senha salva")
            self._record("autocomplete_password", False, autocomplete)

    # ─── 8. DADOS SENSÍVEIS NO HTML ───────────────────────────────────────────

    def test_sensitive_data_exposure(self, page: Page):
        header("8. Exposição de Dados Sensíveis no HTML")

        page.goto(f"{self.web}/login", wait_until="domcontentloaded")
        html = page.content().lower()

        sensitive_patterns = {
            "JWT token no HTML":    "eyjabc" in html or ('ey' in html and '.ey' in html),
            "Senha no HTML":        'password":'  in html and '"value"' in html,
            "Secret no HTML":       'secret' in html and ('key' in html or 'token' in html),
            "Stack trace no HTML":  'at object.' in html or 'syntaxerror' in html,
        }

        all_ok = True
        for desc, found in sensitive_patterns.items():
            if found:
                fail(f"{desc} detectado no HTML da página!")
                all_ok = False
            else:
                ok(f"{desc}: não detectado")

        self._record("sensitive_data_exposure", all_ok)

    # ─── 9. SESSÃO EXPIRADA ───────────────────────────────────────────────────

    def test_session_expiry(self, page: Page):
        header("9. Comportamento com Sessão Expirada")

        # Faz login
        logged_in = self._login(page)
        if not logged_in:
            warn("Login falhou — pulando teste de sessão expirada")
            self._record("session_expiry", None, "login falhou")
            return

        info("Logado. Removendo cookie access_token para simular expiração...")

        # Remove access_token (mantém refresh_token para testar se o frontend trata bem)
        cookies = page.context.cookies()
        page.context.clear_cookies()
        refresh = [c for c in cookies if c["name"] == "refresh_token"]
        if refresh:
            page.context.add_cookies(refresh)

        # Tenta acessar rota protegida
        page.goto(f"{self.web}/dashboard", wait_until="domcontentloaded")
        time.sleep(1)

        current = page.url
        if "/login" in current:
            ok("Sessão sem access_token → redirecionou para /login")
            self._record("session_expiry", True)
        elif "/dashboard" in current:
            # Pode ter feito refresh automático com o refresh_token — comportamento correto
            ok("Dashboard carregou com refresh_token — renovação automática funcionando")
            self._record("session_expiry", True, "renovação automática com refresh_token")
        else:
            warn(f"URL inesperada: {current}")
            self._record("session_expiry", None, f"url={current}")

    # ─── 10. 2FA UI ───────────────────────────────────────────────────────────

    def test_2fa_ui(self, page: Page):
        header("10. 2FA UI — Segurança do Formulário")

        page.context.clear_cookies()
        page.goto(f"{self.web}/login", wait_until="domcontentloaded")

        # Verifica se o campo de email tem type correto
        email_input = page.locator('input[type="email"]').first
        if email_input.count() > 0:
            ok("Campo email tem type='email'")
        else:
            warn("Campo email não encontrado ou sem type='email'")

        # Verifica se existe campo de código 2FA (maxlength=6)
        page.fill('input[type="email"]', self.email)
        page.fill('input[type="password"]', self.password)
        page.click('button[type="submit"]')
        time.sleep(2)

        twofa_input = page.locator('input[maxlength="6"], input[placeholder*="código" i], input[placeholder*="6" i]').first

        if twofa_input.count() > 0 or page.locator('input[inputmode="numeric"]').count() > 0:
            ok("Campo 2FA encontrado na UI")

            # Verifica se aceita apenas números
            input_mode = twofa_input.get_attribute("inputmode") or ""
            input_type = twofa_input.get_attribute("type") or ""
            if input_mode == "numeric" or input_type in ("number", "tel"):
                ok(f"Campo 2FA aceita apenas números (inputmode={input_mode}, type={input_type})")
            else:
                warn(f"Campo 2FA sem restrição de tipo (inputmode={input_mode}, type={input_type})")

            self._record("2fa_ui_security", True)
        else:
            if "/dashboard" in page.url:
                info("2FA não ativado para este usuário — pulando verificação de UI 2FA")
                self._record("2fa_ui_security", None, "2FA não ativado para este usuário")
            else:
                warn(f"Campo 2FA não encontrado. URL: {page.url}")
                self._record("2fa_ui_security", None, "campo não encontrado")

    # ─── RELATÓRIO ────────────────────────────────────────────────────────────

    def print_report(self):
        header("RELATÓRIO FINAL — FRONTEND")
        passed  = [r for r in self.results if r["passed"] is True]
        failed  = [r for r in self.results if r["passed"] is False]
        skipped = [r for r in self.results if r["passed"] is None]

        print(f"\n  Total : {len(self.results)}")
        print(f"  {Fore.GREEN}Passou: {len(passed)}{Style.RESET_ALL}")
        print(f"  {Fore.RED}Falhou: {len(failed)}{Style.RESET_ALL}")
        print(f"  {Fore.YELLOW}Pulado: {len(skipped)}{Style.RESET_ALL}")

        if failed:
            print(f"\n{Fore.RED}  VULNERABILIDADES ENCONTRADAS:{Style.RESET_ALL}")
            for r in failed:
                print(f"    ✗ {r['test']}" + (f"  ({r['detail']})" if r["detail"] else ""))

        if skipped:
            print(f"\n{Fore.YELLOW}  PULADOS:{Style.RESET_ALL}")
            for r in skipped:
                print(f"    - {r['test']}" + (f"  ({r['detail']})" if r["detail"] else ""))

        print(f"\n  Executado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        path = f"frontend_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump({
                "summary": {"passed": len(passed), "failed": len(failed), "skipped": len(skipped)},
                "results": self.results,
            }, f, indent=2, ensure_ascii=False)
        print(f"  Relatório salvo em: {path}\n")

    # ─── EXECUÇÃO ─────────────────────────────────────────────────────────────

    def run_all(self):
        print(f"\n{Fore.CYAN}{'='*60}")
        print(f"  Inventech Frontend Security Test Suite")
        print(f"  Target : {self.web}")
        print(f"  Email  : {self.email}")
        print(f"{'='*60}{Style.RESET_ALL}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(ignore_https_errors=True)
            page = context.new_page()

            # Testes que não precisam de login
            self.test_security_headers(page)
            self.test_route_protection(page)
            self.test_open_redirect(page)
            self.test_form_validation(page)
            self.test_clickjacking(page)
            self.test_autocomplete(page)
            self.test_sensitive_data_exposure(page)

            # Testes que precisam de login
            self.test_cookie_httponly(page)
            self.test_session_expiry(page)
            self.test_2fa_ui(page)

            browser.close()

        self.print_report()


def main():
    parser = argparse.ArgumentParser(description="Inventech Frontend Security Tester")
    parser.add_argument("--web-url", default="http://localhost:3001", help="URL do frontend Next.js")
    parser.add_argument("--api-url", default="http://localhost:3000", help="URL da API (para referência no CSP)")
    parser.add_argument("--email",    required=True, help="Email de usuário de teste")
    parser.add_argument("--password", required=True, help="Senha do usuário de teste")
    args = parser.parse_args()

    FrontendSecurityTester(args.web_url, args.api_url, args.email, args.password).run_all()


if __name__ == "__main__":
    main()
