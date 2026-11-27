import hashlib
import hmac
import secrets
import time
import uuid
from typing import Optional, Dict, Any, List, Tuple

class AuthManager:
    """
    Role-Based Access Control (RBAC) & Authentication Manager.
    Handles PBKDF2-SHA256 (with per-user CSPRNG salt) + legacy SHA-256 verification,
    brute-force protection, and account lockout.
    """

    PBKDF2_ITERATIONS = 310000

    def __init__(self, db_manager):
        self.db = db_manager
        self.current_user: Optional[Dict[str, Any]] = None
        self.failed_attempts: Dict[str, int] = {}
        self.lockout_until: Dict[str, float] = {}

    @staticmethod
    def hash_password(password: str) -> str:
        """Hashes password using PBKDF2-HMAC-SHA256 (310k iterations) with random 16-byte CSPRNG salt."""
        salt_bytes = secrets.token_bytes(16)
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt_bytes,
            AuthManager.PBKDF2_ITERATIONS,
            dklen=32,
        )
        return f"pbkdf2${AuthManager.PBKDF2_ITERATIONS}${salt_bytes.hex()}${derived.hex()}"

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verifies plain password against PBKDF2, bcrypt, or legacy salted SHA-256 hash in constant time."""
        stored = (password_hash or "").strip()
        if not stored:
            return False

        if stored.startswith("pbkdf2$"):
            try:
                _, iter_str, salt_hex, expected_hex = stored.split("$", 3)
                iterations = int(iter_str)
                if iterations < 10000:
                    return False
                derived = hashlib.pbkdf2_hmac(
                    "sha256",
                    password.encode("utf-8"),
                    bytes.fromhex(salt_hex),
                    iterations,
                    dklen=32,
                )
                return hmac.compare_digest(derived.hex(), expected_hex.lower())
            except Exception:
                return False

        salt = "Cisco_Automated_Intcomex_Salt_2026!"
        old_salt = "Gravity_Intcomex_Salt_2026!"
        computed = hashlib.sha256((password + salt).encode("utf-8")).hexdigest()
        if hmac.compare_digest(computed, stored):
            return True
        old_computed = hashlib.sha256((password + old_salt).encode("utf-8")).hexdigest()
        if hmac.compare_digest(old_computed, stored):
            return True

        # Check bcrypt if stored as bcrypt
        if stored.startswith("$2b$") or stored.startswith("$2a$"):
            try:
                import bcrypt
                return bcrypt.checkpw(password.encode("utf-8"), stored.encode("utf-8"))
            except Exception:
                pass

        # Prohibido fallback en texto plano
        return False

    def login(self, username: str, password: str) -> Tuple[bool, str]:
        """Authenticates user with 3-attempt brute-force protection and account lockout."""
        clean_user = username.strip().lower()
        now = time.time()

        # 1. Check if user is in security lockout
        if clean_user in self.lockout_until and now < self.lockout_until[clean_user]:
            remaining_sec = int(self.lockout_until[clean_user] - now)
            mins = remaining_sec // 60
            secs = remaining_sec % 60
            return (
                False,
                f"⛔ Acceso temporalmente restringido por seguridad. Reintente en {mins:02d}:{secs:02d}."
            )

        user = self.db.get_user_by_username(clean_user)
        if not user:
            # Generic message to prevent user enumeration
            attempts = self.failed_attempts.get(clean_user, 0) + 1
            self.failed_attempts[clean_user] = attempts
            if attempts >= 3:
                self.lockout_until[clean_user] = now + 900  # 15 min
                return (False, "⛔ Acceso temporalmente restringido por motivos de seguridad.")
            return (False, "Usuario o contraseña incorrectos.")

        if not user.get("is_active", True):
            return (False, "⚠️ Esta cuenta se encuentra deshabilitada o expirada. Contacte al Administrador (mskill).")

        if self.verify_password(password, user["password_hash"]):
            # Reset security lockout counter on successful auth
            self.failed_attempts[clean_user] = 0
            self.lockout_until.pop(clean_user, None)
            self.current_user = user
            self.db.update_last_login(user["id"])
            self.db.log_audit_event(username, "LOGIN", f"Inicio de sesión exitoso para {username}")
            return (True, f"Bienvenido, {user['full_name']} ({user['role'].upper()})")
        else:
            attempts = self.failed_attempts.get(clean_user, 0) + 1
            self.failed_attempts[clean_user] = attempts
            
            if attempts >= 3:
                self.lockout_until[clean_user] = now + 900  # 15 minutes
                self.db.log_audit_event(
                    username,
                    "ACCOUNT_LOCKED",
                    f"Cuenta {username} bloqueada temporalmente por 15 minutos tras 3 intentos fallidos."
                )
                return (
                    False,
                    "⛔ Acceso temporalmente restringido por motivos de seguridad."
                )

            self.db.log_audit_event(username, "LOGIN_FAILED", f"Intento fallido {attempts} de 3")
            remaining = 3 - attempts
            return (False, "Usuario o contraseña incorrectos.")

    def logout(self):
        """Logs out current user."""
        if self.current_user:
            username = self.current_user["username"]
            self.db.log_audit_event(username, "LOGOUT", "Cierre de sesión de usuario")
            self.current_user = None

    def is_admin(self) -> bool:
        """Checks if current user has Admin privileges (mskill)."""
        return self.current_user is not None and self.current_user.get("role") == "admin"

    def get_current_user_id(self) -> Optional[str]:
        return self.current_user.get("id") if self.current_user else None

    def get_current_username(self) -> Optional[str]:
        return self.current_user.get("username") if self.current_user else None

    def create_user(self, username: str, full_name: str, email: str, password: str, role: str) -> Tuple[bool, str]:
        """Creates a new user (Admin privilege required)."""
        if not self.is_admin():
            return (False, "Permiso denegado: Solo el Administrador (mskill) puede crear usuarios.")

        if role not in ["admin", "pm", "preventa", "standard", "viewer", "user"]:
            return (False, "Rol inválido. Debe ser 'admin', 'pm', 'preventa', 'standard' o 'viewer'.")

        new_id = f"usr-{uuid.uuid4().hex[:8]}"
        pwd_hash = self.hash_password(password)

        success, msg = self.db.insert_user(new_id, username, full_name, email, pwd_hash, role)
        if success:
            self.db.log_audit_event(
                self.get_current_username(),
                "CREATE_USER",
                f"Usuario {username} creado con rol {role.upper()}"
            )
        return (success, msg)

    def update_user_role(self, target_username: str, new_role: str) -> Tuple[bool, str]:
        """Updates user role (Admin privilege required)."""
        if not self.is_admin():
            return (False, "Permiso denegado: Solo el Administrador puede cambiar roles.")

        success, msg = self.db.update_user_role(target_username, new_role)
        if success:
            self.db.log_audit_event(
                self.get_current_username(),
                "UPDATE_USER_ROLE",
                f"Rol de {target_username} cambiado a {new_role.upper()}"
            )
        return (success, msg)


    def reset_user_password(self, target_username: str, new_password: str) -> Tuple[bool, str]:
        """Resets a user's password (Admin privilege required)."""
        if not self.is_admin():
            return (False, "Permiso denegado: Solo el Administrador (mskill) puede resetear contraseñas.")

        pwd_hash = self.hash_password(new_password)
        success, msg = self.db.update_user_password(target_username, pwd_hash)
        if success:
            self.db.log_audit_event(
                self.get_current_username(),
                "RESET_PASSWORD",
                f"Contraseña reseteada para {target_username}"
            )
        return (success, msg)

    def update_user_full_admin(self, original_username: str, full_name: str, email: str, role: str, password: Optional[str] = None, is_active: Optional[bool] = None) -> Tuple[bool, str]:
        """Edits user profile including name, email, role, password, and active state (Admin only)."""
        if not self.is_admin():
            return (False, "Permiso denegado: Solo el Administrador puede editar usuarios.")

        pwd_hash = self.hash_password(password) if password and password.strip() else None
        active_int = (1 if is_active else 0) if is_active is not None else None
        success, msg = self.db.update_user_full(original_username, full_name, email, role, pwd_hash, active_int)
        if success:
            self.db.log_audit_event(
                self.get_current_username(),
                "UPDATE_USER_FULL",
                f"Usuario {original_username} actualizado: Nombre '{full_name}', Email '{email}', Rol '{role}'"
            )
        return (success, msg)

    def get_all_users(self) -> Tuple[bool, List[Dict[str, Any]], str]:
        """Returns list of users (Admin only)."""
        if not self.is_admin():
            return (False, [], "Permiso denegado: Solo el Administrador puede listar usuarios.")
        users = self.db.get_all_users()
        return (True, users, "OK")

    def toggle_user_status(self, target_username: str, is_active: bool) -> Tuple[bool, str]:
        """Toggles user active state (Admin only)."""
        if not self.is_admin():
            return (False, "Permiso denegado: Solo el Administrador puede cambiar el estado de usuarios.")
        success, msg = self.db.toggle_user_active(target_username, is_active)
        if success:
            action_desc = "activó" if is_active else "desactivó"
            self.db.log_audit_event(
                self.get_current_username(),
                "TOGGLE_USER_STATUS",
                f"Se {action_desc} al usuario {target_username}"
            )
        return (success, msg)

    def delete_user(self, target_username: str) -> Tuple[bool, str]:
        """Deletes user (Admin only)."""
        if not self.is_admin():
            return (False, "Permiso denegado: Solo el Administrador puede eliminar usuarios.")
        success, msg = self.db.delete_user(target_username)
        if success:
            self.db.log_audit_event(
                self.get_current_username(),
                "DELETE_USER",
                f"Usuario {target_username} eliminado"
            )
        return (success, msg)

