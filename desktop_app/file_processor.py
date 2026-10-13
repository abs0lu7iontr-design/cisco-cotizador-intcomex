import os
import re
import shutil
from datetime import datetime
from typing import Dict, Any, Tuple, List, Optional


class FileProcessor:
    """
    Analyzes uploaded Estimate files, extracts Partner and Cliente Final via strict Regex,
    creates automatic hierarchical folder structures (Partner/Cliente/YYYY/Mes/ and YYYY-MM/YYYY-MM-DD/),
    prevents silent file overwrites via exclusive versioned file creation,
    and maintains read compatibility with legacy folder structures.
    """

    # Comprehensive Format Regex:
    # [Partner]_[ClienteFinal]_[ID_Cotizacion]_[Nombre_Preventa]_[Fecha].xlsx
    # or [Partner]_[ClienteFinal]_resto_del_nombre.xlsx
    STRICT_FILENAME_REGEX = re.compile(
        r"^([A-Za-z0-9\-\.\s]+)_([A-Za-z0-9\-\.\s]+)(?:_(.+))?\.(xlsx|xls)$",
        re.IGNORECASE,
    )

    MESES_ESPANOL = {
        1: "Enero",
        2: "Febrero",
        3: "Marzo",
        4: "Abril",
        5: "Mayo",
        6: "Junio",
        7: "Julio",
        8: "Agosto",
        9: "Septiembre",
        10: "Octubre",
        11: "Noviembre",
        12: "Diciembre",
    }

    def __init__(self, base_storage_dir: str = None):
        if base_storage_dir is None:
            import sys

            if getattr(sys, "frozen", False):
                exe_dir = os.path.dirname(os.path.abspath(sys.executable))
                self.base_storage_dir = os.path.join(exe_dir, "gravity_storage")
            else:
                self.base_storage_dir = os.path.join(os.getcwd(), "gravity_storage")
        else:
            self.base_storage_dir = base_storage_dir

    @staticmethod
    def sanitize_name(name: str, fallback: str = "General") -> str:
        clean = re.sub(r'[\\/*?:"<>|]', "", (name or "").strip())
        return clean or fallback

    @staticmethod
    def build_versioned_filename(filename: str, version_num: int) -> str:
        """
        Given a filename (e.g. 'Cotizacion.xlsx' or 'Cotizacion_v1.xlsx') and version_num >= 1,
        returns the base filename when version_num == 1, or '<stem>_v<version_num>.<ext>' when version_num >= 2.
        """
        if version_num <= 1:
            return filename
        if "." in filename:
            stem, ext = filename.rsplit(".", 1)
            ext_with_dot = f".{ext}"
        else:
            stem = filename
            ext_with_dot = ".xlsx"

        # Strip trailing _v<digits> if already present to avoid _v2_v3
        stem_clean = re.sub(r"_v\d+$", "", stem, flags=re.IGNORECASE)
        return f"{stem_clean}_v{version_num}{ext_with_dot}"

    @classmethod
    def write_bytes_exclusively(
        cls,
        target_dir: str,
        filename: str,
        file_bytes: bytes,
        allow_overwrite: bool = False,
    ) -> Tuple[str, str, int]:
        """
        Writes file_bytes into target_dir without silently overwriting existing files.
        Uses os.O_CREAT | os.O_EXCL when allow_overwrite is False, automatically incrementing
        version suffixes (_v2, _v3, ...) on collision.
        Returns (final_filename, final_filepath, version_number).
        """
        os.makedirs(target_dir, exist_ok=True)

        if allow_overwrite:
            final_path = os.path.join(target_dir, filename)
            try:
                with open(final_path, "wb") as f:
                    f.write(file_bytes)
            except PermissionError:
                raise PermissionError(
                    f"El archivo '{filename}' ya existe y está abierto en Microsoft Excel. Por favor ciérralo antes de guardar."
                )
            return filename, final_path, 1

        version_num = 1
        max_attempts = 1000
        flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
        if hasattr(os, "O_BINARY"):
            flags |= os.O_BINARY

        while version_num <= max_attempts:
            candidate_name = cls.build_versioned_filename(filename, version_num)
            candidate_path = os.path.join(target_dir, candidate_name)
            try:
                fd = os.open(candidate_path, flags, 0o666)
                try:
                    with os.fdopen(fd, "wb") as f:
                        f.write(file_bytes)
                except Exception:
                    try:
                        os.remove(candidate_path)
                    except OSError:
                        pass
                    raise
                return candidate_name, candidate_path, version_num
            except FileExistsError:
                version_num += 1
            except PermissionError:
                version_num += 1

        raise RuntimeError(
            f"No se pudo generar un nombre versionado libre para '{filename}' tras {max_attempts} intentos."
        )

    def parse_filename(self, filename: str) -> Tuple[bool, str, str, str]:
        """
        Parses filename using Regex or fallback defaults.
        Returns: (is_valid, partner_name, client_final_name, error_message)
        """
        basename = os.path.basename(filename)
        name_without_ext = basename.rsplit(".", 1)[0]
        ext = basename.rsplit(".", 1)[1].lower() if "." in basename else ""

        if ext not in ["xlsx", "xls", "xlsm"]:
            return (
                False,
                "",
                "",
                f"El archivo '{basename}' debe tener extensión .xlsx o .xls.",
            )

        parts = name_without_ext.split("_")
        if len(parts) >= 2:
            partner = parts[0].strip() or "Intcomex"
            client = parts[1].strip() or "Cliente"
            return (True, partner, client, "")
        else:
            alt_parts = [
                p.strip()
                for p in re.split(r"[_.\s-]+", name_without_ext)
                if p.strip()
            ]
            if len(alt_parts) >= 2 and not re.match(
                r"^(estimate|cotizacion|cisco|deal|bom|\d+)$",
                alt_parts[0],
                re.IGNORECASE,
            ):
                return (True, alt_parts[0], alt_parts[1], "")
            # Forgiving default for single-word filenames (e.g. CiscoDealBOM.xls)
            partner = "Intcomex"
            client = name_without_ext.strip() or "General"
            return (True, partner, client, "")

    def organize_and_store_file(
        self,
        source_filepath: str,
        upload_date: datetime = None,
        allow_overwrite: bool = False,
    ) -> Dict[str, Any]:
        """
        Extracts Partner & Client, creates hierarchical folder structure:
        storage_root / Partner / ClienteFinal / YYYY-MM / YYYY-MM-DD /
        and copies the file there without silent overwrite (versions as _v2, _v3 if already present).
        """
        if upload_date is None:
            upload_date = datetime.now()

        filename = os.path.basename(source_filepath)
        is_valid, partner, client, err_msg = self.parse_filename(filename)

        if not is_valid:
            raise ValueError(err_msg)

        month_dir = upload_date.strftime("%Y-%m")
        day_dir = upload_date.strftime("%Y-%m-%d")

        clean_partner = self.sanitize_name(partner, "Intcomex")
        clean_client = self.sanitize_name(client, "Cliente")

        relative_dir = os.path.join(clean_partner, clean_client, month_dir, day_dir)
        target_dir = os.path.join(self.base_storage_dir, relative_dir)
        os.makedirs(target_dir, exist_ok=True)

        with open(source_filepath, "rb") as src_f:
            raw_bytes = src_f.read()

        final_filename, target_filepath, version_num = self.write_bytes_exclusively(
            target_dir=target_dir,
            filename=filename,
            file_bytes=raw_bytes,
            allow_overwrite=allow_overwrite,
        )

        return {
            "partner_name": partner,
            "client_final_name": client,
            "original_filename": filename,
            "stored_filename": final_filename,
            "stored_filepath": target_filepath,
            "relative_dir": relative_dir,
            "version_number": version_num,
            "was_versioned": version_num > 1,
            "created_at": upload_date.isoformat(),
        }

    def save_estimate_in_client_month_structure(
        self,
        file_bytes: bytes,
        partner_name: str,
        client_final_name: str,
        filename: str,
        custom_date: datetime = None,
        allow_overwrite: bool = False,
    ) -> Dict[str, Any]:
        """
        Creates hierarchical structure including the 4-digit year so estimates from different
        years are never mixed:
        storage_root / [Canal_Partner] / [ClienteFinal] / [YYYY] / [Mes_Espanol] / [filename]
        Example: gravity_storage / Intcomex / Banco de Chile / 2026 / Octubre / Cotizacion_BancoDeChile.xlsx
        Uses exclusive file creation (O_CREAT | O_EXCL) and automatic _v2, _v3 versioning to prevent
        silent overwrites.
        """
        if custom_date is None:
            custom_date = datetime.now()

        clean_partner = self.sanitize_name(partner_name, "Intcomex")
        clean_client = self.sanitize_name(client_final_name, "Cliente")
        year_str = f"{custom_date.year:04d}"
        clean_month = self.MESES_ESPANOL.get(custom_date.month, "Mes")
        clean_filename = self.sanitize_name(filename, "Cotizacion_Cisco.xlsx")
        if not clean_filename.lower().endswith((".xlsx", ".xls")):
            clean_filename += ".xlsx"

        relative_dir = os.path.join(clean_partner, clean_client, year_str, clean_month)
        target_dir = os.path.join(self.base_storage_dir, relative_dir)

        final_filename, target_filepath, version_num = self.write_bytes_exclusively(
            target_dir=target_dir,
            filename=clean_filename,
            file_bytes=file_bytes,
            allow_overwrite=allow_overwrite,
        )

        return {
            "success": True,
            "partner": clean_partner,
            "client": clean_client,
            "year": year_str,
            "month": clean_month,
            "filename": final_filename,
            "original_filename": clean_filename,
            "version_number": version_num,
            "was_versioned": version_num > 1,
            "filepath": os.path.abspath(target_filepath),
            "folder": os.path.abspath(target_dir),
            "relative_dir": relative_dir,
        }

    def resolve_estimate_filepath(
        self,
        partner_name: str,
        client_final_name: str,
        filename: str,
        year: Optional[int] = None,
        month_name: Optional[str] = None,
    ) -> Optional[str]:
        """
        Resolves an estimate file path across both the new year-aware structure
        (Partner/Client/YYYY/Mes/filename) and the legacy structure (Partner/Client/Mes/filename).
        """
        clean_partner = self.sanitize_name(partner_name, "Intcomex")
        clean_client = self.sanitize_name(client_final_name, "Cliente")
        clean_filename = self.sanitize_name(filename, "")
        if not clean_filename:
            return None

        candidates: List[str] = []
        if year is not None and month_name:
            candidates.append(
                os.path.join(
                    self.base_storage_dir,
                    clean_partner,
                    clean_client,
                    f"{int(year):04d}",
                    month_name,
                    clean_filename,
                )
            )
        if month_name:
            # Legacy path without year folder
            candidates.append(
                os.path.join(
                    self.base_storage_dir,
                    clean_partner,
                    clean_client,
                    month_name,
                    clean_filename,
                )
            )

        for cand in candidates:
            if os.path.isfile(cand):
                return os.path.abspath(cand)

        # Fallback: scan client directory across all years and legacy month folders
        client_root = os.path.join(self.base_storage_dir, clean_partner, clean_client)
        if os.path.isdir(client_root):
            for root, _dirs, files in os.walk(client_root):
                for f in files:
                    if f.lower() == clean_filename.lower():
                        return os.path.abspath(os.path.join(root, f))

        return None

    def list_stored_estimates(
        self,
        partner_name: Optional[str] = None,
        client_final_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Lists all Excel estimate files stored under base_storage_dir, supporting both:
        - New structure: Partner / Client / YYYY / Mes / file.xlsx
        - Legacy structure: Partner / Client / Mes / file.xlsx
        - Date structure: Partner / Client / YYYY-MM / YYYY-MM-DD / file.xlsx
        """
        results: List[Dict[str, Any]] = []
        if not os.path.isdir(self.base_storage_dir):
            return results

        search_root = self.base_storage_dir
        if partner_name:
            clean_partner = self.sanitize_name(partner_name, "Intcomex")
            search_root = os.path.join(search_root, clean_partner)
            if client_final_name:
                clean_client = self.sanitize_name(client_final_name, "Cliente")
                search_root = os.path.join(search_root, clean_client)

        if not os.path.isdir(search_root):
            return results

        meses_set = {m.lower() for m in self.MESES_ESPANOL.values()}

        for root, _dirs, files in os.walk(search_root):
            for f in files:
                if not f.lower().endswith((".xlsx", ".xls", ".xlsm")):
                    continue
                full_path = os.path.abspath(os.path.join(root, f))
                rel_path = os.path.relpath(full_path, self.base_storage_dir)
                parts = rel_path.split(os.sep)

                partner = parts[0] if len(parts) > 0 else "Intcomex"
                client = parts[1] if len(parts) > 1 else "Cliente"
                detected_year: Optional[str] = None
                detected_month: Optional[str] = None
                structure_type = "legacy_or_custom"

                if len(parts) >= 5 and re.match(r"^\d{4}$", parts[2]):
                    detected_year = parts[2]
                    detected_month = parts[3]
                    structure_type = "year_month"
                elif len(parts) >= 4 and parts[2].lower() in meses_set:
                    detected_month = parts[2]
                    structure_type = "legacy_month_no_year"
                elif len(parts) >= 5 and re.match(r"^\d{4}-\d{2}$", parts[2]):
                    detected_year = parts[2][:4]
                    detected_month = parts[2]
                    structure_type = "iso_date_tree"

                results.append(
                    {
                        "partner": partner,
                        "client": client,
                        "year": detected_year,
                        "month": detected_month,
                        "filename": f,
                        "filepath": full_path,
                        "relative_path": rel_path,
                        "structure_type": structure_type,
                    }
                )

        return results


