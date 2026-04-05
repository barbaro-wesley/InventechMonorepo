"""
Inventech API - Auth Security Test Suite
=========================================
Testa o módulo de autenticação contra ataques comuns.
Execute apenas contra ambientes de desenvolvimento/staging com autorização.

Uso:
    pip install requests colorama
    python auth_security_test.py --base-url http://localhost:3000 --email wesleybarbaro09@gmail.com --password #$wes.bar12#$

    O prefixo /api/v1 é adicionado automaticamente.

Testes cobertos:
    1.  Brute Force Login (bloqueio após 5 tentativas via LoginSecurityService)
    2.  IP Spoofing (X-Forwarded-For para bypassar bloqueio por IP)
    3.  User Enumeration via Timing (forgot-password)
    4.  JWT alg=none + Payload Tamper
    5.  2FA Brute Force (6 dígitos sem rate limit no /auth/2fa/verify)
    6.  Refresh Token Reuse (rotation + revogação de todos os tokens)
    7.  SQL/NoSQL Injection
    8.  Mass Assignment (escalada de role no JWT)
    9.  CORS Origin Validation
   10.  Cookie Security Flags (HttpOnly, SameSite, Secure)
   11.  Account Lockout Bypass via Email Case
"""

import argparse
import json
import time
import base64
import statistics
import sys
from datetime import datetime

try:
    import requests
    from colorama import Fore, Style, init
    init(autoreset=True)
except ImportError:
    print("Instale dependências: pip install requests colorama")
    sys.exit(1)


# ─── Helpers de output ────────────────────────────────────────────────────────

def ok(msg):     print(f"{Fore.GREEN}  [PASS]{Style.RESET_ALL} {msg}")
def fail(msg):   print(f"{Fore.RED}  [FAIL]{Style.RESET_ALL} {msg}")
def warn(msg):   print(f"{Fore.YELLOW}  [WARN]{Style.RESET_ALL} {msg}")
def info(msg):   print(f"{Fore.CYAN}  [INFO]{Style.RESET_ALL} {msg}")
def header(msg): print(f"\n{Fore.MAGENTA}{'='*60}\n  {msg}\n{'='*60}{Style.RESET_ALL}")

# Mensagens reais retornadas pelo auth.service.ts / login-security.service.ts
BLOCKED_PHRASES = [
    "bloqueada temporariamente",   # conta bloqueada após 5 tentativas
    "endereço ip",                 # IP bloqueado após 20 tentativas
    "muitas tentativas",           # genérico
    "account_blocked",             # failReason no audit
    "block",                       # fallback inglês
]

def is_blocked_message(msg: str) -> bool:
    m = msg.lower()
    return any(phrase in m for phrase in BLOCKED_PHRASES)


class AuthSecurityTester:
    def __init__(self, base_url: str, email: str, password: str):
        self.base    = base_url.rstrip("/")
        self.email   = email
        self.password = password

        # Preenchido após login bem-sucedido
        self.access_token:    str | None = None
        self.refresh_token:   str | None = None
        self.user_id:         str | None = None
        self._preflight_response = None  # resposta HTTP do login, usada para verificar cookies

        self.results: list[dict] = []

    def _url(self, path: str) -> str:
        return f"{self.base}/api/v1{path}"

    def _record(self, test: str, passed: bool | None, detail: str = ""):
        self.results.append({"test": test, "passed": passed, "detail": detail})

    def _auth_cookies(self) -> dict:
        c = {}
        if self.access_token:  c["access_token"]  = self.access_token
        if self.refresh_token: c["refresh_token"]  = self.refresh_token
        return c

    def _decode_jwt_payload(self, token: str) -> dict:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        pad = "=" * (-len(parts[1]) % 4)
        try:
            return json.loads(base64.urlsafe_b64decode(parts[1] + pad))
        except Exception:
            return {}

    # ─── PRÉ-VÔOO: login para obter tokens e userId ──────────────────────────

    def preflight_login(self) -> bool:
        """
        Faz login com as credenciais fornecidas e extrai access_token, refresh_token e userId.
        Retorna True se bem-sucedido.
        """
        header("PRÉ-VÔO: Verificando credenciais")
        r = requests.post(
            self._url("/auth/login"),
            json={"email": self.email, "password": self.password},
            timeout=10
        )
        if r.status_code not in (200, 201):
            try:
                msg = r.json().get("message", "")
            except Exception:
                msg = ""
            fail(f"Login falhou (HTTP {r.status_code}): {msg}")
            warn("Testes que precisam de auth (JWT, Refresh Token, 2FA, Cookies) serão pulados.")
            warn("Verifique se o usuário existe no banco local e o status é ACTIVE.")
            return False

        self._preflight_response = r
        self.access_token  = r.cookies.get("access_token")
        self.refresh_token = r.cookies.get("refresh_token")

        if self.access_token:
            payload = self._decode_jwt_payload(self.access_token)
            self.user_id = payload.get("sub")
            role = payload.get("role", "?")
            ok(f"Login OK — userId={self.user_id}, role={role}")
        else:
            warn("Login retornou 200 mas sem cookie access_token")
            return False

        return True

    # ─── 1. BRUTE FORCE ───────────────────────────────────────────────────────

    def test_brute_force_protection(self):
        """
        O LoginSecurityService bloqueia após MAX_ATTEMPTS=5 falhas em 10 minutos.
        Mensagem de bloqueio: "Conta bloqueada temporariamente. Tente novamente após HH:MM:SS"
        O bloqueio é no banco (status=BLOCKED), não via HTTP 429.
        """
        header("1. Brute Force Login Protection")
        url = self._url("/auth/login")
        blocked = False

        for i in range(1, 9):  # testa até 8 para garantir que passa do limite de 5
            r = requests.post(
                url,
                json={"email": self.email, "password": f"__senha_errada_{i}__"},
                timeout=10
            )
            try:
                body = r.json()
            except Exception:
                body = {}

            msg = str(body.get("message", ""))
            info(f"  Tentativa {i}: HTTP {r.status_code} — {msg[:80]}")

            # Bloqueio via HTTP 429 (rate limit de camada HTTP, caso implementado)
            if r.status_code == 429:
                ok(f"Bloqueado via HTTP 429 na tentativa {i}")
                blocked = True
                break

            # Bloqueio via DB (mensagem específica do LoginSecurityService)
            if is_blocked_message(msg):
                ok(f"Conta bloqueada pelo LoginSecurityService na tentativa {i}: '{msg}'")
                blocked = True
                break

            # Qualquer status diferente de 400/401 é inesperado
            if r.status_code not in (400, 401):
                warn(f"Status inesperado {r.status_code}: {body}")

            time.sleep(0.4)

        if not blocked:
            fail("Nenhum bloqueio detectado após 8 tentativas com senha errada")
            warn("RateLimitGuard retorna true (não implementado) — proteção só via DB após 5 tentativas.")
            warn("Se o usuário já estava bloqueado de um run anterior, aguarde 15min ou desbloqueie manualmente.")

        self._record("brute_force_protection", blocked)

    # ─── 2. IP SPOOFING ───────────────────────────────────────────────────────

    def test_rate_limit_ip_spoofing(self):
        """
        O LoginSecurityService bloqueia por IP após MAX_IP_ATTEMPTS=20 falhas em 10 minutos
        (login-security.service.ts linha 10).

        Vetores testados:
        a) CONTA bloqueada: X-Forwarded-For forjado não bypassa bloqueio de conta
           (bloqueio é por userId no DB, não por IP — IP forjado é irrelevante aqui)
        b) IP forjado contorna o contador por IP: cada IP tem seu próprio contador zerado,
           permitindo N*20 tentativas antes de bloquear qualquer IP individual.

        NOTA: este teste usa um email inexistente para não interferir na conta real.
        O bloqueio por IP conta tentativas de qualquer email, inclusive inexistentes.
        """
        header("2. IP Spoofing — Bypass do Bloqueio por IP")
        url = self._url("/auth/login")

        # Usa email inexistente para não afetar a conta real nem ser afetado pelo bloqueio de conta
        ghost_email = f"ghost_{int(time.time())}@naoexiste.xyz"
        spoofed_ips = [f"203.0.113.{i}" for i in range(1, 11)]
        bypass_confirmed = False
        ip_blocked = False

        info("Testando com email inexistente para isolar contador de IP vs conta...")

        for i, ip in enumerate(spoofed_ips, 1):
            r = requests.post(
                url,
                json={"email": ghost_email, "password": "__errada__"},
                headers={"X-Forwarded-For": ip, "X-Real-IP": ip},
                timeout=10
            )
            try:
                msg = str(r.json().get("message", ""))
            except Exception:
                msg = ""

            info(f"  IP={ip} → HTTP {r.status_code} — {msg[:60]}")

            if r.status_code == 429:
                ok(f"HTTP 429 com IP forjado na tentativa {i} — rate limit HTTP ativo")
                ip_blocked = True
                break

            if "endereço ip" in msg.lower() or "muitas tentativas" in msg.lower():
                ok(f"Bloqueio de IP detectado na tentativa {i} ({ip}): '{msg}'")
                ip_blocked = True
                break

            # 401 com "Credenciais inválidas" = tentativa passou sem bloqueio de IP
            if r.status_code == 401 and "credenciais" in msg.lower():
                bypass_confirmed = True

            time.sleep(0.15)

        if bypass_confirmed and not ip_blocked:
            fail(f"IP Spoofing confirma bypass: {len(spoofed_ips)} IPs diferentes, nenhum bloqueado")
            warn("Impacto: atacante rotaciona IPs forjados → cada um tem 20 tentativas independentes.")
            warn("MAX_IP_ATTEMPTS=20 por IP significa N×20 tentativas antes de bloquear algum IP.")
            warn("Correção: confiar apenas no IP do socket (req.socket.remoteAddress) em vez de")
            warn("X-Forwarded-For, a menos que haja um proxy reverso confiável configurado.")
            self._record("rate_limit_ip_spoofing", False)
        elif ip_blocked:
            ok("API bloqueia por IP mesmo com X-Forwarded-For forjado")
            self._record("rate_limit_ip_spoofing", True)
        else:
            warn("Resultado inconclusivo — nem bypass confirmado nem bloqueio detectado")
            self._record("rate_limit_ip_spoofing", None, "inconclusivo")

    # ─── 3. USER ENUMERATION TIMING ───────────────────────────────────────────

    def test_user_enumeration_timing(self):
        """
        O forgot-password retorna resposta genérica para não revelar emails.
        Verifica se o tempo de resposta varia entre email existente e inexistente.
        Diferença > 200ms indica timing leak (bcrypt/DB lookup assimétrico).
        """
        header("3. User Enumeration via Timing (forgot-password)")
        url     = self._url("/auth/forgot-password")
        samples = 5

        existing_times, fake_times = [], []

        for _ in range(samples):
            t0 = time.perf_counter()
            requests.post(url, json={"email": self.email}, timeout=15)
            existing_times.append(time.perf_counter() - t0)
            time.sleep(0.3)

        for i in range(samples):
            t0 = time.perf_counter()
            requests.post(url, json={"email": f"fake_{i}_{int(time.time())}@naoexiste.xyz"}, timeout=15)
            fake_times.append(time.perf_counter() - t0)
            time.sleep(0.3)

        avg_real = statistics.mean(existing_times) * 1000
        avg_fake = statistics.mean(fake_times) * 1000
        diff     = abs(avg_real - avg_fake)

        info(f"Tempo médio (email real):  {avg_real:.0f}ms")
        info(f"Tempo médio (email falso): {avg_fake:.0f}ms")
        info(f"Diferença: {diff:.0f}ms")

        if diff < 200:
            ok(f"Diferença aceitável ({diff:.0f}ms < 200ms) — sem timing leak detectável")
            self._record("user_enumeration_timing", True, f"diff={diff:.0f}ms")
        else:
            fail(f"Possível timing oracle: {diff:.0f}ms de diferença")
            self._record("user_enumeration_timing", False, f"diff={diff:.0f}ms")

    # ─── 4. JWT MANIPULATION ──────────────────────────────────────────────────

    def test_jwt_manipulation(self):
        """
        Testa dois vetores:
        a) alg=none: JWT sem assinatura deve ser rejeitado
        b) payload tamperado com assinatura original: assinatura inválida deve ser rejeitada
        """
        header("4. JWT Token Manipulation")

        if not self.access_token:
            warn("Sem access_token (login não realizado) — pulando")
            self._record("jwt_alg_none", None, "sem token")
            self._record("jwt_payload_tampering", None, "sem token")
            return

        token = self.access_token
        info(f"Token base: {token[:50]}...")
        parts = token.split(".")

        # 4a — alg=none
        none_header  = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').rstrip(b"=").decode()
        payload_b64  = parts[1] + "=" * (-len(parts[1]) % 4)
        try:
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        except Exception:
            warn("Não foi possível decodificar payload JWT")
            return

        payload["role"] = "SUPER_ADMIN"
        payload["sub"]  = "000000000000000000000000"
        new_payload = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).rstrip(b"=").decode()
        forged_none = f"{none_header}.{new_payload}."

        r2 = requests.get(self._url("/auth/me"), cookies={"access_token": forged_none}, timeout=10)
        if r2.status_code == 401:
            ok(f"alg=none rejeitado (HTTP 401)")
            self._record("jwt_alg_none", True)
        else:
            fail(f"CRÍTICO: Token com alg=none ACEITO! HTTP {r2.status_code} — {r2.text[:100]}")
            self._record("jwt_alg_none", False)

        # 4b — payload tamperado, assinatura original mantida (assinatura agora inválida)
        tampered = f"{parts[0]}.{new_payload}.{parts[2]}"
        r3 = requests.get(self._url("/auth/me"), cookies={"access_token": tampered}, timeout=10)
        if r3.status_code == 401:
            ok(f"Payload tamperado rejeitado (HTTP 401)")
            self._record("jwt_payload_tampering", True)
        else:
            fail(f"CRÍTICO: Payload tamperado ACEITO! HTTP {r3.status_code} — {r3.text[:100]}")
            self._record("jwt_payload_tampering", False)

    # ─── 5. 2FA BRUTE FORCE ───────────────────────────────────────────────────

    def test_2fa_brute_force(self):
        """
        O endpoint POST /auth/2fa/verify é @Public() e aceita { userId, code }.
        Sem rate limit implementado (RateLimitGuard retorna true).
        Sem bloqueio por tentativas erradas de código.
        Ataque: com userId válido + código ativo, tentar 20 códigos/seg → 1M combinações em ~14h.
        """
        header("5. 2FA Brute Force (/auth/2fa/verify)")

        if not self.user_id:
            warn("userId não disponível (login não realizado) — não é possível testar 2FA real")
            warn("O teste precisa de login válido para obter userId e disparar um código ativo.")
            self._record("2fa_brute_force", None, "sem userId")
            return

        url    = self._url("/auth/2fa/verify")
        blocked = False
        codes_tried = 0

        # Testa 25 códigos falsos com userId real
        # Sem código ativo, o server retorna 401 "Código expirado ou inválido"
        # Se tivesse rate limit, retornaria 429 ou bloquearia
        for code_num in range(100000, 100025):
            r = requests.post(url, json={"userId": self.user_id, "code": str(code_num)}, timeout=10)
            codes_tried += 1

            try:
                msg = r.json().get("message", "")
            except Exception:
                msg = ""

            if r.status_code == 429:
                ok(f"Bloqueado via HTTP 429 após {codes_tried} tentativas")
                blocked = True
                break

            if is_blocked_message(str(msg)):
                ok(f"Bloqueado pelo servidor após {codes_tried} tentativas: '{msg}'")
                blocked = True
                break

            time.sleep(0.05)

        if not blocked:
            fail(f"Sem bloqueio após {codes_tried} tentativas de 2FA")
            info(f"Último status: HTTP {r.status_code} — '{msg}'")
            warn("Causa: RateLimitGuard não implementado + verifyCode não conta tentativas erradas.")
            warn("Correção: implementar RateLimitGuard com Redis/Throttler e limitar /auth/2fa/verify.")

        self._record("2fa_brute_force", blocked)

    # ─── 6. REFRESH TOKEN REUSE ───────────────────────────────────────────────

    def test_refresh_token_reuse(self):
        """
        Após rotação, o token antigo deve ser rejeitado.
        Se o token antigo for aceito novamente, session hijacking é possível.
        O auth.service.ts revoga TODOS os tokens do usuário ao detectar reuso (linha 155).
        """
        header("6. Refresh Token Reuse Detection")

        if not self.refresh_token:
            warn("Sem refresh_token (login não realizado) — pulando")
            self._record("refresh_token_reuse", None, "sem token")
            return

        old_refresh = self.refresh_token

        # Rotaciona o token (uso legítimo)
        s1 = requests.Session()
        s1.cookies.set("access_token",  self.access_token or "")
        s1.cookies.set("refresh_token", old_refresh)

        r_rotate = s1.post(self._url("/auth/refresh"), timeout=10)
        if r_rotate.status_code not in (200, 201):
            warn(f"Refresh falhou (HTTP {r_rotate.status_code}) — pulando")
            self._record("refresh_token_reuse", None, "refresh falhou")
            return

        new_refresh = r_rotate.cookies.get("refresh_token", old_refresh)
        info(f"Token rotacionado com sucesso. Tentando reusar o token antigo...")

        # Tenta reusar o token ANTIGO (deve falhar e revogar tudo)
        s2 = requests.Session()
        s2.cookies.set("refresh_token", old_refresh)
        r_reuse = s2.post(self._url("/auth/refresh"), timeout=10)

        if r_reuse.status_code in (401, 403):
            ok(f"Token antigo rejeitado (HTTP {r_reuse.status_code}) — reuse detectado")

            # Verifica se TODOS os tokens foram revogados (rotation attack defense)
            s3 = requests.Session()
            s3.cookies.set("refresh_token", new_refresh)
            r_new = s3.post(self._url("/auth/refresh"), timeout=10)

            if r_new.status_code in (401, 403):
                ok("TODOS os tokens revogados após detecção de reuso — rotation security correta")
                self._record("refresh_token_reuse", True, "rotation + revogação total confirmada")
            else:
                warn(f"Token antigo rejeitado mas token novo ainda funciona (rotation parcial)")
                self._record("refresh_token_reuse", True, "rotation parcial")
        else:
            fail(f"CRÍTICO: Token antigo ACEITO após rotação! HTTP {r_reuse.status_code}")
            fail("Session hijacking possível — quem capturar o token antigo mantém acesso.")
            self._record("refresh_token_reuse", False)

    # ─── 7. INJEÇÃO ───────────────────────────────────────────────────────────

    def test_injection_attacks(self):
        """
        ValidationPipe com whitelist=true e @IsEmail() rejeitam a maioria dos payloads.
        Verifica se algum retorna 500 (erro interno = possível leak de stack trace).
        """
        header("7. SQL / NoSQL Injection")
        url = self._url("/auth/login")

        payloads = [
            ("SQL básico",        "' OR '1'='1",                        "senha"),
            ("SQL comentário",    "admin@test.com'--",                  "senha"),
            ("SQL union",         "' UNION SELECT 1,2,3--",             "senha"),
            ("NoSQL $gt",         {"$gt": ""},                           "senha"),
            ("NoSQL $where",      {"$where": "function(){return true}"}, "senha"),
            ("XSS email",         "<script>alert(1)</script>@t.com",    "senha"),
            ("Email 500 chars",   "a" * 500 + "@test.com",              "senha"),
            ("Null byte",         "admin@test.com\x00",                 "senha"),
            ("CRLF injection",    "a@b.com\r\nX-Header: injected",      "senha"),
            ("Unicode overflow",  "ä" * 300 + "@test.com",              "senha"),
        ]

        leaked = False
        for name, email, pwd in payloads:
            try:
                r = requests.post(url, json={"email": email, "password": pwd}, timeout=10)
                if r.status_code == 500:
                    fail(f"{name}: HTTP 500 — possível stack trace exposto!")
                    leaked = True
                elif r.status_code in (400, 401, 422):
                    ok(f"{name}: rejeitado (HTTP {r.status_code})")
                else:
                    warn(f"{name}: HTTP {r.status_code} — {r.text[:80]}")
            except Exception as e:
                warn(f"{name}: exceção — {e}")
            time.sleep(0.1)

        self._record("injection_attacks", not leaked)

    # ─── 8. MASS ASSIGNMENT ───────────────────────────────────────────────────

    def test_mass_assignment(self):
        """
        ValidationPipe whitelist=true remove campos não decorados no DTO.
        forbidNonWhitelisted=false significa que campos extras NÃO causam erro — apenas são removidos.
        Verifica se campos extras refletem no JWT gerado (ex: role escalation).
        """
        header("8. Mass Assignment")
        url = self._url("/auth/login")

        body = {
            "email":    self.email,
            "password": self.password,
            # campos extras que não existem no LoginDto
            "role":        "SUPER_ADMIN",
            "isAdmin":     True,
            "companyId":   None,
            "__proto__":   {"admin": True},
            "constructor": {"prototype": {"admin": True}},
        }

        r = requests.post(url, json=body, timeout=10)

        if r.status_code not in (200, 201):
            # Fallback: usa o token do pre-flight se o login falhou (ex: conta bloqueada)
            if self.access_token:
                info("Login falhou (conta possivelmente bloqueada) — usando token do pre-flight para verificar role")
                token = self.access_token
            else:
                warn(f"Login falhou (HTTP {r.status_code}) — verificação de role não é possível")
                self._record("mass_assignment", None, "login falhou")
                return
        else:
            token = r.cookies.get("access_token")
            if not token:
                warn("Sem access_token na resposta")
                self._record("mass_assignment", None, "sem token")
                return

        payload = self._decode_jwt_payload(token)
        role = payload.get("role", "")
        info(f"Role no JWT retornado: {role}")

        if role == "SUPER_ADMIN" and "superadmin" not in self.email.lower():
            fail(f"CRÍTICO: Mass assignment escalou role para SUPER_ADMIN no JWT!")
            self._record("mass_assignment", False, f"role={role}")
        else:
            ok(f"Mass assignment não escalou role (role={role})")
            self._record("mass_assignment", True)

    # ─── 9. CORS ──────────────────────────────────────────────────────────────

    def test_cors(self):
        """
        Verifica se origens maliciosas são aceitas no CORS.
        A API usa credentials:true, então Allow-Origin='*' seria inválido pelo browser,
        mas Allow-Origin=<origem-maliciosa> permitiria CSRF via fetch com credentials.
        """
        header("9. CORS Origin Validation")
        url = self._url("/auth/login")

        evil_origins = [
            "https://evil.com",
            "https://inventech.evil.com",
            "https://attacker.com.br",
            "null",
            "file://",
            "http://localhost.evil.com",
        ]

        vuln_found = False
        for origin in evil_origins:
            r = requests.options(
                url,
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "Content-Type",
                },
                timeout=10
            )
            allowed = r.headers.get("Access-Control-Allow-Origin", "")

            if allowed == "*":
                fail(f"'{origin}': CORS retorna * — com credentials, browser bloqueia mas indica má configuração")
                vuln_found = True
            elif allowed == origin:
                fail(f"CRÍTICO: '{origin}' aceita como origem permitida — CSRF possível!")
                vuln_found = True
            else:
                ok(f"'{origin}' rejeitada (Allow-Origin='{allowed or 'ausente'}')")

        self._record("cors_validation", not vuln_found)

    # ─── 10. COOKIE SECURITY FLAGS ────────────────────────────────────────────

    def test_cookie_security(self):
        """
        Verifica flags dos cookies JWT:
        - HttpOnly: impede acesso via document.cookie (XSS mitigation)
        - SameSite=Lax ou Strict: protege contra CSRF
        - Secure: cookie só trafega via HTTPS (esperado em produção, pode estar ausente em dev)
        """
        header("10. Cookie Security Flags")

        if not self.access_token:
            warn("Sem sessão ativa — pulando (requer login válido)")
            self._record("cookie_security", None, "sem sessão")
            return

        # Usa a resposta do pre-flight (já logou com sucesso antes dos testes destrutivos)
        r = self._preflight_response
        if r is None:
            warn("Resposta do pre-flight não disponível — pulando")
            self._record("cookie_security", None, "sem resposta de login")
            return

        raw = "\n".join(v for k, v in r.headers.items() if k.lower() == "set-cookie")
        info(f"Set-Cookie headers:\n{raw}")

        checks = {
            "HttpOnly":          "httponly"         in raw.lower(),
            "SameSite=Lax|Strict": ("samesite=lax"  in raw.lower() or "samesite=strict" in raw.lower()),
            "Secure":            "secure"            in raw.lower(),
        }

        all_ok = True
        for flag, present in checks.items():
            if present:
                ok(f"  {flag}: presente")
            else:
                if flag == "Secure":
                    warn(f"  {flag}: ausente — esperado em produção (HTTPS), OK em dev local")
                else:
                    fail(f"  {flag}: AUSENTE — vulnerabilidade real")
                    all_ok = False

        self._record("cookie_security", all_ok, str(checks))

    # ─── 11. EMAIL CASE NORMALIZATION ─────────────────────────────────────────

    def test_email_case_normalization(self):
        """
        Verifica se ADMIN@EMAIL.COM e admin@email.com compartilham o mesmo contador de bloqueio.
        Se não compartilharem, um atacante pode fazer 5 tentativas com cada variação de case,
        multiplicando indefinidamente o número de tentativas antes do bloqueio.
        """
        header("11. Account Lockout Bypass via Email Case")
        url = self._url("/auth/login")

        variants = [
            self.email,
            self.email.upper(),
            self.email.capitalize(),
            self.email.swapcase(),
        ]

        responses = {}
        for v in set(variants):  # deduplica caso email já seja tudo maiúsculo etc.
            r = requests.post(url, json={"email": v, "password": "__errada_case__"}, timeout=10)
            try:
                msg = r.json().get("message", "")
            except Exception:
                msg = ""
            responses[v] = (r.status_code, msg[:60])
            info(f"  {v}: HTTP {r.status_code} — {msg[:60]}")
            time.sleep(0.2)

        statuses = {v[0] for v in responses.values()}
        if len(statuses) == 1:
            ok("Todos os variants retornam o mesmo status — normalização de email OK")
            self._record("email_case_normalization", True)
        else:
            fail(f"Statuses diferentes por variant de email — lockout pode ser bypassado via case")
            self._record("email_case_normalization", False, str(responses))

    # ─── RELATÓRIO ────────────────────────────────────────────────────────────

    def print_report(self):
        header("RELATÓRIO FINAL")
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

        path = f"security_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump({
                "summary": {"passed": len(passed), "failed": len(failed), "skipped": len(skipped)},
                "results": self.results,
            }, f, indent=2, ensure_ascii=False)
        print(f"  Relatório salvo em: {path}\n")

    # ─── EXECUÇÃO ─────────────────────────────────────────────────────────────

    def run_all(self):
        print(f"\n{Fore.CYAN}{'='*60}")
        print(f"  Inventech Auth Security Test Suite")
        print(f"  Target : {self.base}")
        print(f"  Email  : {self.email}")
        print(f"{'='*60}{Style.RESET_ALL}")

        self.preflight_login()

        # ── Testes que NÃO bloqueiam a conta ─────────────────────────────────
        # Ordem: testes que usam o token do pre-flight primeiro,
        # depois os que não precisam de auth.

        self.test_jwt_manipulation()           # usa access_token do pre-flight
        self.test_refresh_token_reuse()        # usa refresh_token do pre-flight
        self.test_cookie_security()            # usa resposta do pre-flight
        self.test_mass_assignment()            # faz login próprio; fallback no token do pre-flight
        self.test_2fa_brute_force()            # usa userId do pre-flight; não bloqueia conta

        self.test_user_enumeration_timing()    # não precisa de auth
        self.test_injection_attacks()          # não precisa de auth
        self.test_cors()                       # não precisa de auth
        self.test_rate_limit_ip_spoofing()     # usa email inexistente; não afeta conta real

        # ── Testes que BLOQUEIAM a conta — rodar por último ───────────────────
        self.test_email_case_normalization()   # usa senha errada, pode contar tentativas
        self.test_brute_force_protection()     # bloqueia a conta intencionalmente

        self.print_report()


def main():
    parser = argparse.ArgumentParser(description="Inventech Auth Security Tester")
    parser.add_argument("--base-url",  default="http://localhost:3000", help="URL base da API")
    parser.add_argument("--email",     required=True,  help="Email de usuário de teste (status ACTIVE no banco)")
    parser.add_argument("--password",  required=True,  help="Senha correta desse usuário")
    args = parser.parse_args()

    AuthSecurityTester(args.base_url, args.email, args.password).run_all()


if __name__ == "__main__":
    main()
